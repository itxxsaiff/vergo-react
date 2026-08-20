<?php

namespace App\Services;

use App\Models\Bid;
use App\Models\Order;
use App\Models\ProviderReview;
use Illuminate\Support\Collection;

/**
 * Automated Offer Evaluation.
 *
 * Scores every offer on an order out of 100 points and ranks them, following
 * "Automated Offer Evaluation - Functional Description":
 *
 *   45  total price          (section 3)
 *   15  position plausibility(sections 4-13)
 *   12  property manager rating (section 14)
 *   12  VERGO supplier rating   (section 15)
 *   11  start / completion date (section 16)
 *    5  previous experience at the property (section 17)
 *
 * The cheapest offer does not automatically win: prices that are implausibly
 * low lose points in the same way as prices that are too high.
 */
class OfferEvaluationService
{
    public function __construct(private PriceRecommendationService $priceRecommendations)
    {
    }

    /**
     * @return array<string, mixed>
     */
    public function evaluate(Order $order): array
    {
        $order->loadMissing(['bids.serviceProvider', 'property']);
        $config = config('vergo_offer_evaluation');

        $offers = $order->bids
            ->reject(fn (Bid $bid): bool => (bool) data_get($bid->workflow_meta ?? [], 'quote_scope_seed'))
            ->filter(fn (Bid $bid): bool => is_numeric($bid->amount) && (float) $bid->amount > 0)
            ->values();

        if ($offers->isEmpty()) {
            return ['evaluated_at' => now()->toDateTimeString(), 'offers' => [], 'reference' => null];
        }

        $totals = $offers->map(fn (Bid $bid): float => (float) $bid->amount)->values();
        $historicalReference = $this->historicalReference($order);
        $reference = $this->blendedReference($totals, $historicalReference, $config);
        $positionIndex = $this->buildPositionIndex($offers, $config);
        $historyIndex = $this->buildHistoricalPositionIndex($order, $config);
        $tenderQuantities = $this->tenderQuantities($order);

        $results = $offers->map(function (Bid $bid) use ($order, $reference, $positionIndex, $historyIndex, $tenderQuantities, $config): array {
            $totalPrice = $this->scoreTotalPrice($bid, $reference, $config);
            $positions = $this->scorePositions($bid, $positionIndex, $config, $historyIndex, $tenderQuantities);
            $managerRating = $this->scoreManagerRating($bid, $config);
            $vergoRating = $this->scoreVergoRating($bid, $config);
            $schedule = $this->scoreSchedule($bid, $order, $config);
            $experience = $this->scorePropertyExperience($bid, $order, $config);

            $score = $totalPrice['points'] + $positions['points'] + $managerRating['points']
                + $vergoRating['points'] + $schedule['points'] + $experience['points'];

            return [
                'bid_id' => $bid->id,
                'company_name' => $bid->serviceProvider?->company_name,
                'amount' => (float) $bid->amount,
                'score' => round($score, 2),
                'categories' => [
                    'total_price' => $totalPrice,
                    'position_plausibility' => $positions,
                    'manager_rating' => $managerRating,
                    'vergo_rating' => $vergoRating,
                    'schedule' => $schedule,
                    'property_experience' => $experience,
                ],
                'anomalies' => $positions['anomalies'],
            ];
        })
        ->sortByDesc('score')
        ->values()
        ->map(function (array $result, int $index): array {
            $result['rank'] = $index + 1;

            return $result;
        });

        return [
            'evaluated_at' => now()->toDateTimeString(),
            'reference' => $reference + ['historical_position_groups' => count($historyIndex)],
            'offers' => $results->all(),
        ];
    }

    // ---------------------------------------------------------------- price

