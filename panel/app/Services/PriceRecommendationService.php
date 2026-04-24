<?php

namespace App\Services;

use App\Models\AiAnalysisResult;
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

        $bids = $order->bids->values();
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

        $historicalBenchmarks = $this->collectRelevantBenchmarks(
            serviceType: $order->service_type,
            propertySize: $order->property?->size,
            propertyId: $order->property_id,
            localResults: $documentAnalysisResults,
            preferredInterval: $this->resolvePreferredIntervalFromResults($documentAnalysisResults),
        );

        $estimatedAmounts = $historicalBenchmarks->pluck('amount')->values();
        $benchmarkAmount = $estimatedAmounts->isNotEmpty() ? round($estimatedAmounts->avg(), 2) : null;

        $recommendedBid = $bids->sortBy('amount')->first();
        $recommendedBidAmount = $recommendedBid ? (float) $recommendedBid->amount : null;

        if ($recommendedBidAmount === null && $benchmarkAmount === null) {
            return [
                'summary' => 'No bids or analyzed document benchmarks are available yet to compare price.',
                'score' => 0,
                'comparison_data' => [
                    'analysis_type' => 'price_recommendation',
                    'pricing_signal' => 'unknown',
                    'recommended_bid_id' => null,
                    'recommended_bid_amount' => null,
                    'benchmark_amount' => null,
                    'benchmark_source_count' => 0,
                    'document_amounts' => [],
                    'variance_percentage' => null,
                    'reasons' => ['Upload and analyze contracts or invoices, then compare bids again.'],
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
            $benchmarkAmount !== null ? sprintf('Average analyzed document benchmark is %s.', number_format($benchmarkAmount, 2)) : null,
            $recommendedBid ? sprintf('Lowest bid comes from %s at %s %s.', $recommendedBid->serviceProvider?->company_name ?: 'Unknown provider', number_format($recommendedBidAmount, 2), $recommendedBid->currency) : null,
            $variancePercentage !== null ? sprintf('Variance against benchmark is %s%%.', number_format($variancePercentage, 2)) : null,
            $historicalBenchmarks->isNotEmpty() ? sprintf('%s similar historical source(s) were used from invoices and contracts.', $historicalBenchmarks->count()) : null,
            $historicalBenchmarks->where('same_property', true)->isNotEmpty() ? 'Some benchmark sources are from the same property history.' : null,
            $historicalBenchmarks->where('size_match', true)->isNotEmpty() ? 'Benchmark includes similar property-size documents.' : null,
            $historicalBenchmarks->where('interval_match', true)->isNotEmpty() ? 'Benchmark includes similar service intervals.' : null,
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
                'document_amounts' => $estimatedAmounts->all(),
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

        $bids = $property->orders->flatMap->bids->values();
        $documentAnalysisResults = $property->documents
            ->flatMap->analysisResults
            ->filter(fn ($result) => $result->status === 'analyzed')
            ->values();

        $serviceType = $this->resolvePropertyServiceType($property, $documentAnalysisResults);
        $preferredInterval = $this->resolvePreferredIntervalFromResults($documentAnalysisResults);
        $historicalBenchmarks = $this->collectRelevantBenchmarks(
            serviceType: $serviceType,
            propertySize: $property->size,
            propertyId: $property->id,
            localResults: $documentAnalysisResults,
            preferredInterval: $preferredInterval,
        );

        $estimatedAmounts = $historicalBenchmarks->pluck('amount')->values();
        $benchmarkAmount = $estimatedAmounts->isNotEmpty() ? round($estimatedAmounts->avg(), 2) : null;

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
                    'reasons' => ['Upload and analyze property-level documents or collect bids from orders.'],
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
            $benchmarkAmount !== null ? sprintf('Average analyzed property benchmark is %s.', number_format($benchmarkAmount, 2)) : null,
            $lowestBid ? sprintf('Lowest property-linked bid is %s %s from %s.', number_format($lowestBidAmount, 2), $lowestBid->currency, $lowestBid->serviceProvider?->company_name ?: 'Unknown provider') : null,
            $variancePercentage !== null ? sprintf('Variance against the current benchmark is %s%%.', number_format($variancePercentage, 2)) : null,
            $historicalBenchmarks->isNotEmpty() ? sprintf('%s similar invoices/contracts were used for this benchmark.', $historicalBenchmarks->count()) : null,
            $historicalBenchmarks->where('same_property', true)->isNotEmpty() ? 'This property already has matching historical price evidence.' : null,
            $historicalBenchmarks->where('size_match', true)->isNotEmpty() ? 'Benchmark includes properties of similar size.' : null,
            $historicalBenchmarks->where('interval_match', true)->isNotEmpty() ? 'Benchmark includes similar service intervals.' : null,
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
            ->with(['document.property:id,size,city,country', 'document:id,property_id,type,title'])
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

                $resultServiceCategory = (string) data_get($comparisonData, 'service_category', '');
                $resultInterval = (string) data_get($comparisonData, 'service_interval', '');
                $resultPropertySize = $this->normalizeNumericValue(
                    data_get($comparisonData, 'property_size', $result->document?->property?->size)
                );

                $serviceMatch = $this->serviceCategoriesMatch($serviceType, $resultServiceCategory);
                $sizeMatch = $this->isPropertySizeSimilar($propertySize, $resultPropertySize);
                $intervalMatch = $this->serviceIntervalsMatch($preferredInterval, $resultInterval);
                $sameProperty = (int) ($result->document?->property_id ?? 0) === $propertyId;

                $matchScore = 0;
                $matchScore += $sameProperty ? 4 : 0;
                $matchScore += $serviceMatch ? 3 : 0;
                $matchScore += $sizeMatch ? 2 : 0;
                $matchScore += $intervalMatch ? 2 : 0;
                $matchScore += data_get($comparisonData, 'document_use_case') === 'historical_invoice_benchmark' ? 2 : 0;

                if (! $sameProperty && ! $serviceMatch && ! $sizeMatch) {
                    return null;
                }

                return [
                    'result_id' => $result->id,
                    'amount' => round((float) $amount, 2),
                    'currency' => data_get($comparisonData, 'currency', 'EUR'),
                    'service_category' => $resultServiceCategory ?: null,
                    'service_interval' => $resultInterval ?: null,
                    'document_type' => $result->document?->type,
                    'document_title' => $result->document?->title,
                    'property_id' => $result->document?->property_id,
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
}
