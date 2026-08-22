<?php

namespace App\Services;

use App\Models\AiAnalysisResult;
use App\Models\Bid;
use App\Models\Order;
use App\Models\Property;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class PriceRecommendationService
{
    public function build(Order $order): array
    {
        $order->loadMissing([
            'bids.serviceProvider',
            'documents.analysisResults',
            'property.documents.analysisResults',
        ]);

        $bids = $order->bids
            ->reject(fn ($bid) => $this->isHiddenScopeSeedBid($bid))
            ->filter(fn ($bid) => is_numeric($bid->amount) && (float) $bid->amount > 0)
            ->values();
        $documentAnalysisResults = $order->documents
            ->flatMap(fn ($document) => $document->analysisResults)
            ->merge(
                $order->property
                    ? $order->property->documents
                        ->where('order_id', null)
                        ->flatMap(fn ($document) => $document->analysisResults)
                    : collect()
            )
            ->filter(fn ($result) => $result->status === 'analyzed')
            ->values();

        $documentBenchmarks = $this->collectRelevantBenchmarks(
            serviceType: $order->service_type,
            propertySize: $order->property?->size,
            propertyId: $order->property_id,
            localResults: $documentAnalysisResults,
            preferredInterval: $this->resolvePreferredIntervalFromResults($documentAnalysisResults),
        );
        $orderBenchmarks = $this->collectHistoricalOrderBenchmarks(
            serviceType: $order->service_type,
            propertySize: $order->property?->size,
            propertyId: $order->property_id,
            excludedOrderId: $order->id,
            orderObjectIds: $this->orderObjectIds($order),
        );
        $historicalBenchmarks = $documentBenchmarks
            ->merge($orderBenchmarks)
            ->sortByDesc('match_score')
            ->values();

        $estimatedAmounts = $historicalBenchmarks->pluck('amount')->values();
        $benchmarkAmount = $this->weightedBenchmarkAmount($historicalBenchmarks);
        $documentBenchmarkCount = $documentBenchmarks->count();
        $orderBenchmarkCount = $orderBenchmarks->count();

        $recommendedBid = $bids->sortBy('amount')->first();
        $recommendedBidAmount = $recommendedBid ? (float) $recommendedBid->amount : null;

        if ($recommendedBidAmount === null && $benchmarkAmount === null) {
            return [
                'summary' => 'No bids, analyzed document benchmarks, or completed order benchmarks are available yet to compare price.',
                'score' => 0,
                'comparison_data' => [
                    'analysis_type' => 'price_recommendation',
                    'pricing_signal' => 'unknown',
                    'recommended_bid_id' => null,
                    'recommended_bid_amount' => null,
                    'benchmark_amount' => null,
                    'benchmark_source_count' => 0,
                    'benchmark_scope' => 'global_all_properties',
                    'document_benchmark_source_count' => 0,
                    'historical_order_source_count' => 0,
                    'benchmark_amounts' => [],
                    'document_amounts' => [],
                    'variance_percentage' => null,
                    'reasons' => ['Upload and analyze contracts or invoices, or complete matching orders, then compare bids again.'],
                ],
            ];
        }

        $referenceAmount = $benchmarkAmount ?? ($bids->isNotEmpty() ? round((float) $bids->avg('amount'), 2) : null);
        $variancePercentage = ($referenceAmount && $recommendedBidAmount !== null)
            ? round((($recommendedBidAmount - $referenceAmount) / $referenceAmount) * 100, 2)
            : null;

        if ($variancePercentage === null) {
            $pricingSignal = 'unknown';
        } elseif ($variancePercentage > 10) {
            $pricingSignal = 'too_high';
        } elseif ($variancePercentage < -10) {
            $pricingSignal = 'too_low';
        } else {
            $pricingSignal = 'fair';
        }

        $reasons = collect([
            $benchmarkAmount !== null ? sprintf('Average benchmark from analyzed documents and completed orders is %s.', number_format($benchmarkAmount, 2)) : null,
            $recommendedBid ? sprintf('Lowest bid comes from %s at %s %s.', $recommendedBid->serviceProvider?->company_name ?: 'Unknown provider', number_format($recommendedBidAmount, 2), $recommendedBid->currency) : null,
            $variancePercentage !== null ? sprintf('Variance against benchmark is %s%%.', number_format($variancePercentage, 2)) : null,
            $historicalBenchmarks->isNotEmpty() ? sprintf('%s similar historical source(s) were used from analyzed documents and completed orders.', $historicalBenchmarks->count()) : null,
            $historicalBenchmarks->where('same_property', true)->isNotEmpty() ? 'Some benchmark sources are from the same property history.' : null,
            $historicalBenchmarks->where('size_match', true)->isNotEmpty() ? 'Benchmark includes similar property-size documents.' : null,
            $historicalBenchmarks->where('interval_match', true)->isNotEmpty() ? 'Benchmark includes similar service intervals.' : null,
            $orderBenchmarkCount > 0 ? sprintf('%s completed/awarded order(s) were used even without an uploaded invoice.', $orderBenchmarkCount) : null,
        ])->filter()->values()->all();

        $summary = match ($pricingSignal) {
            'too_high' => 'Current best bid appears above the analyzed benchmark range.',
            'too_low' => 'Current best bid appears below the analyzed benchmark range.',
            'fair' => 'Current best bid appears within the expected benchmark range.',
            default => 'Price recommendation could not be finalized yet.',
        };

        return [
            'summary' => $summary,
            'score' => $variancePercentage !== null ? max(0, round(100 - abs($variancePercentage), 2)) : 0,
            'comparison_data' => [
                'analysis_type' => 'price_recommendation',
                'pricing_signal' => $pricingSignal,
                'recommended_bid_id' => $recommendedBid?->id,
                'recommended_bid_amount' => $recommendedBidAmount,
                'recommended_bid_currency' => $recommendedBid?->currency,
                'benchmark_amount' => $benchmarkAmount,
                'benchmark_source_count' => $estimatedAmounts->count(),
                'benchmark_scope' => 'global_all_properties',
                'document_benchmark_source_count' => $documentBenchmarkCount,
                'historical_order_source_count' => $orderBenchmarkCount,
                'benchmark_amounts' => $estimatedAmounts->all(),
                'document_amounts' => $documentBenchmarks->pluck('amount')->values()->all(),
                'benchmark_sources' => $historicalBenchmarks->take(8)->values()->all(),
                'service_category' => $order->service_type,
                'service_interval' => $this->resolvePreferredIntervalFromResults($documentAnalysisResults),
                'variance_percentage' => $variancePercentage,
                'reasons' => $reasons,
            ],
        ];
    }

    public function buildForProperty(Property $property): array
    {
        $property->loadMissing([
            'orders.bids.serviceProvider',
            'documents.analysisResults',
        ]);

        $bids = $property->orders
            ->flatMap->bids
            ->reject(fn ($bid) => $this->isHiddenScopeSeedBid($bid))
            ->filter(fn ($bid) => is_numeric($bid->amount) && (float) $bid->amount > 0)
            ->values();
        $documentAnalysisResults = $property->documents
            ->flatMap->analysisResults
            ->filter(fn ($result) => $result->status === 'analyzed')
            ->values();

        $serviceType = $this->resolvePropertyServiceType($property, $documentAnalysisResults);
        $preferredInterval = $this->resolvePreferredIntervalFromResults($documentAnalysisResults);
        $documentBenchmarks = $this->collectRelevantBenchmarks(
            serviceType: $serviceType,
            propertySize: $property->size,
            propertyId: $property->id,
            localResults: $documentAnalysisResults,
            preferredInterval: $preferredInterval,
        );
        $orderBenchmarks = $this->collectHistoricalOrderBenchmarks(
            serviceType: $serviceType,
            propertySize: $property->size,
            propertyId: $property->id,
        );
        $historicalBenchmarks = $documentBenchmarks
            ->merge($orderBenchmarks)
            ->sortByDesc('match_score')
            ->values();

        $estimatedAmounts = $historicalBenchmarks->pluck('amount')->values();
        $benchmarkAmount = $this->weightedBenchmarkAmount($historicalBenchmarks);
        $documentBenchmarkCount = $documentBenchmarks->count();
        $orderBenchmarkCount = $orderBenchmarks->count();

        $lowestBid = $bids->sortBy('amount')->first();
        $lowestBidAmount = $lowestBid ? (float) $lowestBid->amount : null;

        if ($benchmarkAmount === null && $lowestBidAmount === null) {
            return [
                'summary' => 'No property benchmark or order bid data is available yet.',
                'score' => 0,
                'comparison_data' => [
                    'analysis_type' => 'property_price_recommendation',
                    'property_id' => $property->id,
                    'pricing_signal' => 'unknown',
                    'benchmark_amount' => null,
                    'lowest_bid_amount' => null,
                    'variance_percentage' => null,
                    'orders_count' => $property->orders->count(),
                    'document_count' => $property->documents->count(),
                    'benchmark_source_count' => 0,
                    'benchmark_scope' => 'global_all_properties',
                    'document_benchmark_source_count' => 0,
                    'historical_order_source_count' => 0,
                    'benchmark_amounts' => [],
                    'reasons' => ['Upload and analyze property-level documents or complete orders with awarded bids.'],
                ],
            ];
        }

        $referenceAmount = $benchmarkAmount ?? ($bids->isNotEmpty() ? round((float) $bids->avg('amount'), 2) : null);
        $variancePercentage = ($referenceAmount && $lowestBidAmount !== null)
            ? round((($lowestBidAmount - $referenceAmount) / $referenceAmount) * 100, 2)
            : null;

        if ($variancePercentage === null) {
            $pricingSignal = 'unknown';
        } elseif ($variancePercentage > 10) {
            $pricingSignal = 'too_high';
        } elseif ($variancePercentage < -10) {
            $pricingSignal = 'too_low';
        } else {
            $pricingSignal = 'fair';
        }

        $summary = match ($pricingSignal) {
            'too_high' => 'Property pricing currently looks above the analyzed benchmark range.',
            'too_low' => 'Property pricing currently looks below the analyzed benchmark range.',
            'fair' => 'Property pricing currently looks within the analyzed benchmark range.',
            default => 'Property pricing recommendation could not be finalized yet.',
        };

        $reasons = collect([
            $benchmarkAmount !== null ? sprintf('Average property benchmark from analyzed documents and completed orders is %s.', number_format($benchmarkAmount, 2)) : null,
            $lowestBid ? sprintf('Lowest property-linked bid is %s %s from %s.', number_format($lowestBidAmount, 2), $lowestBid->currency, $lowestBid->serviceProvider?->company_name ?: 'Unknown provider') : null,
            $variancePercentage !== null ? sprintf('Variance against the current benchmark is %s%%.', number_format($variancePercentage, 2)) : null,
            $historicalBenchmarks->isNotEmpty() ? sprintf('%s similar documents/orders were used for this benchmark.', $historicalBenchmarks->count()) : null,
            $historicalBenchmarks->where('same_property', true)->isNotEmpty() ? 'This property already has matching historical price evidence.' : null,
            $historicalBenchmarks->where('size_match', true)->isNotEmpty() ? 'Benchmark includes properties of similar size.' : null,
            $historicalBenchmarks->where('interval_match', true)->isNotEmpty() ? 'Benchmark includes similar service intervals.' : null,
            $orderBenchmarkCount > 0 ? sprintf('%s completed/awarded order(s) were used even without an uploaded invoice.', $orderBenchmarkCount) : null,
        ])->filter()->values()->all();

        return [
            'summary' => $summary,
            'score' => $variancePercentage !== null ? max(0, round(100 - abs($variancePercentage), 2)) : 0,
            'comparison_data' => [
                'analysis_type' => 'property_price_recommendation',
                'property_id' => $property->id,
                'pricing_signal' => $pricingSignal,
                'benchmark_amount' => $benchmarkAmount,
                'lowest_bid_amount' => $lowestBidAmount,
                'lowest_bid_currency' => $lowestBid?->currency,
                'variance_percentage' => $variancePercentage,
                'orders_count' => $property->orders->count(),
                'document_count' => $property->documents->count(),
                'benchmark_source_count' => $estimatedAmounts->count(),
                'benchmark_scope' => 'global_all_properties',
                'document_benchmark_source_count' => $documentBenchmarkCount,
                'historical_order_source_count' => $orderBenchmarkCount,
                'benchmark_amounts' => $estimatedAmounts->all(),
                'benchmark_sources' => $historicalBenchmarks->take(10)->values()->all(),
                'service_category' => $serviceType,
                'service_interval' => $preferredInterval,
                'estimated_savings' => $benchmarkAmount !== null && $lowestBidAmount !== null && $lowestBidAmount > $benchmarkAmount
                    ? round($lowestBidAmount - $benchmarkAmount, 2)
                    : null,
                'reasons' => $reasons,
            ],
        ];
    }

    private function collectRelevantBenchmarks(
        ?string $serviceType,
        mixed $propertySize,
        int $propertyId,
        Collection $localResults,
        ?string $preferredInterval = null,
    ): Collection {
        $allResults = AiAnalysisResult::query()
            ->whereNotNull('document_id')
            ->where('status', 'analyzed')
            ->with(['document.property:id,size,city,country', 'document:id,property_id,type,title,service_type,trade_object,trade_activity'])
            ->latest()
            ->get();

        return $localResults
            ->merge($allResults)
            ->unique('id')
            ->map(function ($result) use ($serviceType, $propertySize, $propertyId, $preferredInterval) {
                $comparisonData = $result->comparison_data ?? [];
                $amount = data_get($comparisonData, 'estimated_amount');

                if (! is_numeric($amount)) {
                    return null;
                }

                $document = $result->document;
                $resultServiceCategory = (string) (data_get($comparisonData, 'service_category') ?: $document?->service_type ?: '');
                $resultInterval = (string) data_get($comparisonData, 'service_interval', '');
                $resultPropertySize = $this->normalizeNumericValue(
                    data_get($comparisonData, 'property_size', $document?->property?->size)
                );

                $serviceMatch = $this->serviceCategoriesMatch($serviceType, $resultServiceCategory)
                    || $this->serviceCategoriesMatch($serviceType, $document?->service_type);
                $sizeMatch = $this->isPropertySizeSimilar($propertySize, $resultPropertySize);
                $intervalMatch = $this->serviceIntervalsMatch($preferredInterval, $resultInterval);
                $sameProperty = (int) ($document?->property_id ?? 0) === $propertyId;

                $matchScore = 0;
                $matchScore += $sameProperty ? 4 : 0;
                $matchScore += $serviceMatch ? 3 : 0;
                $matchScore += $sizeMatch ? 2 : 0;
                $matchScore += $intervalMatch ? 2 : 0;
                $matchScore += ($document?->type === 'invoice' || data_get($comparisonData, 'document_use_case') === 'historical_invoice_benchmark') ? 2 : 0;

                // Historical data must be filtered by trade: a bathroom
                // renovation on the same property is not a valid benchmark for a
                // painting job. Only fall back to the looser rule when the
                // document carries no trade information at all.
                $hasServiceInformation = $resultServiceCategory !== '' || filled($document?->service_type);

                if ($serviceType && $hasServiceInformation && ! $serviceMatch) {
                    return null;
                }

                if (! $sameProperty && ! $serviceMatch && ! $sizeMatch) {
                    return null;
                }

                return [
                    'source_type' => $document?->type === 'invoice' ? 'invoice_analysis' : 'document_analysis',
                    'result_id' => $result->id,
                    'amount' => round((float) $amount, 2),
                    'currency' => data_get($comparisonData, 'currency', 'CHF'),
                    'service_category' => $resultServiceCategory ?: null,
                    'document_service_type' => $document?->service_type,
                    'trade_object' => $document?->trade_object,
                    'trade_activity' => $document?->trade_activity,
                    'service_interval' => $resultInterval ?: null,
                    'document_type' => $document?->type,
                    'document_title' => $document?->title,
                    'property_id' => $document?->property_id,
                    'same_property' => $sameProperty,
                    'service_match' => $serviceMatch,
                    'size_match' => $sizeMatch,
                    'interval_match' => $intervalMatch,
                    'benchmark_hint' => data_get($comparisonData, 'benchmark_hint'),
                    'location' => data_get($comparisonData, 'location'),
                    'vendor_name' => data_get($comparisonData, 'entities.vendor_name'),
                    'invoice_date' => data_get($comparisonData, 'invoice_date'),
                    'match_score' => $matchScore,
                ];
            })
            ->filter()
            ->sortByDesc('match_score')
            ->take(25)
            ->values();
    }

    private function collectHistoricalOrderBenchmarks(
        ?string $serviceType,
        mixed $propertySize,
        int $propertyId,
        ?int $excludedOrderId = null,
        ?Collection $orderObjectIds = null,
    ): Collection {
        return Bid::query()
            ->whereIn('status', ['approved', 'accepted', 'completed'])
            ->whereNotNull('amount')
            ->where('amount', '>', 0)
            ->when($excludedOrderId, fn ($query) => $query->where('order_id', '!=', $excludedOrderId))
            ->whereHas('order', function ($query) use ($serviceType, $propertyId) {
                if ($serviceType) {
                    $query->where('service_type', $serviceType);
                    return;
                }

                $query->where('property_id', $propertyId);
            })
            ->with([
                'order:id,title,status,property_id,property_object_id,property_object_ids,service_type,due_date,completed_at',
                'order.property:id,size,city,country',
                'serviceProvider:id,company_name',
            ])
            ->latest()
            ->get()
            ->reject(fn ($bid) => $this->isHiddenScopeSeedBid($bid))
            ->map(function ($bid) use ($serviceType, $propertySize, $propertyId, $orderObjectIds) {
                $historicalOrder = $bid->order;

                if (! $historicalOrder) {
                    return null;
                }

                $sameProperty = (int) $historicalOrder->property_id === $propertyId;
                $serviceMatch = $this->serviceCategoriesMatch($serviceType, $historicalOrder->service_type);
                $sizeMatch = $this->isPropertySizeSimilar($propertySize, $historicalOrder->property?->size);
                $objectMatch = $orderObjectIds?->isNotEmpty()
                    ? $this->documentMatchesOrderObjects($historicalOrder, $orderObjectIds)
                    : false;

                if (! $sameProperty && ! $serviceMatch && ! $sizeMatch && ! $objectMatch) {
                    return null;
                }

                $matchScore = 0;
                $matchScore += $sameProperty ? 4 : 0;
                $matchScore += $serviceMatch ? 3 : 0;
                $matchScore += $objectMatch ? 2 : 0;
                $matchScore += $sizeMatch ? 2 : 0;
                $matchScore += $bid->status === 'completed' || $historicalOrder->status === 'completed' ? 2 : 1;

                return [
                    'source_type' => 'historical_order',
                    'bid_id' => $bid->id,
                    'order_id' => $historicalOrder->id,
                    'order_title' => $historicalOrder->title,
                    'amount' => round((float) $bid->amount, 2),
                    'currency' => $bid->currency ?: 'CHF',
                    'service_category' => $historicalOrder->service_type,
                    'provider' => $bid->serviceProvider?->company_name,
                    'property_id' => $historicalOrder->property_id,
                    'same_property' => $sameProperty,
                    'service_match' => $serviceMatch,
                    'size_match' => $sizeMatch,
                    'object_match' => $objectMatch,
                    'interval_match' => false,
                    'completed_at' => $historicalOrder->completed_at?->toDateTimeString(),
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

    private function resolvePropertyServiceType(Property $property, Collection $documentAnalysisResults): ?string
    {
        $documentCategory = $documentAnalysisResults
            ->map(fn ($result) => data_get($result->comparison_data, 'service_category'))
            ->filter()
            ->first();

        return $documentCategory ?: $property->orders->pluck('service_type')->filter()->first();
    }

    private function resolvePreferredIntervalFromResults(Collection $results): ?string
    {
        return $results
            ->map(fn ($result) => data_get($result->comparison_data, 'service_interval'))
            ->filter()
            ->first();
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

    private function serviceIntervalsMatch(?string $expected, ?string $actual): bool
    {
        $expected = Str::of((string) $expected)->lower()->trim()->value();
        $actual = Str::of((string) $actual)->lower()->trim()->value();

        if ($expected === '' || $actual === '') {
            return false;
        }

        return Str::contains($actual, $expected) || Str::contains($expected, $actual);
    }

    private function isPropertySizeSimilar(mixed $expected, mixed $actual): bool
    {
        $expectedSize = $this->normalizeNumericValue($expected);
        $actualSize = $this->normalizeNumericValue($actual);

        if ($expectedSize === null || $actualSize === null || $expectedSize <= 0 || $actualSize <= 0) {
            return false;
        }

        return abs($actualSize - $expectedSize) / $expectedSize <= 0.3;
    }

    private function normalizeNumericValue(mixed $value): ?float
    {
        if (is_numeric($value)) {
            return (float) $value;
        }

        if (! is_string($value)) {
            return null;
        }

        $normalized = preg_replace('/[^0-9.]/', '', $value);

        return is_numeric($normalized) ? (float) $normalized : null;
    }

    private function orderObjectIds(Order $order): Collection
    {
        return collect($order->property_object_ids ?? [])
            ->push($order->property_object_id)
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();
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

    private function isHiddenScopeSeedBid(mixed $bid): bool
    {
        return (bool) data_get($bid->workflow_meta ?? [], 'quote_scope_seed');
    }
}
