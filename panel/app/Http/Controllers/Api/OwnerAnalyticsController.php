<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
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

        $data = $analytics->buildForProperties($propertyIds);
        $sections = $this->reportSections();
        $requested = collect($request->input('sections', array_keys($sections)))
            ->filter(fn ($key): bool => isset($sections[$key]))
            ->values();

        abort_if($requested->isEmpty(), 422, 'Please choose at least one section for the report.');

        $search = trim((string) $request->input('search', ''));

        $blocks = $requested->map(function (string $key) use ($sections, $data, $search): array {
            $rows = collect($data[$key] ?? []);

            if ($search !== '') {
                $rows = $rows->filter(fn ($row): bool => str_contains(
                    mb_strtolower((string) $this->rowLabel($row)),
                    mb_strtolower($search),
                ));
            }

            return [
                'title' => $sections[$key]['title'],
                'label_heading' => $sections[$key]['label'],
                'value_heading' => $sections[$key]['value'],
                'value_key' => $sections[$key]['key'],
                'money' => $sections[$key]['money'] ?? false,
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
        ])->setPaper('a4', 'portrait');

        return $pdf->stream('vergo-report.pdf');
    }

    /**
     * Which sections can be printed, and how each one is laid out.
     *
     * @return array<string, array<string, mixed>>
     */
    private function reportSections(): array
    {
        return [
            'spend_by_property' => ['title' => 'Ausgaben pro Liegenschaft', 'label' => 'Liegenschaft', 'value' => 'Ausgaben', 'key' => 'total_spend', 'money' => true],
            'spend_by_object' => ['title' => 'Ausgaben pro Objekt', 'label' => 'Objekt', 'value' => 'Ausgaben', 'key' => 'total_spend', 'money' => true],
            'spend_by_canton' => ['title' => 'Ausgaben pro Kanton', 'label' => 'Kanton', 'value' => 'Ausgaben', 'key' => 'total_spend', 'money' => true],
            'orders_by_property' => ['title' => 'Auftraege pro Liegenschaft', 'label' => 'Liegenschaft', 'value' => 'Auftraege', 'key' => 'order_count'],
            'orders_by_object' => ['title' => 'Auftraege pro Objekt', 'label' => 'Objekt', 'value' => 'Auftraege', 'key' => 'order_count'],
            'orders_by_management' => ['title' => 'Auftraege pro Bewirtschaftung', 'label' => 'Bewirtschaftung', 'value' => 'Auftraege', 'key' => 'order_count'],
            'orders_by_manager_email' => ['title' => 'Auftraege pro Bewirtschafter', 'label' => 'E-Mail', 'value' => 'Auftraege', 'key' => 'order_count'],
            'cancellations_by_manager' => ['title' => 'Stornierungen pro Bewirtschafter', 'label' => 'E-Mail', 'value' => 'Storniert', 'key' => 'cancelled_count'],
            'duplicates_by_manager' => ['title' => 'Duplikate pro Bewirtschafter', 'label' => 'E-Mail', 'value' => 'Duplikate', 'key' => 'duplicate_count'],
            'providers' => ['title' => 'Dienstleister', 'label' => 'Firma', 'value' => 'Abgeschlossen', 'key' => 'completed_count'],
            'providers_by_canton' => ['title' => 'Dienstleister pro Kanton', 'label' => 'Firma - Kanton', 'value' => 'Auftraege', 'key' => 'order_count'],
            'providers_by_property' => ['title' => 'Dienstleister pro Liegenschaft', 'label' => 'Liegenschaft', 'value' => 'Auftraege', 'key' => 'order_count'],
        ];
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
