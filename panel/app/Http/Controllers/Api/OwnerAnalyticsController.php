<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bid;
use App\Models\Order;
use App\Models\Property;
use App\Models\User;
use App\Services\OwnerAnalyticsService;
use Illuminate\Http\JsonResponse;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;

class OwnerAnalyticsController extends Controller
{
    /**
     * Portfolio figures across every property the owner holds.
     */
    public function analytics(Request $request, OwnerAnalyticsService $analytics): JsonResponse
    {
        $actor = $request->user();

        // A superuser reads the same report across every owner, and may narrow
        // it down to one of them.
        if ($this->isSuperUser($actor)) {
            $ownerId = $request->integer('owner_id') ?: null;

            $propertyIds = $ownerId
                ? Property::query()
                    ->whereHas('owners', fn ($query) => $query->where('users.id', $ownerId))
                    ->pluck('id')
                : Property::query()->pluck('id');

            return response()->json([
                'data' => $analytics->buildForProperties($propertyIds),
                'owners' => $this->selectableOwners(),
                'owner_id' => $ownerId,
            ]);
        }

        $owner = $this->authorizeOwner($request);

        return response()->json(['data' => $analytics->build($owner)]);
    }

    /**
     * Every decision a property manager made that the owner has a right to
     * question: a best offer turned down, a contract cancelled, or an order the
     * system flagged as a duplicate - each with the reason that was given.
     */
    public function decisions(Request $request): JsonResponse
    {
        $propertyIds = $this->reportablePropertyIds($request);

        $rejectedOffers = Bid::query()
            ->with(['serviceProvider:id,company_name', 'order:id,order_number,title,property_id,property_manager_profile_id', 'order.property:id,li_number,title', 'order.propertyManager:id,name,email'])
            ->where('status', 'rejected')
            ->whereNotNull('rejection_reason')
            ->whereHas('order', fn ($query) => $query->whereIn('property_id', $propertyIds))
            ->latest('updated_at')
            ->get()
            ->map(fn (Bid $bid): array => [
                'id' => $bid->id,
                'order_id' => $bid->order?->id,
                'order_number' => $bid->order?->order_number,
                'order_title' => $bid->order?->title,
                'property' => $bid->order?->property?->title ?: $bid->order?->property?->li_number,
                'company_name' => $bid->serviceProvider?->company_name,
                'amount' => $bid->amount,
                'currency' => $bid->currency,
                'manager_name' => $bid->order?->propertyManager?->name,
                'manager_email' => $bid->order?->propertyManager?->email,
                'reason' => $bid->rejection_reason,
                'decided_at' => $bid->updated_at?->toDateTimeString(),
            ])
            ->values()
            ->all();

        $cancellations = Order::query()
            ->withTrashed()
            ->with(['property:id,li_number,title', 'propertyManager:id,name,email'])
            ->whereIn('property_id', $propertyIds)
            ->whereNotNull('cancelled_at')
            ->latest('cancelled_at')
            ->get()
            ->map(fn (Order $order): array => [
                'order_id' => $order->id,
                'order_number' => $order->order_number,
                'order_title' => $order->title,
                'property' => $order->property?->title ?: $order->property?->li_number,
                'manager_name' => $order->propertyManager?->name,
                'manager_email' => $order->propertyManager?->email,
                'reason' => $order->cancellation_reason,
                'decided_at' => $order->cancelled_at?->toDateTimeString(),
            ])
            ->values()
            ->all();

        $duplicates = Order::query()
            ->withTrashed()
            ->with(['property:id,li_number,title', 'propertyManager:id,name,email', 'duplicateOfOrder:id,order_number,title'])
            ->whereIn('property_id', $propertyIds)
            ->whereNotNull('duplicate_of_order_id')
            ->latest()
            ->get()
            ->map(fn (Order $order): array => [
                'order_id' => $order->id,
                'order_number' => $order->order_number,
                'order_title' => $order->title,
                'property' => $order->property?->title ?: $order->property?->li_number,
                'manager_name' => $order->propertyManager?->name,
                'manager_email' => $order->propertyManager?->email,
                'duplicate_of_number' => $order->duplicateOfOrder?->order_number,
                'duplicate_of_title' => $order->duplicateOfOrder?->title,
                // duplicate_reason is a short code; the manager's own words are
                // in duplicate_explanation.
                'reason_code' => $order->duplicate_reason,
                'reason' => $order->duplicate_explanation ?: $order->duplicate_reason,
                'decided_at' => $order->created_at?->toDateTimeString(),
            ])
            ->values()
            ->all();

        return response()->json([
            'data' => [
                'rejected_offers' => $rejectedOffers,
                'cancellations' => $cancellations,
                'duplicates' => $duplicates,
            ],
            'owners' => $this->isSuperUser($request->user()) ? $this->selectableOwners() : [],
        ]);
    }