    /**
     * Peer median blended with historical comparable prices where they exist
     * (sections 9 and 11). The median is preferred over the average because it
     * is less affected by outliers.
     *
     * @param  Collection<int, float>  $totals
     * @param  array<string, mixed>  $config
     * @return array<string, mixed>
     */
    private function blendedReference(Collection $totals, ?float $historical, array $config): array
    {
        $median = $this->median($totals);
        $weight = (float) $config['total_price']['historical_weight'];

        $reference = $historical !== null && $historical > 0
            ? ($median * (1 - $weight)) + ($historical * $weight)
            : $median;

        return [
            'median' => round($median, 2),
            'average' => round($totals->avg(), 2),
            'historical' => $historical !== null ? round($historical, 2) : null,
            'reference_price' => round($reference, 2),
            'offer_count' => $totals->count(),
        ];
    }

    private function historicalReference(Order $order): ?float
    {
        $recommendation = $this->priceRecommendations->build($order);
        $amount = data_get($recommendation, 'comparison_data.active_price_benchmark_amount')
            ?? data_get($recommendation, 'comparison_data.benchmark_amount');

        return is_numeric($amount) && (float) $amount > 0 ? (float) $amount : null;
    }

    /**
     * Section 3: both the absolute CHF difference and the percentage
     * difference count. Small orders are driven by the CHF difference, large
     * orders by the percentage.
     *
     * @param  array<string, mixed>  $reference
     * @param  array<string, mixed>  $config
     * @return array<string, mixed>
     */
    private function scoreTotalPrice(Bid $bid, array $reference, array $config): array
    {
        $settings = $config['total_price'];
        $max = (float) $config['points']['total_price'];
        $referencePrice = (float) $reference['reference_price'];
        $amount = (float) $bid->amount;

        if ($referencePrice <= 0) {
            return $this->category($max * 0.7, $max, ['reason' => 'no_reference_price']);
        }

        $difference = $amount - $referencePrice;
        $percentDeviation = abs($difference) / $referencePrice;

        // 0 for a small order, 1 for a large one.
        $sizeWeight = $this->clamp(
            ($referencePrice - (float) $settings['small_order_threshold'])
            / max(1.0, (float) $settings['large_order_threshold'] - (float) $settings['small_order_threshold']),
            0.0,
            1.0,
        );

        // The percentage is the scale-free driver. On smaller orders it is
        // amplified, because there a modest CHF gap already matters
        // commercially; on large orders the percentage stands on its own.
        $emphasis = (1 - $sizeWeight) * (float) $settings['small_order_emphasis'];
        $combined = $percentDeviation * (1 + $emphasis);
        $points = $this->rangeScore($combined, $difference > 0, $max, $settings);

        return $this->category($points, $max, [
            'amount' => round($amount, 2),
            'reference_price' => round($referencePrice, 2),
            'difference_chf' => round($difference, 2),
            'difference_percent' => round($percentDeviation * 100, 2),
            'direction' => $difference > 0 ? 'above' : ($difference < 0 ? 'below' : 'at'),
            'size_weight' => round($sizeWeight, 2),
            'weighted_deviation' => round($combined, 4),
            'plausible' => $combined <= (float) $settings['plausible_band'],
        ]);
    }

    // ------------------------------------------------------------ positions

    /**
     * Groups comparable positions across all offers so each one can be scored
     * against its peers (section 4).
     *
     * @param  Collection<int, Bid>  $offers
     * @param  array<string, mixed>  $config
     * @return array<int, array<string, mixed>>
     */
    private function buildPositionIndex(Collection $offers, array $config): array
    {
        $groups = [];

        foreach ($offers as $bid) {
            foreach (($bid->line_items ?? []) as $item) {
                $unitPrice = $this->unitPrice($item);
                $quantity = (float) data_get($item, 'quantity', 0);

                if ($unitPrice === null) {
                    continue;
                }

                $key = $this->positionKey($item);
                $groups[$key] ??= ['unit_prices' => [], 'quantities' => [], 'label' => data_get($item, 'label')];
                $groups[$key]['unit_prices'][] = $unitPrice;
                $groups[$key]['quantities'][] = $quantity;
            }
        }

        foreach ($groups as $key => $group) {
            $unitPrices = collect($group['unit_prices']);
            $quantities = collect($group['quantities'])->filter(fn (float $q): bool => $q > 0);

            $groups[$key]['median_unit_price'] = $this->median($unitPrices);
            $groups[$key]['median_quantity'] = $quantities->isEmpty() ? null : $this->median($quantities);
            $groups[$key]['sample'] = $unitPrices->count();
        }

        return $groups;
    }

