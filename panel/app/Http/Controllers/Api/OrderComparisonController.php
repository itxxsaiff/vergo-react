<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\OfferEvaluationService;
use App\Models\AiAnalysisResult;
use App\Models\Order;
use App\Models\PropertyManagerProfile;
use App\Models\User;
use App\Services\BidComparisonService;
use App\Services\PriceRecommendationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrderComparisonController extends Controller
{
    public function __invoke(Request $request, Order $order, BidComparisonService $comparisonService): JsonResponse
    {
        $this->authorizeOrderAccess($request->user(), $order);
        $this->abortIfBiddingStillOpen($order);

        $order->load(['property.owners', 'bids.serviceProvider']);

        $comparison = $comparisonService->build($order);

        $analysisResult = AiAnalysisResult::query()->create([
            'order_id' => $order->id,
            'property_id' => $order->property_id,
            'status' => 'completed',
            'score' => $comparison['score'],
            'summary' => $comparison['summary'],
            'comparison_data' => [
                ...$comparison['comparison_data'],
                'analysis_type' => 'bid_comparison',
            ],
        ]);

        return response()->json([
            'message' => 'Bid comparison completed.',
            'data' => [
                'analysis' => [
                    'id' => $analysisResult->id,
                    'status' => $analysisResult->status,
                    'score' => $analysisResult->score,
                    'summary' => $analysisResult->summary,
                    'comparison_data' => $analysisResult->comparison_data,
                    'created_at' => $analysisResult->created_at?->toDateTimeString(),
                ],
                'explanation' => [
                    'price_weight' => '40%',
                    'timeline_weight' => '25%',
                    'property_experience_weight' => '15%',
                    'provider_rating_weight' => '20%',
                    'rating_categories' => ['communication', 'punctuality', 'quality_of_work'],
                    'note' => 'Current comparison is hybrid rule-based scoring. It uses price, trade-matched uploaded invoice/order benchmarks, start/completion timing, prior property work, and provider ratings for communication, punctuality, and quality of work.',
                ],
            ],
        ]);
    }

    public function comparePrice(Request $request, Order $order, PriceRecommendationService $priceRecommendationService): JsonResponse
    {
        $this->authorizeOrderAccess($request->user(), $order);
        $this->abortIfBiddingStillOpen($order);

        $order->load([
            'property.owners',
            'property.documents.analysisResults',
            'documents.analysisResults',
            'bids.serviceProvider',
        ]);

        $recommendation = $priceRecommendationService->build($order);

        $analysisResult = AiAnalysisResult::query()->create([
            'order_id' => $order->id,
            'property_id' => $order->property_id,
            'status' => 'analyzed',
            'score' => $recommendation['score'],
            'summary' => $recommendation['summary'],
            'comparison_data' => $recommendation['comparison_data'],
        ]);

        return response()->json([
            'message' => 'Price recommendation completed.',
            'data' => [
                'analysis' => [
                    'id' => $analysisResult->id,
                    'status' => $analysisResult->status,
                    'score' => $analysisResult->score,
                    'summary' => $analysisResult->summary,
                    'comparison_data' => $analysisResult->comparison_data,
                    'created_at' => $analysisResult->created_at?->toDateTimeString(),
                ],
            ],
        ]);
    }

    private function authorizeOrderAccess(mixed $actor, Order $order): void
    {
        if ($actor instanceof User && $actor->role?->name === 'admin') {
            return;
        }

        if ($actor instanceof User && $actor->role?->name === 'owner') {
            abort_unless($order->property->owners()->where('users.id', $actor->id)->exists(), 403);
            return;
        }

        if ($actor instanceof PropertyManagerProfile) {
            abort_unless($actor->canAccessProperty($order->property_id), 403);
            return;
        }

        abort(403);
    }

    /**
     * Who may open the full evaluation: the owner of the property, Vergo admins
     * and employee power users. Never the property manager.
     */
    private function abortUnlessDetailedEvaluationAllowed(mixed $actor): void
    {
        if ($actor instanceof PropertyManagerProfile) {
            abort(403, 'The detailed offer evaluation is not available for property managers.');
        }

        $allowed = $actor instanceof User
            && (
                $actor->role?->name === 'admin'
                || $actor->role?->name === 'owner'
                || ($actor->role?->name === 'employee' && $actor->access_level === 'power_user')
            );

        abort_unless($allowed, 403, 'The detailed offer evaluation is not available for this account.');
    }

    private function abortIfBiddingStillOpen(Order $order): void
    {
        if ($order->isBiddingStillOpen()) {
            abort(422, 'Bid comparison is available only after the submission deadline has passed.');
        }
    }

    /**
     * Automated offer evaluation: scores every offer out of 100 and ranks them
     * per the functional description (price 60%, ratings 24%, schedule 11%,
     * property experience 5%).
     */
    public function evaluateOffers(Request $request, Order $order, OfferEvaluationService $evaluation): JsonResponse
    {
        $this->authorizeOrderAccess($request->user(), $order);
        // The detailed evaluation names every bidder and their per-category
        // scores. Owners and Vergo power users may see it; property managers
        // may not - they award from the sequential best-offer view instead.
        $this->abortUnlessDetailedEvaluationAllowed($request->user());
        // The ranking exposes every company and price, so it stays closed until
        // the deadline like the rest of the bid data.
        $this->abortIfBiddingStillOpen($order);

        return response()->json(['data' => $evaluation->evaluate($order)]);
    }
}