    /**
     * The properties this report covers: the owner's own, or - for a superuser -
     * every property, optionally narrowed to one owner.
     *
     * @return \Illuminate\Support\Collection<int, int>
     */
    private function reportablePropertyIds(Request $request)
    {
        $actor = $request->user();

        if ($this->isSuperUser($actor)) {
            $ownerId = $request->integer('owner_id') ?: null;

            return $ownerId
                ? Property::query()->whereHas('owners', fn ($query) => $query->where('users.id', $ownerId))->pluck('id')
                : Property::query()->pluck('id');
        }

        return $this->authorizeOwner($request)->ownedProperties()->pluck('properties.id');
    }

    /**
     * Builds a PDF for one section of the report. The owner picks what to print
     * - spend per property, jobs per provider, cancellations per manager and so
     * on - and gets a document they can file or forward.
     */
    public function report(Request $request, OwnerAnalyticsService $analytics)
    {
        $actor = $request->user();
        $isSuperUser = $this->isSuperUser($actor);

        if (! $isSuperUser) {
            $this->authorizeOwner($request);
        }

        $ownerId = $isSuperUser ? ($request->integer('owner_id') ?: null) : $actor->id;

        $propertyIds = $ownerId
            ? Property::query()
                ->whereHas('owners', fn ($query) => $query->where('users.id', $ownerId))
                ->pluck('id')
            : Property::query()->pluck('id');

        $language = in_array($request->query('language'), ['de', 'en', 'fr', 'it'], true)
            ? $request->query('language')
            : 'de';

        $data = $analytics->buildForProperties($propertyIds);
        $sections = $this->reportSections($language);
        $requested = collect($request->input('sections', array_keys($sections)))
            ->filter(fn ($key): bool => isset($sections[$key]))
            ->values();

        abort_if($requested->isEmpty(), 422, 'Please choose at least one section for the report.');

        $search = trim((string) $request->input('search', ''));
        // Each section can carry its own filter - one canton for the provider
        // list, one manager for the order counts - so a single report can be
        // narrowed differently per block.
        $sectionFilters = collect($request->input('filters', []))
            ->map(fn ($value): string => trim((string) $value))
            ->filter(fn (string $value): bool => $value !== '');

        $blocks = $requested->map(function (string $key) use ($sections, $data, $search, $sectionFilters): array {
            $rows = collect($data[$key] ?? []);
            $field = self::FILTER_FIELDS[$key] ?? 'label';

            if ($sectionFilters->has($key)) {
                // A value picked from the list: an exact match on that one
                // field, so "ZH" is the canton ZH and nothing that contains it.
                $value = $sectionFilters->get($key);
                $rows = $rows->filter(fn ($row): bool => (string) data_get($row, $field) === $value);
            } elseif ($search !== '') {
                $rows = $rows->filter(fn ($row): bool => $this->rowMatches($row, $search));
            }

            return [
                'title' => $sections[$key]['title'],
                'label_heading' => $sections[$key]['label'],
                'value_heading' => $sections[$key]['value'],
                'value_key' => $sections[$key]['key'],
                'money' => $sections[$key]['money'] ?? false,
                'filter' => $sectionFilters->get($key),
                'rows' => $rows->values()->all(),
            ];
        })->all();

        $ownerName = $ownerId ? User::query()->find($ownerId)?->name : null;

        $pdf = Pdf::loadView('pdf.owner-report', [
            'totals' => $data['totals'] ?? [],
            'blocks' => $blocks,
            'ownerName' => $ownerName,
            'search' => $search,
            'generatedAt' => now()->format('d.m.Y H:i'),
            'labels' => $this->reportChrome($language),
        ])->setPaper('a4', 'portrait');

        return $pdf->stream('vergo-report.pdf');
    }