    /**
     * Section 9: historical unit prices for comparable positions, drawn from
     * awarded offers of the same trade within the history window. Positions on
     * the same property are treated as the closest comparison; more recent
     * data outweighs older data.
     *
     * @param  array<string, mixed>  $config
     * @return array<string, array<string, mixed>>
     */
    private function buildHistoricalPositionIndex(Order $order, array $config): array
    {
        $settings = $config['position'];
        $since = now()->subMonths((int) $settings['history_months']);

        $historicalBids = Bid::query()
            ->with('order:id,property_id,service_type,created_at')
            ->whereIn('status', ['approved', 'accepted', 'completed'])
            ->where('order_id', '!=', $order->id)
            ->whereNotNull('line_items')
            ->where('created_at', '>=', $since)
            ->whereHas('order', fn ($query) => $query->where('service_type', $order->service_type))
            ->latest()
            ->limit(500)
            ->get();

        $groups = [];

        foreach ($historicalBids as $bid) {
            // Same property is the most comparable reference of all.
            $sameProperty = $bid->order?->property_id === $order->property_id;

            foreach (($bid->line_items ?? []) as $item) {
                $unitPrice = $this->unitPrice($item);

                if ($unitPrice === null) {
                    continue;
                }

                $key = $this->positionKey($item);
                $groups[$key] ??= ['unit_prices' => [], 'quantities' => [], 'same_property' => false];
                $groups[$key]['unit_prices'][] = $unitPrice;

                $quantity = (float) data_get($item, 'quantity', 0);

                if ($quantity > 0) {
                    $groups[$key]['quantities'][] = $quantity;
                }

                $groups[$key]['same_property'] = $groups[$key]['same_property'] || $sameProperty;
            }
        }

        foreach ($groups as $key => $group) {
            $prices = collect($group['unit_prices']);
            $groups[$key]['median_unit_price'] = $this->median($prices);
            $groups[$key]['sample'] = $prices->count();
            $groups[$key]['median_quantity'] = collect($group['quantities'])->isEmpty()
                ? null
                : $this->median(collect($group['quantities']));
        }

        return $groups;
    }

    /**
     * Section 6: the quantities the property manager put out to tender.
     *
     * @return array<string, float>
     */
    private function tenderQuantities(Order $order): array
    {
        $quantities = [];

        foreach (($order->quote_items ?? []) as $item) {
            $quantity = (float) data_get($item, 'quantity', 0);

            if ($quantity > 0) {
                $quantities[$this->positionKey($item)] = $quantity;
            }
        }

        return $quantities;
    }

