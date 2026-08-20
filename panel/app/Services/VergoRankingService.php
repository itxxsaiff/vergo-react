<?php

namespace App\Services;

use App\Models\Bid;
use App\Models\Order;
use App\Models\PriceChangeRequest;
use App\Models\ProviderReview;
use App\Models\ServiceProvider;

/**
 * Computes the internal VERGO ranking for a service provider.
 *
 * Factors are the ones named by the client: did they start on time, did they
 * finish on time, did the final price match the quoted price, and what did the
 * confidential 1-5 star ratings say. Self-initiated price changes and added
 * items pull the score down.
 *
 * Weighting lives in config/vergo_ranking.php and still needs to be confirmed
 * against the client's ranking document.
 */
class VergoRankingService
{
    public function recalculateAll(): int
    {
        $count = 0;

        ServiceProvider::query()->each(function (ServiceProvider $provider) use (&$count): void {
            $this->recalculate($provider);
            $count++;
        });

        return $count;
    }

    public function recalculate(ServiceProvider $provider): ServiceProvider
    {
        $breakdown = $this->buildBreakdown($provider);

        $provider->forceFill([
            'vergo_ranking_score' => $breakdown['score'],
            'vergo_ranking_breakdown' => $breakdown,
            'vergo_ranking_updated_at' => now(),
        ])->save();

        return $provider;
    }

    /**
     * @return array<string, mixed>
     */
    public function buildBreakdown(ServiceProvider $provider): array
    {
        $config = config('vergo_ranking');
        $awardedBids = $this->awardedBids($provider);
        $completedOrders = $awardedBids
            ->map(fn (Bid $bid) => $bid->order)
            ->filter(fn (?Order $order): bool => $order !== null && $order->status === 'completed')
            ->values();

        if ($completedOrders->count() < (int) $config['minimum_completed_orders']) {
            return [
                'score' => null,
                'ranked' => false,
                'reason' => 'not_enough_completed_orders',
                'completed_orders' => $completedOrders->count(),
                'factors' => [],
                'penalties' => [],
            ];
        }

        $factors = [
            'rating' => $this->ratingFactor($provider),
            'on_time_start' => $this->onTimeStartFactor($awardedBids),
            'on_time_completion' => $this->onTimeCompletionFactor($awardedBids),
            'price_accuracy' => $this->priceAccuracyFactor($awardedBids),
        ];

        $score = 0.0;

        foreach ($config['weights'] as $key => $weight) {
            $value = $factors[$key]['value'] ?? $config['neutral_factor_value'];
            $score += $weight * $value;
        }

        $penalties = $this->penalties($provider, $config);
        $score = max(0.0, min(100.0, $score - $penalties['total']));

        return [
            'score' => round($score, 2),
            'ranked' => true,
            'completed_orders' => $completedOrders->count(),
            'factors' => $factors,
            'penalties' => $penalties,
            'weights' => $config['weights'],
            'calculated_at' => now()->toDateTimeString(),
        ];
    }

    /**
     * @return \Illuminate\Support\Collection<int, Bid>
     */
    private function awardedBids(ServiceProvider $provider)
    {
        return Bid::query()
            ->with('order')
            ->where('service_provider_id', $provider->id)
            ->whereIn('status', ['approved', 'accepted', 'completed'])
            ->get();
    }

    /**
     * Confidential star ratings, normalised from 1-5 onto 0-1.
     *
     * @return array<string, mixed>
     */
    private function ratingFactor(ServiceProvider $provider): array
    {
        $ratings = ProviderReview::query()
            ->where('service_provider_id', $provider->id)
            ->whereNotNull('rating')
            ->pluck('rating');

        if ($ratings->isEmpty()) {
            return ['value' => config('vergo_ranking.neutral_factor_value'), 'sample' => 0, 'average' => null];
        }

        $average = (float) $ratings->avg();

        return [
            'value' => max(0.0, min(1.0, ($average - 1) / 4)),
            'sample' => $ratings->count(),
            'average' => round($average, 2),
        ];
    }

    /**
     * @param  \Illuminate\Support\Collection<int, Bid>  $bids
     * @return array<string, mixed>
     */
    private function onTimeStartFactor($bids): array
    {
        return $this->ratioFactor($bids, function (Bid $bid): ?bool {
            $promised = $bid->estimated_start_date;
            $actual = $bid->order?->workflow_meta['execution']['started_at'] ?? null;

            if (! $promised || ! $actual) {
                return null;
            }

            return \Illuminate\Support\Carbon::parse($actual)->startOfDay()->lte($promised->startOfDay());
        });
    }

    /**
     * @param  \Illuminate\Support\Collection<int, Bid>  $bids
     * @return array<string, mixed>
     */
    private function onTimeCompletionFactor($bids): array
    {
        return $this->ratioFactor($bids, function (Bid $bid): ?bool {
            $promised = $bid->estimated_completion_date;
            $actual = $bid->order?->provider_completed_at ?? $bid->order?->completed_at;

            if (! $promised || ! $actual) {
                return null;
            }

            return $actual->startOfDay()->lte($promised->startOfDay());
        });
    }

    /**
     * Did the final price match what was quoted?
     *
     * @param  \Illuminate\Support\Collection<int, Bid>  $bids
     * @return array<string, mixed>
     */
    private function priceAccuracyFactor($bids): array
    {
        $tolerance = (float) config('vergo_ranking.price_tolerance');

        return $this->ratioFactor($bids, function (Bid $bid) use ($tolerance): ?bool {
            $quoted = (float) ($bid->amount ?? 0);

            if ($quoted <= 0) {
                return null;
            }

            $approvedChange = PriceChangeRequest::query()
                ->where('bid_id', $bid->id)
                ->where('status', 'approved')
                ->latest('decided_at')
                ->first();

            if (! $approvedChange || $approvedChange->requested_amount === null) {
                return true;
            }

            $final = (float) $approvedChange->requested_amount;

            return abs($final - $quoted) <= ($quoted * $tolerance);
        });
    }

    /**
     * Share of bids where the predicate held, ignoring bids with no data.
     *
     * @param  \Illuminate\Support\Collection<int, Bid>  $bids
     * @return array<string, mixed>
     */
    private function ratioFactor($bids, callable $predicate): array
    {
        $evaluated = $bids->map($predicate)->filter(fn ($result): bool => $result !== null)->values();

        if ($evaluated->isEmpty()) {
            return ['value' => config('vergo_ranking.neutral_factor_value'), 'sample' => 0, 'hits' => 0];
        }

        $hits = $evaluated->filter(fn (bool $ok): bool => $ok)->count();

        return [
            'value' => $hits / $evaluated->count(),
            'sample' => $evaluated->count(),
            'hits' => $hits,
        ];
    }

    /**
     * Self-initiated price changes and added items reduce the score.
     *
     * @param  array<string, mixed>  $config
     * @return array<string, mixed>
     */
    private function penalties(ServiceProvider $provider, array $config): array
    {
        $requests = PriceChangeRequest::query()
            ->where('service_provider_id', $provider->id)
            ->where('status', 'approved')
            ->get();

        $addedItems = $requests->sum(
            fn (PriceChangeRequest $request): int => collect($request->items ?? [])
                ->filter(fn ($item): bool => data_get($item, 'change_type') === 'added')
                ->count()
        );

        $total = ($requests->count() * (float) $config['penalties']['price_change_request'])
            + ($addedItems * (float) $config['penalties']['added_item']);

        $total = min($total, (float) $config['penalties']['max_penalty']);

        return [
            'price_change_requests' => $requests->count(),
            'added_items' => $addedItems,
            'total' => round($total, 2),
        ];
    }
}