    /**
     * The field each section is narrowed by. The page offers only the values
     * that actually occur in the owner's data for that field.
     */
    private const FILTER_FIELDS = [
        'spend_by_property' => 'label',
        'spend_by_object' => 'label',
        'spend_by_canton' => 'label',
        'orders_by_property' => 'label',
        'orders_by_object' => 'label',
        'orders_by_management' => 'label',
        'orders_by_manager_email' => 'label',
        'cancellations_by_manager' => 'manager_email',
        'duplicates_by_manager' => 'label',
        'providers' => 'company_name',
        'providers_by_canton' => 'canton',
        'providers_by_property' => 'company_name',
        'top_services_by_property' => 'property',
    ];

    /**
     * Which sections can be printed, and how each one is laid out.
     *
     * @return array<string, array<string, mixed>>
     */
    private function reportSections(string $language = 'de'): array
    {
        $t = $this->reportTranslations($language);

        return [
            'spend_by_property' => ['title' => $t['spend_by_property'], 'label' => $t['property'], 'value' => $t['spend'], 'key' => 'total_spend', 'money' => true],
            'spend_by_object' => ['title' => $t['spend_by_object'], 'label' => $t['object'], 'value' => $t['spend'], 'key' => 'total_spend', 'money' => true],
            'spend_by_canton' => ['title' => $t['spend_by_canton'], 'label' => $t['canton'], 'value' => $t['spend'], 'key' => 'total_spend', 'money' => true],
            'orders_by_property' => ['title' => $t['orders_by_property'], 'label' => $t['property'], 'value' => $t['orders'], 'key' => 'order_count'],
            'orders_by_object' => ['title' => $t['orders_by_object'], 'label' => $t['object'], 'value' => $t['orders'], 'key' => 'order_count'],
            'orders_by_management' => ['title' => $t['orders_by_management'], 'label' => $t['management'], 'value' => $t['orders'], 'key' => 'order_count'],
            'orders_by_manager_email' => ['title' => $t['orders_by_manager_email'], 'label' => $t['email'], 'value' => $t['orders'], 'key' => 'order_count'],
            'cancellations_by_manager' => ['title' => $t['cancellations_by_manager'], 'label' => $t['email'], 'value' => $t['cancelled'], 'key' => 'cancelled_count'],
            'duplicates_by_manager' => ['title' => $t['duplicates_by_manager'], 'label' => $t['email'], 'value' => $t['duplicates'], 'key' => 'duplicate_count'],
            'providers' => ['title' => $t['providers'], 'label' => $t['company'], 'value' => $t['completed'], 'key' => 'completed_count'],
            'providers_by_canton' => ['title' => $t['providers_by_canton'], 'label' => $t['company_canton'], 'value' => $t['orders'], 'key' => 'order_count'],
            'providers_by_property' => ['title' => $t['providers_by_property'], 'label' => $t['property'], 'value' => $t['orders'], 'key' => 'order_count'],
        ];
    }