    /**
     * Sections 5-13: score each position, weight it by its share of the offer
     * total, and keep the reason for every anomaly so the result stays
     * transparent.
     *
     * @param  array<int, array<string, mixed>>  $index
     * @param  array<string, mixed>  $config
     * @return array<string, mixed>
     */
    private function scorePositions(Bid $bid, array $index, array $config, array $history = [], array $tenderQuantities = []): array
    {
        $settings = $config['position'];
        $max = (float) $config['points']['position_plausibility'];
        $items = collect($bid->line_items ?? []);
        $offerTotal = (float) $bid->amount;

        if ($items->isEmpty() || $offerTotal <= 0) {
            return $this->category($max * 0.7, $max, ['reason' => 'no_positions']) + ['anomalies' => []];
        }

        $anomalies = [];
        $weightedScore = 0.0;
        $weightTotal = 0.0;
        $breakdown = [];

        foreach ($items as $position => $item) {
            $key = $this->positionKey($item);
            $unitPrice = $this->unitPrice($item);
            $quantity = (float) data_get($item, 'quantity', 0);
            $positionTotal = $unitPrice !== null ? $unitPrice * $quantity : 0.0;
            // Section 13: financially significant positions weigh more.
            $weight = $offerTotal > 0 ? max($positionTotal / $offerTotal, 0.0001) : 0.0001;
            $peers = $index[$key] ?? null;
            $historical = $history[$key] ?? null;

            if ($unitPrice === null) {
                $anomalies[] = $this->anomaly($position, $item, 'missing_unit_price');
                $weightedScore += $weight * 0.7;
                $weightTotal += $weight;

                continue;
            }

            // Section 12: a stated position total that disagrees with
            // quantity x unit price.
            $statedTotal = data_get($item, 'total');

            if (is_numeric($statedTotal) && $quantity > 0) {
                $expected = $unitPrice * $quantity;

                if ($expected > 0 && abs((float) $statedTotal - $expected) / $expected > (float) $settings['total_mismatch_tolerance']) {
                    $anomalies[] = $this->anomaly($position, $item, 'implausible_position_total', [
                        'stated_total' => round((float) $statedTotal, 2),
                        'calculated_total' => round($expected, 2),
                    ]);
                }
            }

            // Section 12: the same service quoted in a different unit than the
            // comparable positions.
            $unitMismatch = $this->unitMismatch($item, $index);

            if ($unitMismatch !== null) {
                $anomalies[] = $this->anomaly($position, $item, 'inconsistent_unit', $unitMismatch);
            }

            $peerSample = (int) ($peers['sample'] ?? 0);
            $peerMedian = $peerSample >= 2 ? (float) $peers['median_unit_price'] : null;
            $historySample = (int) ($historical['sample'] ?? 0);
            $historyMedian = $historySample >= (int) $settings['history_min_sample']
                ? (float) $historical['median_unit_price']
                : null;

            if ($peerMedian === null && $historyMedian === null) {
                // Section 12: nothing comparable anywhere.
                $anomalies[] = $this->anomaly($position, $item, 'missing_comparable_position');
                $weightedScore += $weight * 0.7;
                $weightTotal += $weight;
                $breakdown[] = $this->positionBreakdown($position, $item, $unitPrice, null, null, null, $settings);

                continue;
            }

            // Section 9: blend the peer median with the historical reference.
            $reference = $this->blendPositionReference($peerMedian, $historyMedian, (float) $settings['history_weight']);
            $deviation = abs($unitPrice - $reference) / $reference;
            $score = $this->rangeScore($deviation, $unitPrice > $reference, 1.0, $settings);

            if ($peerMedian !== null && $deviation > (float) $settings['plausible_band']) {
                $anomalies[] = $this->anomaly(
                    $position,
                    $item,
                    $unitPrice > $reference ? 'unit_price_above_peers' : 'unit_price_below_peers',
                    ['unit_price' => round($unitPrice, 2), 'reference_unit_price' => round($reference, 2)],
                );
            }

            // Section 12: deviation against historical prices specifically.
            if ($historyMedian !== null && $historyMedian > 0) {
                $historyDeviation = abs($unitPrice - $historyMedian) / $historyMedian;

                if ($historyDeviation > (float) $settings['history_band']) {
                    $anomalies[] = $this->anomaly(
                        $position,
                        $item,
                        $unitPrice > $historyMedian ? 'unit_price_above_history' : 'unit_price_below_history',
                        ['unit_price' => round($unitPrice, 2), 'historical_unit_price' => round($historyMedian, 2)],
                    );
                }
            }

            // Section 6: quantity against peers, the tender, and history.
            $quantityReference = $peers['median_quantity']
                ?? $tenderQuantities[$key]
                ?? $historical['median_quantity']
                ?? null;

            if ($quantityReference && $quantityReference > 0 && $quantity > 0) {
                $quantityDeviation = abs($quantity - $quantityReference) / $quantityReference;

                if ($quantityDeviation > (float) $settings['quantity_band']) {
                    $score = max(0.0, $score - (float) $settings['quantity_penalty']);
                    $anomalies[] = $this->anomaly($position, $item, 'quantity_deviation', [
                        'quantity' => $quantity,
                        'reference_quantity' => round((float) $quantityReference, 2),
                        'source' => isset($peers['median_quantity']) ? 'peers'
                            : (isset($tenderQuantities[$key]) ? 'tender' : 'history'),
                    ]);

                    // Section 12: a low quantity paired with a high unit price
                    // (or the reverse) is an implausible combination.
                    if ($deviation > (float) $settings['plausible_band']
                        && (($quantity < $quantityReference) === ($unitPrice > $reference))) {
                        $anomalies[] = $this->anomaly($position, $item, 'implausible_quantity_price_combination');
                    }
                }
            }

            $weightedScore += $weight * $score;
            $weightTotal += $weight;
            $breakdown[] = $this->positionBreakdown($position, $item, $unitPrice, $reference, $peerMedian, $historyMedian, $settings);
        }

        $normalised = $weightTotal > 0 ? $weightedScore / $weightTotal : 0.7;

        return $this->category($normalised * $max, $max, [
            'position_count' => $items->count(),
            'anomaly_count' => count($anomalies),
            'positions' => $breakdown,
        ]) + ['anomalies' => $anomalies];
    }

