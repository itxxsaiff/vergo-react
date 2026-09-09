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
            ->whereIn('status', ['completed', 'closed'])
            ->whereNotNull('completed_at')
            ->orderByDesc('completed_at');

        if ($providerId = $request->integer('provider_id')) {
            $query->whereHas('approvedBid', fn ($bid) => $bid->where('service_provider_id', $providerId));
        }

        $year = $request->integer('year') ?: null;

        if ($month = $request->integer('month')) {
            $query->whereMonth('completed_at', $month);

            if ($year) {
                $query->whereYear('completed_at', $year);
            }
        } elseif ($quarter = $request->integer('quarter')) {
            $months = range(($quarter - 1) * 3 + 1, $quarter * 3);
            $query->whereIn(DB::raw('MONTH(completed_at)'), $months);

            if ($year) {
                $query->whereYear('completed_at', $year);
            }
        } elseif ($year) {
            $query->whereYear('completed_at', $year);
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
            'completed_at' => $order->completed_at?->toDateString(),
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
            'de' => ['title' => 'Abgeschlossene Auftraege', 'period' => 'Zeitraum', 'generated' => 'erstellt am',
                'order_number' => 'Auftragsnummer', 'completed_on' => 'Abgeschlossen am', 'trade' => 'Gewerk',
                'address' => 'Adresse', 'price' => 'Preis', 'total' => 'Total', 'jobs' => 'Auftraege',
                'grand_total' => 'Gesamtsumme', 'empty' => 'Keine abgeschlossenen Auftraege im Zeitraum.'],
            'en' => ['title' => 'Completed jobs', 'period' => 'Period', 'generated' => 'created on',
                'order_number' => 'Job number', 'completed_on' => 'Completed on', 'trade' => 'Trade',
                'address' => 'Address', 'price' => 'Price', 'total' => 'Total', 'jobs' => 'Jobs',
                'grand_total' => 'Grand total', 'empty' => 'No completed jobs in this period.'],
            'it' => ['title' => 'Lavori completati', 'period' => 'Periodo', 'generated' => 'creato il',
                'order_number' => 'Numero ordine', 'completed_on' => 'Completato il', 'trade' => 'Settore',
                'address' => 'Indirizzo', 'price' => 'Prezzo', 'total' => 'Totale', 'jobs' => 'Lavori',
                'grand_total' => 'Totale generale', 'empty' => 'Nessun lavoro completato nel periodo.'],
            'fr' => ['title' => 'Travaux termines', 'period' => 'Periode', 'generated' => 'cree le',
                'order_number' => 'Numero de commande', 'completed_on' => 'Termine le', 'trade' => 'Corps de metier',
                'address' => 'Adresse', 'price' => 'Prix', 'total' => 'Total', 'jobs' => 'Travaux',
                'grand_total' => 'Total general', 'empty' => 'Aucun travail termine sur la periode.'],
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