    /**
     * Section titles and column headings per language. The PDF must come out in
     * whatever language the user is working in.
     *
     * @return array<string, string>
     */
    private function reportTranslations(string $language): array
    {
        $all = [
            'de' => [
                'spend_by_property' => 'Ausgaben pro Liegenschaft', 'spend_by_object' => 'Ausgaben pro Objekt',
                'spend_by_canton' => 'Ausgaben pro Kanton', 'orders_by_property' => 'Aufträge pro Liegenschaft',
                'orders_by_object' => 'Aufträge pro Objekt', 'orders_by_management' => 'Aufträge pro Bewirtschaftung',
                'orders_by_manager_email' => 'Aufträge pro Bewirtschafter', 'cancellations_by_manager' => 'Stornierungen pro Bewirtschafter',
                'duplicates_by_manager' => 'Duplikate pro Bewirtschafter', 'providers' => 'Dienstleister',
                'providers_by_canton' => 'Dienstleister pro Kanton', 'providers_by_property' => 'Dienstleister pro Liegenschaft',
                'property' => 'Liegenschaft', 'object' => 'Objekt', 'canton' => 'Kanton', 'management' => 'Bewirtschaftung',
                'email' => 'E-Mail', 'company' => 'Firma', 'company_canton' => 'Firma - Kanton',
                'spend' => 'Ausgaben', 'orders' => 'Aufträge', 'cancelled' => 'Storniert',
                'duplicates' => 'Duplikate', 'completed' => 'Abgeschlossen',
            ],
            'en' => [
                'spend_by_property' => 'Spend per property', 'spend_by_object' => 'Spend per object',
                'spend_by_canton' => 'Spend per canton', 'orders_by_property' => 'Orders per property',
                'orders_by_object' => 'Orders per object', 'orders_by_management' => 'Orders per management company',
                'orders_by_manager_email' => 'Orders per property manager', 'cancellations_by_manager' => 'Cancellations per property manager',
                'duplicates_by_manager' => 'Duplicates per property manager', 'providers' => 'Service providers',
                'providers_by_canton' => 'Service providers per canton', 'providers_by_property' => 'Service providers per property',
                'property' => 'Property', 'object' => 'Object', 'canton' => 'Canton', 'management' => 'Management',
                'email' => 'E-mail', 'company' => 'Company', 'company_canton' => 'Company - canton',
                'spend' => 'Spend', 'orders' => 'Orders', 'cancelled' => 'Cancelled',
                'duplicates' => 'Duplicates', 'completed' => 'Completed',
            ],
            'it' => [
                'spend_by_property' => 'Spese per immobile', 'spend_by_object' => 'Spese per oggetto',
                'spend_by_canton' => 'Spese per cantone', 'orders_by_property' => 'Ordini per immobile',
                'orders_by_object' => 'Ordini per oggetto', 'orders_by_management' => 'Ordini per amministrazione',
                'orders_by_manager_email' => 'Ordini per amministratore', 'cancellations_by_manager' => 'Annullamenti per amministratore',
                'duplicates_by_manager' => 'Duplicati per amministratore', 'providers' => 'Fornitori di servizi',
                'providers_by_canton' => 'Fornitori per cantone', 'providers_by_property' => 'Fornitori per immobile',
                'property' => 'Immobile', 'object' => 'Oggetto', 'canton' => 'Cantone', 'management' => 'Amministrazione',
                'email' => 'E-mail', 'company' => 'Azienda', 'company_canton' => 'Azienda - cantone',
                'spend' => 'Spese', 'orders' => 'Ordini', 'cancelled' => 'Annullati',
                'duplicates' => 'Duplicati', 'completed' => 'Completati',
            ],
            'fr' => [
                'spend_by_property' => 'Dépenses par bien', 'spend_by_object' => 'Dépenses par objet',
                'spend_by_canton' => 'Dépenses par canton', 'orders_by_property' => 'Commandes par bien',
                'orders_by_object' => 'Commandes par objet', 'orders_by_management' => 'Commandes par gerance',
                'orders_by_manager_email' => 'Commandes par gestionnaire', 'cancellations_by_manager' => 'Annulations par gestionnaire',
                'duplicates_by_manager' => 'Doublons par gestionnaire', 'providers' => 'Prestataires',
                'providers_by_canton' => 'Prestataires par canton', 'providers_by_property' => 'Prestataires par bien',
                'property' => 'Bien', 'object' => 'Objet', 'canton' => 'Canton', 'management' => 'Gérance',
                'email' => 'E-mail', 'company' => 'Entreprise', 'company_canton' => 'Entreprise - canton',
                'spend' => 'Dépenses', 'orders' => 'Commandes', 'cancelled' => 'Annulées',
                'duplicates' => 'Doublons', 'completed' => 'Terminées',
            ],
        ];

        return $all[$language] ?? $all['de'];
    }

    /**
     * The wording around the tables - heading, totals row and footnotes.
     *
     * @return array<string, string>
     */
    private function reportChrome(string $language): array
    {
        $all = [
            'de' => ['heading' => 'Vergo Auswertung', 'all_owners' => 'Alle Eigentümer', 'owner' => 'Eigentümer',
                'filter' => 'Filter', 'generated' => 'Erstellt am', 'orders' => 'Aufträge', 'active' => 'Aktiv',
                'completed' => 'Abgeschlossen', 'cancelled' => 'Storniert', 'properties' => 'Liegenschaften',
                'spend' => 'Ausgaben', 'empty' => 'Keine Daten vorhanden.'],
            'en' => ['heading' => 'Vergo Analysis', 'all_owners' => 'All owners', 'owner' => 'Owner',
                'filter' => 'Filter', 'generated' => 'Created on', 'orders' => 'Orders', 'active' => 'Active',
                'completed' => 'Completed', 'cancelled' => 'Cancelled', 'properties' => 'Properties',
                'spend' => 'Spend', 'empty' => 'No data available.'],
            'it' => ['heading' => 'Analisi Vergo', 'all_owners' => 'Tutti i proprietari', 'owner' => 'Proprietario',
                'filter' => 'Filtro', 'generated' => 'Creato il', 'orders' => 'Ordini', 'active' => 'Attivi',
                'completed' => 'Completati', 'cancelled' => 'Annullati', 'properties' => 'Immobili',
                'spend' => 'Spese', 'empty' => 'Nessun dato disponibile.'],
            'fr' => ['heading' => 'Analyse Vergo', 'all_owners' => 'Tous les propriétaires', 'owner' => 'Propriétaire',
                'filter' => 'Filtre', 'generated' => 'Créé le', 'orders' => 'Commandes', 'active' => 'Actives',
                'completed' => 'Terminées', 'cancelled' => 'Annulées', 'properties' => 'Biens',
                'spend' => 'Dépenses', 'empty' => 'Aucune donnée disponible.'],
        ];

        return $all[$language] ?? $all['de'];
    }