    /**
     * Section 9: more comparable peer data leads, history adjusts it.
     */
    private function blendPositionReference(?float $peerMedian, ?float $historyMedian, float $historyWeight): float
    {
        if ($peerMedian === null) {
            return (float) $historyMedian;
        }

        if ($historyMedian === null) {
            return $peerMedian;
        }

        return ($peerMedian * (1 - $historyWeight)) + ($historyMedian * $historyWeight);
    }

    /**
     * Section 12: the same service quoted under a different unit than the
     * comparable positions in the other offers.
     *
     * @param  array<string, array<string, mixed>>  $index
     * @return array<string, mixed>|null
     */
    private function unitMismatch(mixed $item, array $index): ?array
    {
        $label = strtolower(trim((string) (data_get($item, 'code') ?: data_get($item, 'label'))));
        $unit = strtolower(trim((string) data_get($item, 'unit')));

        if ($label === '') {
            return null;
        }

        // Collect how often each unit is used for this service across the
        // offers, then only flag the position that departs from the dominant
        // unit - not every position on both sides of the mismatch.
        $unitSamples = [];

        foreach ($index as $key => $group) {
            [$otherLabel, $otherUnit] = array_pad(explode('|', $key), 2, '');

            if ($otherLabel === $label) {
                $unitSamples[$otherUnit] = ($unitSamples[$otherUnit] ?? 0) + (int) ($group['sample'] ?? 0);
            }
        }

        if (count($unitSamples) < 2) {
            return null;
        }

        arsort($unitSamples);
        $dominantUnit = (string) array_key_first($unitSamples);

        if ($dominantUnit === $unit || ($unitSamples[$unit] ?? 0) >= $unitSamples[$dominantUnit]) {
            return null;
        }

        return ['unit' => $unit, 'comparable_unit' => $dominantUnit];
    }

