<?php

namespace App\Services;

use App\Models\Bid;
use App\Models\Order;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;

/**
 * Decides what happens to each inspection quote when the property manager
 * publishes a request for proposals.
 *
 * A provider that already priced the work only keeps their quote when the
 * published scope is *exactly* the set of items they contributed. Anything
 * else - a partial selection, or items mixed in from another provider - means
 * the volume they priced no longer matches the volume being tendered, so they
 * have to re-price before their quote counts.
 */
class QuoteScopeService
{
    /**
     * A request for proposals was generated as a NEW order from an inspection.
     * The inspection's quotes live on the old order, so they have to be carried
     * across explicitly.
     *
     * If every published item came from one provider and all of that provider's
     * items were taken, their quote moves over complete with prices and shows as
     * the first quote. Everyone else who quoted after the inspection is asked to
     * re-price the changed scope.
     *
     * @param  array<int, array<string, mixed>>  $publishedItems
     * @return array{preserved: ?Bid, requote: EloquentCollection<int, Bid>}
     */
    public function carryOverFromInspection(Order $newOrder, Order $inspection, array $publishedItems): array
    {
        $seedBids = $inspection->bids()
            ->with('serviceProvider')
            ->get()
            ->filter(fn (Bid $bid): bool => (bool) data_get($bid->workflow_meta ?? [], 'quote_scope_seed')
                || ! empty($bid->line_items))
            ->values();

        $publishedSourceBidIds = collect($publishedItems)
            ->pluck('source_bid_id')
            ->map(fn ($id): int => (int) $id)
            ->filter()
            ->unique()
            ->values();

        $preserved = null;
        $requote = new EloquentCollection();

        foreach ($seedBids as $bid) {
            if ($this->scopeMatchesBid($bid, $publishedItems, $publishedSourceBidIds)) {
                $preserved = $this->copyQuoteToOrder($bid, $newOrder);

                continue;
            }

            $requote->push($bid);
        }

        return ['preserved' => $preserved, 'requote' => $requote];
    }

    /**
     * Duplicates the provider's inspection quote onto the tender as a normal,
     * fully priced quote.
     */
    private function copyQuoteToOrder(Bid $sourceBid, Order $newOrder): Bid
    {
        $workflowMeta = $sourceBid->workflow_meta ?? [];

        unset($workflowMeta['quote_scope_seed'], $workflowMeta['requires_requote']);
        data_set($workflowMeta, 'carried_over_from_bid_id', $sourceBid->id);
        data_set($workflowMeta, 'carried_over_from_order_id', $sourceBid->order_id);
        data_set($workflowMeta, 'quote_preserved_from_inspection', true);

        return Bid::query()->updateOrCreate(
            [
                'order_id' => $newOrder->id,
                'service_provider_id' => $sourceBid->service_provider_id,
            ],
            [
                'assigned_provider_email' => $sourceBid->assigned_provider_email,
                'provider_reference' => $sourceBid->provider_reference,
                'amount' => $sourceBid->amount,
                'currency' => $sourceBid->currency ?: 'CHF',
                'line_items' => $sourceBid->line_items,
                'estimated_start_date' => $sourceBid->estimated_start_date,
                'estimated_completion_date' => $sourceBid->estimated_completion_date,
                'notes' => $sourceBid->notes,
                'workflow_meta' => $workflowMeta,
                'status' => 'submitted',
                'submitted_at' => $sourceBid->submitted_at ?? now(),
            ],
        );
    }

    /**
     * @param  array<int, array<string, mixed>>  $publishedItems
     * @return array{preserved: EloquentCollection<int, Bid>, requote: EloquentCollection<int, Bid>}
     */
    public function applyPublishedScope(Order $order, array $publishedItems): array
    {
        $seedBids = $order->bids()
            ->get()
            ->filter(fn (Bid $bid): bool => (bool) data_get($bid->workflow_meta ?? [], 'quote_scope_seed'))
            ->values();

        $publishedSourceBidIds = collect($publishedItems)
            ->pluck('source_bid_id')
            ->map(fn ($id): int => (int) $id)
            ->filter()
            ->unique()
            ->values();

        $preserved = new EloquentCollection();
        $requote = new EloquentCollection();

        foreach ($seedBids as $bid) {
            if ($this->scopeMatchesBid($bid, $publishedItems, $publishedSourceBidIds)) {
                $this->preserveQuote($bid);
                $preserved->push($bid);

                continue;
            }

            $this->requireRequote($bid, count($publishedItems));
            $requote->push($bid);
        }

        return ['preserved' => $preserved, 'requote' => $requote];
    }

    /**
     * True only when every published item came from this bid AND every item the
     * provider quoted made it into the published scope.
     *
     * @param  array<int, array<string, mixed>>  $publishedItems
     * @param  Collection<int, int>  $publishedSourceBidIds
     */
    private function scopeMatchesBid(Bid $bid, array $publishedItems, Collection $publishedSourceBidIds): bool
    {
        $ownItemCount = count($bid->line_items ?? []);

        if ($ownItemCount === 0 || $publishedItems === []) {
            return false;
        }

        $everyPublishedItemIsTheirs = $publishedSourceBidIds->count() === 1
            && $publishedSourceBidIds->first() === $bid->id;

        $selectedFromThisBid = collect($publishedItems)
            ->filter(fn ($item): bool => (int) data_get($item, 'source_bid_id') === $bid->id)
            ->count();

        return $everyPublishedItemIsTheirs && $selectedFromThisBid === $ownItemCount;
    }

    /**
     * The scope is unchanged for this provider: drop the seed flag so the quote
     * stops being price-hidden and shows up as a real quote straight away.
     */
    private function preserveQuote(Bid $bid): void
    {
        $workflowMeta = $bid->workflow_meta ?? [];

        unset($workflowMeta['quote_scope_seed']);
        data_set($workflowMeta, 'quote_preserved_from_inspection', true);
        data_set($workflowMeta, 'quote_preserved_at', now()->toDateTimeString());
        data_forget($workflowMeta, 'requires_requote');
        data_forget($workflowMeta, 'requote_reason');

        $bid->forceFill([
            'workflow_meta' => $workflowMeta,
            'status' => 'submitted',
            'submitted_at' => $bid->submitted_at ?? now(),
        ])->save();
    }

    /**
     * The tendered volume changed for this provider: keep their old prices
     * hidden and flag the bid so they are asked to quote again.
     */
    private function requireRequote(Bid $bid, int $publishedItemCount): void
    {
        $workflowMeta = $bid->workflow_meta ?? [];

        data_set($workflowMeta, 'quote_scope_seed', true);
        data_set($workflowMeta, 'requires_requote', true);
        data_set($workflowMeta, 'requote_requested_at', now()->toDateTimeString());
        data_set($workflowMeta, 'requote_item_count', $publishedItemCount);

        $bid->forceFill(['workflow_meta' => $workflowMeta])->save();
    }

    /**
     * Clear the re-quote flag once the provider has submitted new prices.
     */
    public function markRequoteCompleted(Bid $bid): void
    {
        $workflowMeta = $bid->workflow_meta ?? [];

        data_forget($workflowMeta, 'quote_scope_seed');
        data_forget($workflowMeta, 'requires_requote');
        data_forget($workflowMeta, 'requote_requested_at');
        data_forget($workflowMeta, 'requote_item_count');
        data_set($workflowMeta, 'requote_submitted_at', now()->toDateTimeString());

        $bid->forceFill(['workflow_meta' => $workflowMeta])->save();
    }
}
