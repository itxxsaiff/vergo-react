<?php

namespace App\Console\Commands;

use App\Models\Document;
use App\Models\Property;
use App\Models\ServiceProvider;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/**
 * Produces realistic Swiss maintenance invoices as real PDF files and attaches
 * them as documents, so the AI analysis has something genuine to read.
 *
 * The prices are deliberately spread: some sit at a fair market level, one is
 * clearly overpriced and one clearly underpriced, so the benchmarking and the
 * pricing signal have something to find.
 */
class GenerateDemoInvoices extends Command
{
    protected $signature = 'vergo:demo-invoices
                            {--fresh : Delete previously generated demo invoices first}';

    protected $description = 'Generate demo invoice PDFs and attach them as analysable documents.';

    private const TAG = '[DEMO]';

    private const DIRECTORY = 'vergo-demo-invoices';

    public function handle(): int
    {
        if (! app()->environment('local')) {
            $this->error('Demo invoices are for local use only.');

            return self::FAILURE;
        }

        $properties = Property::query()->orderBy('id')->get();

        if ($properties->isEmpty()) {
            $this->error('No properties found. Run php artisan vergo:demo-data first.');

            return self::FAILURE;
        }

        if ($this->option('fresh')) {
            $this->removeExisting();
        }

        $providers = ServiceProvider::query()->orderBy('id')->get();

        foreach ($this->invoiceDefinitions() as $index => $definition) {
            // Prefer the property that already has an order in this trade: that
            // is where the historical price is actually useful as a benchmark.
            $matchingOrder = \App\Models\Order::query()
                ->where('service_type', $definition['service_type'])
                ->whereNotNull('property_id')
                ->latest('id')
                ->first();

            $property = $matchingOrder
                ? $properties->firstWhere('id', $matchingOrder->property_id) ?? $properties[$index % $properties->count()]
                : $properties[$index % $properties->count()];
            $provider = $providers->isNotEmpty() ? $providers[$index % $providers->count()] : null;

            $this->createInvoice($definition, $property, $provider, $index);
        }

        $this->newLine();
        $this->info('Demo invoices ready. Open Dokumente in the app and run the AI analysis on them.');

        return self::SUCCESS;
    }

    /**
     * @param  array<string, mixed>  $definition
     */
    private function createInvoice(array $definition, Property $property, ?ServiceProvider $provider, int $index): void
    {
        $items = $definition['items'];
        $subtotal = array_sum(array_map(
            fn (array $item): float => $item['quantity'] * $item['unit_price'],
            $items
        ));
        $vat = round($subtotal * 0.081, 2);
        $total = round($subtotal + $vat, 2);

        $invoiceDate = Carbon::now()->subMonths(10 - $index)->startOfMonth()->addDays(4);
        $invoiceNumber = sprintf('RG-%s-%03d', $invoiceDate->format('Y'), 140 + $index);

        $pdf = Pdf::loadView('pdf.demo-invoice', [
            'vendor' => $definition['vendor'],
            'recipient' => [
                'name' => $property->management ?: 'Vergo Bewirtschaftung',
                'street' => 'Verwaltungsweg 12',
                'zip' => '8003',
                'city' => 'Zürich',
            ],
            'property' => [
                'title' => $property->title,
                'li_number' => $property->li_number,
                'address' => $property->address_line_1 ?: 'Musterstrasse 1',
                'zip' => $property->postal_code ?: '8001',
                'city' => $property->city ?: 'Zürich',
                'size' => $property->size ?: 1200,
            ],
            'service_label' => $definition['service_label'],
            'interval' => $definition['interval'],
            'period' => $invoiceDate->copy()->subMonth()->format('m.Y').' - '.$invoiceDate->format('m.Y'),
            'invoice_number' => $invoiceNumber,
            'invoice_date' => $invoiceDate->format('d.m.Y'),
            'due_date' => $invoiceDate->copy()->addDays(30)->format('d.m.Y'),
            'items' => $items,
            'subtotal' => $subtotal,
            'vat' => $vat,
            'total' => $total,
        ])->setPaper('a4');

        $fileName = str($definition['title'])->slug().'-'.$invoiceNumber.'.pdf';
        $path = self::DIRECTORY.'/'.$fileName;

        Storage::put($path, $pdf->output());

        Document::query()->updateOrCreate(
            ['property_id' => $property->id, 'title' => self::TAG.' '.$definition['title']],
            [
                'service_provider_id' => $provider?->id,
                'type' => 'invoice',
                'service_type' => $definition['service_type'],
                'file_name' => $fileName,
                'file_path' => $path,
                'mime_type' => 'application/pdf',
                'size' => Storage::size($path),
                // Pending so the AI analysis has work to do on camera.
                'status' => 'pending',
            ]
        );

        $this->line(sprintf(
            '  %-34s %-18s CHF %9s  %s',
            $definition['title'],
            $property->li_number,
            number_format($total, 2, '.', "'"),
            $definition['note']
        ));
    }

