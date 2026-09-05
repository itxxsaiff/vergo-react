<?php

namespace App\Console\Commands;

use App\Models\Order;
use Illuminate\Console\Command;

/**
 * Explains, for a tender that was raised from a site inspection, why each
 * provider was or was not asked to re-price their quote.
 */
class DiagnoseQuoteCarryOver extends Command
{
    protected $signature = 'vergo:diagnose-carryover {order : Order number, e.g. VER-2609-00009}';

    protected $description = 'Show why each inspection quote was kept or sent back for re-pricing';

    public function handle(): int
    {
        $order = Order::query()->where('order_number', $this->argument('order'))->first();

        if (! $order) {
            $this->error('Order not found.');

            return self::FAILURE;
        }

        $items = $order->quote_items ?? [];
        $this->info("Order {$order->order_number} - {$order->title}");
        $this->line('Published positions: '.count($items));

        foreach ($items as $i => $item) {
            $this->line(sprintf(
                '  %d. %-28s source_bid_id = %s',
                $i + 1,
                (string) data_get($item, 'label'),
                var_export(data_get($item, 'source_bid_id'), true),
            ));
        }

        $sourceId = (int) data_get($order->workflow_meta ?? [], 'assignment.source_inspection_order_id');
        $this->line('Source inspection order id: '.($sourceId ?: 'MISSING'));

        if (! $sourceId) {
            return self::SUCCESS;
        }

        $inspection = Order::query()->find($sourceId);

        if (! $inspection) {
            $this->error('Source inspection order no longer exists.');

            return self::FAILURE;
        }

        $publishedSourceBidIds = collect($items)
            ->pluck('source_bid_id')
            ->map(fn ($id): int => (int) $id)
            ->filter()
            ->unique()
            ->values();

        $this->line('Distinct source bids in published scope: '
            .($publishedSourceBidIds->isEmpty() ? 'NONE' : $publishedSourceBidIds->implode(', ')));
        $this->newLine();

        foreach ($inspection->bids()->with('serviceProvider')->get() as $bid) {
            $own = count($bid->line_items ?? []);
            $seed = (bool) data_get($bid->workflow_meta ?? [], 'quote_scope_seed');
            $takenFromThisBid = collect($items)
                ->filter(fn ($item): bool => (int) data_get($item, 'source_bid_id') === $bid->id)
                ->count();
            $everyPublishedItemIsTheirs = $publishedSourceBidIds->count() === 1
                && $publishedSourceBidIds->first() === $bid->id;
            $matches = $own > 0 && $items !== [] && $everyPublishedItemIsTheirs && $takenFromThisBid === $own;

            $this->line(sprintf('bid #%d  %s', $bid->id, $bid->serviceProvider?->company_name ?? '?'));
            $this->line("   status              : {$bid->status}");
            $this->line('   quote_scope_seed    : '.($seed ? 'yes' : 'NO  <- not treated as an inspection quote'));
            $this->line("   positions they quoted: {$own}");
            $this->line("   of those, published : {$takenFromThisBid}");
            $this->line('   whole scope is theirs: '.($everyPublishedItemIsTheirs ? 'yes' : 'no'));
            $this->line('   => '.($matches
                ? 'KEEPS quote, receives NO email'
                : 'must RE-PRICE, receives the "scope changed" email'));
            $this->newLine();
        }

        return self::SUCCESS;
    }
}