    /**
     * Does any text on this row contain the term? Rows differ per section - a
     * canton sits in the label, a company in company_name - so every string
     * field is searched rather than one guessed column.
     */
    private function rowMatches(mixed $row, string $term): bool
    {
        $needle = mb_strtolower($term);

        foreach ((array) $row as $value) {
            if (is_string($value) && str_contains(mb_strtolower($value), $needle)) {
                return true;
            }
        }

        return false;
    }

    private function rowLabel(mixed $row): string
    {
        return (string) (data_get($row, 'label')
            ?? data_get($row, 'company_name')
            ?? data_get($row, 'manager_email')
            ?? '');
    }

    /**
     * Admins, and employees promoted to power user, are the superusers.
     */
    private function isSuperUser(mixed $actor): bool
    {
        return $actor instanceof User
            && ($actor->role?->name === 'admin'
                || ($actor->role?->name === 'employee' && $actor->access_level === 'power_user'));
    }

    /**
     * Owners that actually hold a property - the choices for the filter.
     *
     * @return array<int, array<string, mixed>>
     */
    private function selectableOwners(): array
    {
        return User::query()
            ->whereHas('role', fn ($query) => $query->where('name', 'owner'))
            ->whereHas('ownedProperties')
            ->orderBy('name')
            ->get(['id', 'name', 'email'])
            ->map(fn (User $owner): array => [
                'id' => $owner->id,
                'name' => $owner->name,
                'email' => $owner->email,
            ])
            ->all();
    }

    /**
     * Orders the system flagged as likely duplicates, with the manager's
     * explanation, so the owner can see who split or re-raised work.
     */
    public function duplicates(Request $request): JsonResponse
    {
        $owner = $this->authorizeOwner($request);
        $propertyIds = $owner->ownedProperties()->pluck('properties.id');

        $flagged = Order::query()
            ->withTrashed()
            ->with(['property:id,li_number,title', 'propertyManager:id,name,email', 'duplicateOfOrder:id,order_number,title,cancelled_at,cancellation_reason'])
            ->whereIn('property_id', $propertyIds)
            ->whereNotNull('duplicate_of_order_id')
            ->latest()
            ->get()
            ->map(fn (Order $order): array => [
                'order_id' => $order->id,
                'order_number' => $order->order_number,
                'title' => $order->title,
                'property' => $order->property?->title ?: $order->property?->li_number,
                'manager_name' => $order->propertyManager?->name,
                'manager_email' => $order->propertyManager?->email ?: $order->requester_email,
                'similarity' => $order->duplicate_similarity !== null ? (float) $order->duplicate_similarity : null,
                'reason' => $order->duplicate_reason,
                // The mandatory explanation the manager had to give.
                'explanation' => $order->duplicate_explanation,
                'acknowledged_at' => $order->duplicate_acknowledged_at?->toDateTimeString(),
                'duplicate_of' => $order->duplicateOfOrder ? [
                    'order_number' => $order->duplicateOfOrder->order_number,
                    'title' => $order->duplicateOfOrder->title,
                    'cancelled_at' => $order->duplicateOfOrder->cancelled_at?->toDateTimeString(),
                    'cancellation_reason' => $order->duplicateOfOrder->cancellation_reason,
                ] : null,
                'created_at' => $order->created_at?->toDateTimeString(),
            ]);

        return response()->json(['data' => $flagged]);
    }

    private function authorizeOwner(Request $request): User
    {
        $actor = $request->user();

        abort_unless($actor instanceof User && $actor->role?->name === 'owner', 403);

        return $actor;
    }
}