    private function removeExisting(): void
    {
        Storage::deleteDirectory(self::DIRECTORY);
        $removed = Document::query()->where('title', 'like', self::TAG.'%')->delete();
        $this->line('  removed '.$removed.' previous demo invoice(s)');
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function invoiceDefinitions(): array
    {
        return [
            [
                'title' => 'Rechnung Malerarbeiten Treppenhaus',
                'service_type' => 'painting',
                'service_label' => 'Malerarbeiten / Innenanstrich',
                'interval' => 'Einmalig',
                'note' => 'marktueblich',
                'vendor' => $this->vendor('Malerei Frei GmbH', 'Farbgasse 8', '8004', 'Zürich', 'CHE-118.222.331'),
                'items' => [
                    ['label' => 'Wände und Decken streichen, 2 Anstriche', 'unit' => 'm2', 'quantity' => 320, 'unit_price' => 18.50],
                    ['label' => 'Abdeck- und Vorarbeiten', 'unit' => 'Std', 'quantity' => 14, 'unit_price' => 92.00],
                    ['label' => 'Material (Dispersionsfarbe, Abdeckvlies)', 'unit' => 'pauschal', 'quantity' => 1, 'unit_price' => 640.00],
                ],
            ],
            [
                'title' => 'Rechnung Heizungswartung Jahresservice',
                'service_type' => 'hvac_maintenance',
                'service_label' => 'Heizung / Wartung Gasheizung',
                'interval' => 'Jährlich',
                'note' => 'marktueblich',
                'vendor' => $this->vendor('Klima Profi AG', 'Wärmestrasse 22', '8050', 'Zürich', 'CHE-221.884.109'),
                'items' => [
                    ['label' => 'Jahreswartung Gasheizkessel inkl. Messprotokoll', 'unit' => 'pauschal', 'quantity' => 1, 'unit_price' => 780.00],
                    ['label' => 'Ersatz Zündelektrode und Dichtungen', 'unit' => 'Stk', 'quantity' => 2, 'unit_price' => 96.50],
                    ['label' => 'Anfahrt und Entsorgung', 'unit' => 'pauschal', 'quantity' => 1, 'unit_price' => 145.00],
                ],
            ],
            [
                'title' => 'Rechnung Sanitaer Badsanierung',
                'service_type' => 'plumbing',
                'service_label' => 'Sanitär / Badsanierung',
                'interval' => 'Einmalig',
                'note' => 'ueberdurchschnittlich teuer',
                'vendor' => $this->vendor('Sanitär Roth AG', 'Röhrenweg 4', '8032', 'Zürich', 'CHE-334.771.220'),
                'items' => [
                    ['label' => 'Demontage Altbestand und Entsorgung', 'unit' => 'pauschal', 'quantity' => 1, 'unit_price' => 2450.00],
                    ['label' => 'Neuinstallation Sanitärleitungen', 'unit' => 'lfm', 'quantity' => 42, 'unit_price' => 185.00],
                    ['label' => 'Montage Badkeramik und Armaturen', 'unit' => 'Std', 'quantity' => 36, 'unit_price' => 148.00],
                ],
            ],
            [
                'title' => 'Rechnung Bodenbelag Wohnungen',
                'service_type' => 'flooring',
                'service_label' => 'Bodenbeläge / Parkett',
                'interval' => 'Einmalig',
                'note' => 'auffaellig guenstig',
                'vendor' => $this->vendor('Bodenwerk Zürich', 'Parkettstrasse 17', '8005', 'Zürich', 'CHE-556.223.884'),
                'items' => [
                    ['label' => 'Parkett verlegen inkl. Unterlagsmatte', 'unit' => 'm2', 'quantity' => 210, 'unit_price' => 34.00],
                    ['label' => 'Sockelleisten montieren', 'unit' => 'lfm', 'quantity' => 96, 'unit_price' => 8.50],
                ],
            ],
            [
                'title' => 'Rechnung Reinigung Unterhaltsreinigung',
                'service_type' => 'cleaning',
                'service_label' => 'Reinigung / Unterhaltsreinigung Treppenhaus',
                'interval' => 'Monatlich',
                'note' => 'marktueblich, wiederkehrend',
                'vendor' => $this->vendor('Haustechnik Suter', 'Putzweg 3', '8006', 'Zürich', 'CHE-667.112.045'),
                'items' => [
                    ['label' => 'Unterhaltsreinigung Treppenhaus und Eingang', 'unit' => 'Monat', 'quantity' => 12, 'unit_price' => 285.00],
                    ['label' => 'Grundreinigung Tiefgarage', 'unit' => 'pauschal', 'quantity' => 2, 'unit_price' => 690.00],
                ],
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    private function vendor(string $name, string $street, string $zip, string $city, string $vat): array
    {
        return [
            'name' => $name,
            'street' => $street,
            'zip' => $zip,
            'city' => $city,
            'vat' => $vat,
            'iban' => 'CH93 0076 2011 6238 5295 7',
        ];
    }
}
