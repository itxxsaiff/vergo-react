<?php

namespace App\Services;

use App\Models\Order;

class BidComparisonService
{
    public function build(Order $order): array
    {
        $bids = $order->bids->values();

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

        $rankings = $bids->map(function ($bid) use ($lowestAmount, $order) {
            $provider = $bid->serviceProvider;
            $priceScore = $lowestAmount > 0 ? max(0, 100 - (((float) $bid->amount - $lowestAmount) / $lowestAmount) * 100) : 100;
            $startDelayDays = $bid->estimated_start_date ? max(0, now()->startOfDay()->diffInDays($bid->estimated_start_date, false)) : 14;
            $durationDays = $bid->estimated_completion_date && $bid->estimated_start_date
                ? max(1, $bid->estimated_start_date->diffInDays($bid->estimated_completion_date))
                : 30;
            $availabilityScore = max(0, 100 - min(70, $startDelayDays * 8));
            $durationScore = max(0, 100 - min(60, ($durationDays - 1) * 3));
            $timelineScore = round(($availabilityScore * 0.65) + ($durationScore * 0.35), 2);

            $providerRating = (float) ($provider?->getAverageRatingValue() ?? 0);
            $ratingScore = round(min(100, max(0, ($providerRating / 5) * 100)), 2);

            $completedJobsCount = (int) ($provider?->getCompletedJobsCountValue() ?? 0);
            $historyScore = round(min(100, $completedJobsCount * 10), 2);

            $hasWorkedOnPropertyBefore = $provider
                ? $provider->hasWorkedOnPropertyBefore($order->property_id, $order->id)
                : false;
            $propertyExperienceScore = $hasWorkedOnPropertyBefore ? 100 : 35;

            $finalScore = round(
                ($priceScore * 0.4)
                + ($timelineScore * 0.25)
                + ($propertyExperienceScore * 0.15)
                + ($ratingScore * 0.1)
                + ($historyScore * 0.1),
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
                'timeline_score' => round($timelineScore, 2),
                'rating_score' => $ratingScore,
                'history_score' => $historyScore,
                'property_experience_score' => $propertyExperienceScore,
                'provider_rating' => $providerRating,
                'completed_jobs_count' => $completedJobsCount,
                'has_worked_on_property_before' => $hasWorkedOnPropertyBefore,
                'final_score' => $finalScore,
            ];
        })->sortByDesc('final_score')->values();

        $recommendedBid = $rankings->first();

        $summary = $recommendedBid
            ? sprintf(
                'Best current bid is %s at %s %s with a score of %s. Average bid amount is %s %s.',
                $recommendedBid['provider'] ?: 'Unknown provider',
                number_format((float) $recommendedBid['amount'], 2),
                $recommendedBid['currency'],
                number_format((float) $recommendedBid['final_score'], 2),
                number_format($averageAmount, 2),
                $recommendedBid['currency']
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
                'weights' => [
                    'price' => 40,
                    'timeline' => 25,
                    'property_experience' => 15,
                    'provider_rating' => 10,
                    'completed_history' => 10,
                ],
                'rankings' => $rankings->all(),
            ],
        ];
    }
}
