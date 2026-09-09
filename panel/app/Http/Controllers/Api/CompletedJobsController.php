<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\ServiceProvider;
use App\Models\User;
use App\Support\SwissNumber;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Every job that has actually been finished: who did it, where, when, and for
 * how much. Vergo staff use this to check a company's output for a month or a
 * quarter and to hand that out as a document.
 */
class CompletedJobsController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorizeStaff($request);

        $jobs = $this->query($request)->get()->map(fn (Order $order): array => $this->row($order))->values();

        return response()->json([
            'data' => $jobs,
            'providers' => $this->selectableProviders(),
            // Built from the data itself, so the dropdown can never drift from
            // the statuses orders really have.
            'statuses' => $this->selectableStatuses(),
            'totals' => [
                'job_count' => $jobs->count(),
                'total_value' => round($jobs->sum(fn (array $row): float => (float) ($row['amount'] ?? 0)), 2),
            ],
        ]);
    }

    /**
     * The same list as a document: the company at the top, their finished jobs
     * underneath, one line each.
     */
    public function pdf(Request $request)
    {
        $this->authorizeStaff($request);

        $language = in_array($request->query('language'), ['de', 'en', 'fr', 'it'], true)
            ? $request->query('language')
            : 'de';

        $jobs = $this->query($request)->get()->map(fn (Order $order): array => $this->row($order));

        // One block per company, so a multi-provider export still reads as a
        // set of per-company overviews.
        $groups = $jobs
            ->groupBy(fn (array $row): string => $row['provider'] ?: '-')
            ->map(fn (Collection $rows, string $provider): array => [
                'provider' => $provider,
                'rows' => $rows->values()->all(),
                'total' => round($rows->sum(fn (array $row): float => (float) ($row['amount'] ?? 0)), 2),
            ])
            ->sortKeys()
            ->values()
            ->all();

        $pdf = Pdf::loadView('pdf.completed-jobs', [
            'groups' => $groups,
            'labels' => $this->labels($language),
            'statusFilter' => (string) $request->query('status', ''),
            'periodLabel' => $this->periodLabel($request),
            'generatedAt' => now()->format('d.m.Y H:i'),
            'logoDataUri' => $this->logoDataUri(),
            'grandTotal' => round($jobs->sum(fn (array $row): float => (float) ($row['amount'] ?? 0)), 2),
        ])->setPaper('a4', 'portrait');

        return $pdf->stream('vergo-abgeschlossene-auftraege.pdf');
    }

    /**
     * Finished jobs, narrowed by the filters the user set.
     */
    private function query(Request $request): Builder
    {
        $query = Order::query()
            ->with([
                'property:id,li_number,title,postal_code,city',
                'propertyObject:id,name,address,postal_code,city',
                'approvedBid.serviceProvider:id,company_name',
            ])
            // Finished jobs first, then whatever is still running.
            ->orderByRaw('completed_at IS NULL')
            ->orderByDesc('completed_at')
            ->orderByDesc('created_at');

        $status = (string) $request->query('status', '');

        if ($status === 'completed') {
            $query->whereIn('status', ['completed', 'closed']);
        } elseif ($status === 'active') {
            // Everything still in play - not finished and not written off.
            $query->whereNotIn('status', ['completed', 'closed', 'cancelled'])
                ->whereNull('cancelled_at');
        } elseif ($status === 'cancelled') {
            $query->where(fn ($inner) => $inner->where('status', 'cancelled')->orWhereNotNull('cancelled_at'));
        } elseif ($status !== '') {
            $query->where('status', $status);
        }

        if ($providerId = $request->integer('provider_id')) {
            $query->whereHas('approvedBid', fn ($bid) => $bid->where('service_provider_id', $providerId));
        }

        $year = $request->integer('year') ?: null;

        // A running job has no completion date, so the period filters fall back
        // to when it was raised.
        $dateColumn = in_array($status, ['completed', ''], true) ? 'completed_at' : 'created_at';

        if ($month = $request->integer('month')) {
            $query->whereMonth($dateColumn, $month);

            if ($year) {
                $query->whereYear($dateColumn, $year);
            }
        } elseif ($quarter = $request->integer('quarter')) {
            $months = range(($quarter - 1) * 3 + 1, $quarter * 3);
            $query->whereIn(DB::raw('MONTH('.$dateColumn.')'), $months);

            if ($year) {
                $query->whereYear($dateColumn, $year);
            }
        } elseif ($year) {
            $query->whereYear($dateColumn, $year);
        }

        return $query;
    }

    /**
     * @return array<string, mixed>
     */
    private function row(Order $order): array
    {
        $object = $order->propertyObject;
        $property = $order->property;
        $bid = $order->approvedBid;

        return [
            'order_id' => $order->id,
            'order_number' => $order->order_number,
            'title' => $order->title,
            'status' => $order->cancelled_at ? 'cancelled' : $order->status,
            'completed_at' => $order->completed_at?->toDateString(),
            'created_at' => $order->created_at?->toDateString(),
            'provider' => $bid?->serviceProvider?->company_name,
            'provider_id' => $bid?->service_provider_id,
            'trade' => $order->service_type,
            'address' => trim(implode(', ', array_filter([
                $object?->address ?: $property?->title,
                trim(($object?->postal_code ?: $property?->postal_code).' '.($object?->city ?: $property?->city)),
            ]))) ?: null,
            'property' => $property?->title ?: $property?->li_number,
            'amount' => $bid?->amount,
            'currency' => $bid?->currency ?: 'CHF',
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function selectableProviders(): array
    {
        return ServiceProvider::query()
            ->orderBy('company_name')
            ->get(['id', 'company_name'])
            ->map(fn (ServiceProvider $provider): array => [
                'id' => $provider->id,
                'company_name' => $provider->company_name,
            ])
            ->all();
    }

    /**
     * The statuses orders actually carry, with how many of each.
     *
     * @return array<int, array<string, mixed>>
     */
    private function selectableStatuses(): array
    {
        return Order::query()
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->orderBy('status')
            ->get()
            ->map(fn ($row): array => [
                'value' => $row->status,
                'count' => (int) $row->total,
            ])
            ->all();
    }

    private function periodLabel(Request $request): string
    {
        $year = $request->integer('year') ?: null;

        if ($month = $request->integer('month')) {
            return Carbon::create($year ?: now()->year, $month, 1)->format('m.Y');
        }

        if ($quarter = $request->integer('quarter')) {
            return 'Q'.$quarter.($year ? ' '.$year : '');
        }

        return $year ? (string) $year : '-';
    }

    private function authorizeStaff(Request $request): void
    {
        $actor = $request->user();

        abort_unless(
            $actor instanceof User && in_array($actor->role?->name, ['admin', 'employee'], true),
            403,
        );
    }

    /**
     * @return array<string, string>
     */
    private function labels(string $language): array
    {
        $all = [
            'de' => ['title' => 'Abgeschlossene Aufträge', 'period' => 'Zeitraum', 'generated' => 'erstellt am',
                'order_number' => 'Auftragsnummer', 'completed_on' => 'Abgeschlossen am', 'trade' => 'Gewerk',
                'status' => 'Status',
                'address' => 'Adresse', 'price' => 'Preis', 'total' => 'Total', 'jobs' => 'Aufträge',
                'grand_total' => 'Gesamtsumme', 'empty' => 'Keine abgeschlossenen Aufträge im Zeitraum.'],
            'en' => ['title' => 'Completed jobs', 'period' => 'Period', 'generated' => 'created on',
                'order_number' => 'Job number', 'completed_on' => 'Completed on', 'trade' => 'Trade',
                'status' => 'Status',
                'address' => 'Address', 'price' => 'Price', 'total' => 'Total', 'jobs' => 'Jobs',
                'grand_total' => 'Grand total', 'empty' => 'No completed jobs in this period.'],
            'it' => ['title' => 'Lavori completati', 'period' => 'Periodo', 'generated' => 'creato il',
                'order_number' => 'Numéro ordine', 'completed_on' => 'Completato il', 'trade' => 'Settore',
                'address' => 'Indirizzo', 'price' => 'Prezzo', 'total' => 'Totale', 'jobs' => 'Lavori',
                'grand_total' => 'Totale generale', 'empty' => 'Nessun lavoro completato nel periodo.'],
            'fr' => ['title' => 'Travaux terminés', 'period' => 'Période', 'generated' => 'créé le',
                'order_number' => 'Numéro de commande', 'completed_on' => 'Terminé le', 'trade' => 'Corps de métier',
                'status' => 'Statut',
                'address' => 'Adresse', 'price' => 'Prix', 'total' => 'Total', 'jobs' => 'Travaux',
                'grand_total' => 'Total général', 'empty' => 'Aucun travail terminé sur la période.'],
        ];

        return $all[$language] ?? $all['de'];
    }

    private function logoDataUri(): string
    {
        $logoPath = collect([
            public_path('VERGO.png'),
            base_path('../public/VERGO.png'),
        ])->first(fn (string $path) => file_exists($path));

        return $logoPath
            ? 'data:'.(mime_content_type($logoPath) ?: 'image/png').';base64,'.base64_encode(file_get_contents($logoPath))
            : '';
    }
}