    /**
     * Section 11: the statistical reference values behind a position score.
     *
     * @param  array<string, mixed>  $settings
     * @return array<string, mixed>
     */
    private function positionBreakdown(
        int $position,
        mixed $item,
        float $unitPrice,
        ?float $reference,
        ?float $peerMedian,
        ?float $historyMedian,
        array $settings,
    ): array {
        $band = (float) $settings['plausible_band'];

        return [
            'position' => $position + 1,
            'label' => data_get($item, 'label'),
            'unit' => data_get($item, 'unit'),
            'quantity' => (float) data_get($item, 'quantity', 0),
            'unit_price' => round($unitPrice, 2),
            'median_unit_price' => $peerMedian !== null ? round($peerMedian, 2) : null,
            'historical_unit_price' => $historyMedian !== null ? round($historyMedian, 2) : null,
            'reference_unit_price' => $reference !== null ? round($reference, 2) : null,
            'lowest_plausible_unit_price' => $reference !== null ? round($reference * (1 - $band), 2) : null,
            'highest_plausible_unit_price' => $reference !== null ? round($reference * (1 + $band), 2) : null,
            'deviation_percent' => $reference !== null && $reference > 0
                ? round((($unitPrice - $reference) / $reference) * 100, 2)
                : null,
        ];
    }

    // -------------------------------------------------------------- ratings

    /**
     * Section 14: average manager rating pulled towards the prior when only a
     * few reviews exist, so a single 5-star review cannot outrank a long
     * track record.
     *
     * @param  array<string, mixed>  $config
     * @return array<string, mixed>
     */
    private function scoreManagerRating(Bid $bid, array $config): array
    {
        $max = (float) $config['points']['manager_rating'];
        $settings = $config['manager_rating'];

        $ratings = ProviderReview::query()
            ->where('service_provider_id', $bid->service_provider_id)
            ->whereNotNull('rating')
            ->pluck('rating');

        $count = $ratings->count();
        $prior = (float) $settings['prior_rating'];
        $k = (float) $settings['confidence_k'];

        $average = $count > 0 ? (float) $ratings->avg() : $prior;
        $adjusted = (($count * $average) + ($k * $prior)) / ($count + $k);

        return $this->category($max * $this->clamp(($adjusted - 1) / 4, 0.0, 1.0), $max, [
            'average' => $count > 0 ? round($average, 2) : null,
            'review_count' => $count,
            'confidence_adjusted' => round($adjusted, 2),
        ]);
    }

    /**
     * Section 15: the internal 0-100 VERGO supplier score, converted
     * proportionally. Kept separate from the manager rating.
     *
     * @param  array<string, mixed>  $config
     * @return array<string, mixed>
     */
    private function scoreVergoRating(Bid $bid, array $config): array
    {
        $max = (float) $config['points']['vergo_rating'];
        $score = $bid->serviceProvider?->vergo_ranking_score;

        if ($score === null) {
            return $this->category($max * 0.7, $max, ['vergo_score' => null, 'reason' => 'unranked']);
        }

        return $this->category($max * $this->clamp((float) $score / 100, 0.0, 1.0), $max, [
            'vergo_score' => round((float) $score, 2),
        ]);
    }

    // ------------------------------------------------------------- schedule

    /**
     * Section 16: meeting the requested completion date counts for more than
     * an early start.
     *
     * @param  array<string, mixed>  $config
     * @return array<string, mixed>
     */
    private function scoreSchedule(Bid $bid, Order $order, array $config): array
    {
        $settings = $config['schedule'];
        $max = (float) $config['points']['schedule'];
        $perDay = (float) $settings['penalty_per_day'];

        $requestedStart = $order->requested_at;
        $requestedCompletion = $order->due_date;

        $startPoints = $this->datePoints($bid->estimated_start_date, $requestedStart, (float) $settings['start_points'], $perDay);
        $completionPoints = $this->datePoints($bid->estimated_completion_date, $requestedCompletion, (float) $settings['completion_points'], $perDay);

        return $this->category($startPoints + $completionPoints, $max, [
            'start_points' => round($startPoints, 2),
            'completion_points' => round($completionPoints, 2),
            'offered_start' => $bid->estimated_start_date?->toDateString(),
            'offered_completion' => $bid->estimated_completion_date?->toDateString(),
            'requested_completion' => $requestedCompletion?->toDateString(),
        ]);
    }

