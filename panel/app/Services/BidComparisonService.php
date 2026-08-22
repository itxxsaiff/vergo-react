<?php

namespace App\Services;

use App\Models\AiAnalysisResult;
use App\Models\Bid;
use App\Models\Order;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class BidComparisonService
{
    public function build(Order $order): array
    {
        $bids = $order->bids
            ->reject(fn ($bid) => $this->isHiddenScopeSeedBid($bid))
            ->filter(fn ($bid) => is_numeric($bid->amount) && (float) $bid->amount > 0)
            ->values();
        $invoiceBenchmarks = $this->collectInvoiceBenchmarks($order);
        $invoiceBenchmarkAmount = $this->weightedBenchmarkAmount($invoiceBenchmarks);
        $historicalOrderBenchmarks = $this->collectHistoricalOrderBenchmarks($order);
        $historicalOrderBenchmarkAmount = $this->weightedBenchmarkAmount($historicalOrderBenchmarks);
        $standardBenchmarks = $invoiceBenchmarks
            ->merge($historicalOrderBenchmarks)
            ->sortByDesc('match_score')
            ->values();
        $standardBenchmarkAmount = $this->weightedBenchmarkAmount($standardBenchmarks);

        if ($bids->isEmpty()) {
            return [
                'summary' => 'No bids available yet for comparison.',
                'score' => 0,
                'comparison_data' => [
                    'recommended_bid_id' => null,
                    'average_amount' => null,
                    'lowest_amount' => null,
                    'highest_amount' => null,
                    'spread_percentage' => null,
                    'invoice_benchmark_amount' => $invoiceBenchmarkAmount,
                    'invoice_benchmark_source_count' => $invoiceBenchmarks->count(),
                    'invoice_benchmark_sources' => $invoiceBenchmarks->take(8)->values()->all(),
                    'historical_order_benchmark_amount' => $historicalOrderBenchmarkAmount,
                    'historical_order_benchmark_source_count' => $historicalOrderBenchmarks->count(),
                    'historical_order_benchmark_sources' => $historicalOrderBenchmarks->take(8)->values()->all(),
                    'standard_benchmark_amount' => $standardBenchmarkAmount,
                    'standard_benchmark_source_count' => $standardBenchmarks->count(),
                    'standard_benchmark_scope' => 'global_all_properties',
                    'standard_benchmark_sources' => $standardBenchmarks->take(8)->values()->all(),
                    'low_bid_threshold_percentage' => 20,
                    'rankings' => [],
                ],
            ];
        }

        $averageAmount = round((float) $bids->avg('amount'), 2);
        $lowestAmount = (float) $bids->min('amount');
        $highestAmount = (float) $bids->max('amount');
        $spreadPercentage = $lowestAmount > 0
            ? round((($highestAmount - $lowestAmount) / $lowestAmount) * 100, 2)
            : 0;
        $activeBenchmarkAmount = $standardBenchmarkAmount ?: $averageAmount;
        $benchmarkSource = $standardBenchmarkAmount ? 'historical_invoices_and_orders' : 'current_bid_average';

        $weights = $this->resolveWeights((string) $order->bid_priority);

        $rankings = $bids->map(function ($bid) use ($lowestAmount, $order, $weights, $activeBenchmarkAmount, $benchmarkSource) {
            $provider = $bid->serviceProvider;
            $relativePriceScore = $lowestAmount > 0 ? max(0, 100 - (((float) $bid->amount - $lowestAmount) / $lowestAmount) * 100) : 100;
            $benchmarkVariancePercentage = $activeBenchmarkAmount
                ? round((((float) $bid->amount - $activeBenchmarkAmount) / $activeBenchmarkAmount) * 100, 2)
                : null;
            $benchmarkPriceScore = $activeBenchmarkAmount
                ? $this->scoreAgainstPriceBenchmark((float) $bid->amount, $activeBenchmarkAmount)
                : null;
            $lowBidPenalty = $this->lowBidPenalty($benchmarkVariancePercentage);
            $priceScore = $benchmarkPriceScore !== null
                ? max(0, round((($relativePriceScore * 0.35) + ($benchmarkPriceScore * 0.65)) - $lowBidPenalty, 2))
                : round($relativePriceScore, 2);
            $startDelayDays = $bid->estimated_start_date ? max(0, now()->startOfDay()->diffInDays($bid->estimated_start_date, false)) : 14;
            $durationDays = $bid->estimated_completion_date && $bid->estimated_start_date
                ? max(1, $bid->estimated_start_date->diffInDays($bid->estimated_completion_date))
                : 30;
            $availabilityScore = max(0, 100 - min(70, $startDelayDays * 8));
            $durationScore = max(0, 100 - min(60, ($durationDays - 1) * 3));
            $timelineScore = round(($availabilityScore * 0.65) + ($durationScore * 0.35), 2);

            $providerRatingBreakdown = $provider?->getAverageRatingBreakdownValue() ?? [
                'communication' => null,
                'punctuality' => null,
                'quality' => null,
            ];
            $providerRating = (float) ($provider?->getAverageRatingValue() ?? 0);
            $ratingScore = round(min(100, max(0, ($providerRating / 5) * 100)), 2);

            $completedJobsCount = (int) ($provider?->getCompletedJobsCountValue() ?? 0);

            $hasWorkedOnPropertyBefore = $provider
                ? $provider->hasWorkedOnPropertyBefore($order->property_id, $order->id)
                : false;
            $propertyExperienceScore = $hasWorkedOnPropertyBefore ? 100 : 35;

            $finalScore = round(
                ($priceScore * ($weights['price'] / 100))
                + ($timelineScore * ($weights['timeline'] / 100))
                + ($propertyExperienceScore * ($weights['property_experience'] / 100))
                + ($ratingScore * ($weights['provider_rating'] / 100)),
                2
            );

            return [
                'bid_id' => $bid->id,
                'provider' => $bid->serviceProvider?->company_name,
                'amount' => (float) $bid->amount,
                'currency' => $bid->currency,
                'status' => $bid->status,
                'estimated_start_date' => $bid->estimated_start_date?->toDateString(),
                'estimated_completion_date' => $bid->estimated_completion_date?->toDateString(),
                'price_score' => round($priceScore, 2),
                'relative_price_score' => round($relativePriceScore, 2),
                'benchmark_price_score' => $benchmarkPriceScore,
                'price_benchmark_amount' => $activeBenchmarkAmount,
                'price_benchmark_source' => $benchmarkSource,
                'price_benchmark_variance_percentage' => $benchmarkVariancePercentage,
                'is_unreasonably_low' => $benchmarkVariancePercentage !== null && $benchmarkVariancePercentage <= -20,
                'low_bid_penalty_points' => $lowBidPenalty,
                'timeline_score' => round($timelineScore, 2),
                'rating_score' => $ratingScore,
                'property_experience_score' => $propertyExperienceScore,
                'provider_rating' => $providerRating,
                'provider_rating_breakdown' => $providerRatingBreakdown,
                'completed_jobs_count' => $completedJobsCount,
                'has_worked_on_property_before' => $hasWorkedOnPropertyBefore,
                'final_score' => $finalScore,
            ];
        })->sortByDesc('final_score')->values();

        $recommendedBid = $rankings->first();
        $lowBidFlags = $rankings->where('is_unreasonably_low', true)->values();

        $summary = $recommendedBid
            ? sprintf(
                'Best current bid is %s at %s %s with a score of %s. Average bid amount is %s %s.%s%s',
                $recommendedBid['provider'] ?: 'Unknown provider',
                number_format((float) $recommendedBid['amount'], 2),
                $recommendedBid['currency'],
                number_format((float) $recommendedBid['final_score'], 2),
                number_format($averageAmount, 2),
                $recommendedBid['currency'],
                $standardBenchmarkAmount
                    ? sprintf(' Standard benchmark is %s %s from %s analyzed invoice/order source(s).', number_format($standardBenchmarkAmount, 2), $recommendedBid['currency'], $standardBenchmarks->count())
                    : '',
                $lowBidFlags->isNotEmpty()
                    ? sprintf(' %s bid(s) are more than 20%% below the standard benchmark and were penalized.', $lowBidFlags->count())
                    : ''
            )
            : 'No bids available yet for comparison.';

        return [
            'summary' => $summary,
            'score' => $recommendedBid['final_score'] ?? 0,
            'comparison_data' => [
                'recommended_bid_id' => $recommendedBid['bid_id'] ?? null,
                'average_amount' => $averageAmount,
                'lowest_amount' => $lowestAmount,
                'highest_amount' => $highestAmount,
                'spread_percentage' => $spreadPercentage,
                'invoice_benchmark_amount' => $invoiceBenchmarkAmount,
                'invoice_benchmark_source_count' => $invoiceBenchmarks->count(),
                'invoice_benchmark_sources' => $invoiceBenchmarks->take(8)->values()->all(),
                'historical_order_benchmark_amount' => $historicalOrderBenchmarkAmount,
                'historical_order_benchmark_source_count' => $historicalOrderBenchmarks->count(),
                'historical_order_benchmark_sources' => $historicalOrderBenchmarks->take(8)->values()->all(),
                'standard_benchmark_amount' => $standardBenchmarkAmount,
                'standard_benchmark_source_count' => $standardBenchmarks->count(),
                'standard_benchmark_scope' => 'global_all_properties',
                'standard_benchmark_sources' => $standardBenchmarks->take(8)->values()->all(),
                'active_price_benchmark_amount' => $activeBenchmarkAmount,
                'active_price_benchmark_source' => $benchmarkSource,
                'low_bid_threshold_percentage' => 20,
                'low_bid_threshold_amount' => $activeBenchmarkAmount ? round($activeBenchmarkAmount * 0.8, 2) : null,
                'low_bid_count' => $lowBidFlags->count(),
                'weights' => $weights,
                'rankings' => $rankings->all(),
            ],
        ];
    }

    private function collectInvoiceBenchmarks(Order $order): Collection
    {
        $order->loadMissing([
            'documents.analysisResults.document',
            'property.documents.analysisResults.document',
        ]);

        $localResults = $order->documents
            ->flatMap(fn ($document) => $document->analysisResults)
            ->merge(
                $order->property
                    ? $order->property->documents
                        ->where('order_id', null)
                        ->flatMap(fn ($document) => $document->analysisResults)
                    : collect()
            );

        $allResults = AiAnalysisResult::query()
            ->whereNotNull('document_id')
            ->where('status', 'analyzed')
            ->with(['document:id,property_id,property_object_id,property_object_ids,type,title,service_type,trade_object,trade_activity'])
            ->latest()
            ->get();

        $serviceType = $order->service_type;
        $orderTradeObject = data_get($order->workflow_meta ?? [], 'detail_catalog.trade_object');
        $orderTradeActivity = data_get($order->workflow_meta ?? [], 'detail_catalog.trade_activity');
        $orderObjectIds = collect($order->property_object_ids ?? [])
            ->push($order->property_object_id)
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        return $localResults
            ->merge($allResults)
            ->unique('id')
            ->map(function ($result) use ($order, $serviceType, $orderTradeObject, $orderTradeActivity, $orderObjectIds) {
                $document = $result->document;
                $comparisonData = $result->comparison_data ?? [];
                $isInvoice = $document?->type === 'invoice'
                    || data_get($comparisonData, 'document_use_case') === 'historical_invoice_benchmark';

                if (! $document || ! $isInvoice) {
                    return null;
                }

                $amount = data_get($comparisonData, 'estimated_amount');

                if (! is_numeric($amount) || (float) $amount <= 0) {
                    return null;
                }

                $documentServiceType = $document->service_type ?: data_get($comparisonData, 'service_category');
                $serviceMatch = $this->serviceCategoriesMatch($serviceType, $documentServiceType)
                    || $this->serviceCategoriesMatch($serviceType, data_get($comparisonData, 'service_category'));

                if (! $serviceMatch) {
                    return null;
                }

                $sameProperty = (int) $document->property_id === (int) $order->property_id;
                $objectMatch = $this->documentMatchesOrderObjects($document, $orderObjectIds);
                $tradeObjectMatch = $this->textMatches($orderTradeObject, $document->trade_object);
                $tradeActivityMatch = $this->textMatches($orderTradeActivity, $document->trade_activity);

                $matchScore = 5;
                $matchScore += $sameProperty ? 3 : 0;
                $matchScore += $objectMatch ? 2 : 0;
                $matchScore += $tradeObjectMatch ? 2 : 0;
                $matchScore += $tradeActivityMatch ? 2 : 0;

                return [
                    'result_id' => $result->id,
                    'document_id' => $document->id,
                    'document_title' => $document->title,
                    'document_type' => $document->type,
                    'amount' => round((float) $amount, 2),
                    'currency' => data_get($comparisonData, 'currency', 'CHF'),
                    'service_category' => $documentServiceType,
                    'trade_object' => $document->trade_object,
                    'trade_activity' => $document->trade_activity,
                    'same_property' => $sameProperty,
                    'object_match' => $objectMatch,
                    'service_match' => $serviceMatch,
                    'trade_object_match' => $tradeObjectMatch,
                    'trade_activity_match' => $tradeActivityMatch,
                    'vendor_name' => data_get($comparisonData, 'entities.vendor_name'),
                    'invoice_date' => data_get($comparisonData, 'invoice_date'),
                    'benchmark_hint' => data_get($comparisonData, 'benchmark_hint'),
                    'match_score' => $matchScore,
                ];
            })
            ->filter()
            ->sortByDesc('match_score')
            ->take(25)
            ->values();
    }

    private function weightedBenchmarkAmount(Collection $benchmarks): ?float
    {
        if ($benchmarks->isEmpty()) {
            return null;
        }

        $weightTotal = (float) $benchmarks->sum(fn ($item) => max(1, (int) $item['match_score']));

        if ($weightTotal <= 0) {
            return round((float) $benchmarks->avg('amount'), 2);
        }

        $weightedTotal = $benchmarks->sum(fn ($item) => (float) $item['amount'] * max(1, (int) $item['match_score']));

        return round($weightedTotal / $weightTotal, 2);
    }

    private function collectHistoricalOrderBenchmarks(Order $order): Collection
    {
        $orderObjectIds = collect($order->property_object_ids ?? [])
            ->push($order->property_object_id)
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        return Bid::query()
            ->where('order_id', '!=', $order->id)
            ->whereIn('status', ['approved', 'accepted', 'completed'])
            ->whereNotNull('amount')
            ->where('amount', '>', 0)
            ->whereHas('order', fn ($query) => $query->where('service_type', $order->service_type))
            ->with([
                'order:id,title,property_id,property_object_id,property_object_ids,service_type',
                'serviceProvider:id,company_name',
            ])
            ->latest()
            ->get()
            ->reject(fn ($bid) => $this->isHiddenScopeSeedBid($bid))
            ->map(function ($bid) use ($order, $orderObjectIds) {
                $historicalOrder = $bid->order;

                if (! $historicalOrder || ! $this->serviceCategoriesMatch($order->service_type, $historicalOrder->service_type)) {
                    return null;
                }

                $sameProperty = (int) $historicalOrder->property_id === (int) $order->property_id;
                $objectMatch = $this->documentMatchesOrderObjects($historicalOrder, $orderObjectIds);
                $matchScore = 5 + ($sameProperty ? 3 : 0) + ($objectMatch ? 2 : 0);

                return [
                    'source_type' => 'historical_order',
                    'bid_id' => $bid->id,
                    'order_id' => $historicalOrder->id,
                    'order_title' => $historicalOrder->title,
                    'provider' => $bid->serviceProvider?->company_name,
                    'amount' => round((float) $bid->amount, 2),
                    'currency' => $bid->currency ?: 'CHF',
                    'service_category' => $historicalOrder->service_type,
                    'same_property' => $sameProperty,
                    'object_match' => $objectMatch,
                    'service_match' => true,
                    'match_score' => $matchScore,
                ];
            })
            ->filter()
            ->sortByDesc('match_score')
            ->take(25)
            ->values();
    }

    private function scoreAgainstPriceBenchmark(float $amount, float $benchmarkAmount): float
    {
        if ($benchmarkAmount <= 0) {
            return 100;
        }

        $variance = ($amount - $benchmarkAmount) / $benchmarkAmount;

        if ($variance > 0) {
            return round(max(0, 100 - ($variance * 180)), 2);
        }

        if ($variance <= -0.2) {
            return round(max(0, 70 - ((abs($variance) - 0.2) * 200)), 2);
        }

        return 100;
    }

    private function lowBidPenalty(?float $variancePercentage): float
    {
        if ($variancePercentage === null || $variancePercentage > -20) {
            return 0;
        }

        return round(min(45, 15 + ((abs($variancePercentage) - 20) * 0.75)), 2);
    }

    private function isHiddenScopeSeedBid(mixed $bid): bool
    {
        return (bool) data_get($bid->workflow_meta ?? [], 'quote_scope_seed');
    }

    private function serviceCategoriesMatch(?string $expected, ?string $actual): bool
    {
        $expected = Str::of((string) $expected)->lower()->trim()->value();
        $actual = Str::of((string) $actual)->lower()->trim()->value();

        if ($expected === '' || $actual === '') {
            return false;
        }

        // A document tagged with the trade group "maler" describes the same work
        // as an order stored as "painting"; normalise both before comparing.
        $expectedCanonical = \App\Models\ServiceProvider::normalizeServiceType($expected);
        $actualCanonical = \App\Models\ServiceProvider::normalizeServiceType($actual);

        if ($expectedCanonical === $actualCanonical) {
            return true;
        }

        return Str::contains($actual, $expected) || Str::contains($expected, $actual);
    }

    private function documentMatchesOrderObjects(mixed $document, Collection $orderObjectIds): bool
    {
        if ($orderObjectIds->isEmpty()) {
            return false;
        }

        $documentObjectIds = collect($document->property_object_ids ?? [])
            ->push($document->property_object_id)
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        return $documentObjectIds->intersect($orderObjectIds)->isNotEmpty();
    }

    private function textMatches(mixed $expected, mixed $actual): bool
    {
        $expected = Str::of((string) $expected)->lower()->trim()->value();
        $actual = Str::of((string) $actual)->lower()->trim()->value();

        if ($expected === '' || $actual === '') {
            return false;
        }

        return Str::contains($actual, $expected) || Str::contains($expected, $actual);
    }

    private function resolveWeights(string $priority): array
    {
        return match ($priority) {
            'fastest_turnaround' => [
                'price' => 20,
                'timeline' => 50,
                'property_experience' => 15,
                'provider_rating' => 15,
            ],
            'high_quality_materials' => [
                'price' => 20,
                'timeline' => 15,
                'property_experience' => 15,
                'provider_rating' => 50,
            ],
            default => [
                'price' => 40,
                'timeline' => 25,
                'property_experience' => 15,
                'provider_rating' => 20,
            ],
        };
    }
}