    private function datePoints(?object $offered, ?object $requested, float $max, float $perDay): float
    {
        if (! $offered || ! $requested) {
            return $max * 0.7;
        }

        $daysLate = $requested->startOfDay()->diffInDays($offered->startOfDay(), false);

        return $daysLate <= 0 ? $max : max(0.0, $max - ($daysLate * $perDay));
    }

    /**
     * Section 17: deliberately small so established suppliers do not get an
     * excessive advantage over new ones.
     *
     * @param  array<string, mixed>  $config
     * @return array<string, mixed>
     */
    private function scorePropertyExperience(Bid $bid, Order $order, array $config): array
    {
        $max = (float) $config['points']['property_experience'];

        $worked = Bid::query()
            ->where('service_provider_id', $bid->service_provider_id)
            ->where('id', '!=', $bid->id)
            ->whereIn('status', ['approved', 'accepted', 'completed'])
            ->whereHas('order', fn ($query) => $query->where('property_id', $order->property_id))
            ->exists();

        return $this->category($worked ? $max : 0.0, $max, ['worked_before' => $worked]);
    }

    // --------------------------------------------------------------- helpers

    /**
     * Full points inside the plausible band, falling away on both sides.
     *
     * @param  array<string, mixed>  $settings
     */
    private function rangeScore(float $deviation, bool $isAbove, float $max, array $settings): float
    {
        $band = (float) $settings['plausible_band'];

        if ($deviation <= $band) {
            // Plausible prices keep (nearly) full points; a small gradient
            // still rewards the closer offer.
            $gradient = (float) ($settings['in_band_gradient'] ?? 0.0);

            return $max * (1 - ($gradient * ($band > 0 ? $deviation / $band : 0.0)));
        }

        $rate = $isAbove ? (float) $settings['over_rate'] : (float) $settings['under_rate'];

        return max(0.0, $max * (1 - ($rate * ($deviation - $band))));
    }

    private function unitPrice(mixed $item): ?float
    {
        $unitPrice = data_get($item, 'unit_price');

        if (is_numeric($unitPrice) && (float) $unitPrice > 0) {
            return (float) $unitPrice;
        }

        // Section 5: derive it when only the position total is given.
        $total = data_get($item, 'total');
        $quantity = (float) data_get($item, 'quantity', 0);

        if (is_numeric($total) && $quantity > 0) {
            return (float) $total / $quantity;
        }

        return null;
    }

    private function positionKey(mixed $item): string
    {
        $label = strtolower(trim((string) (data_get($item, 'code') ?: data_get($item, 'label') ?: 'position')));
        $unit = strtolower(trim((string) data_get($item, 'unit')));

        return preg_replace('/\s+/', ' ', $label).'|'.$unit;
    }

    /**
     * @param  array<string, mixed>  $context
     * @return array<string, mixed>
     */
    private function anomaly(int $position, mixed $item, string $reason, array $context = []): array
    {
        return array_merge([
            'position' => $position + 1,
            'label' => data_get($item, 'label'),
            'reason' => $reason,
        ], $context);
    }

    /**
     * @param  array<string, mixed>  $details
     * @return array<string, mixed>
     */
    private function category(float $points, float $max, array $details = []): array
    {
        return array_merge([
            'points' => round(min($points, $max), 2),
            'max_points' => $max,
        ], $details);
    }

    /**
     * @param  Collection<int, float>  $values
     */
    private function median(Collection $values): float
    {
        $sorted = $values->filter(fn ($v): bool => is_numeric($v))->map(fn ($v): float => (float) $v)->sort()->values();

        if ($sorted->isEmpty()) {
            return 0.0;
        }

        $count = $sorted->count();
        $middle = intdiv($count, 2);

        return $count % 2 === 0
            ? (($sorted[$middle - 1] + $sorted[$middle]) / 2)
            : $sorted[$middle];
    }

    private function clamp(float $value, float $min, float $max): float
    {
        return max($min, min($max, $value));
    }
}
