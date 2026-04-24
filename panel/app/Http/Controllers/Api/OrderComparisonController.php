<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
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
                    'provider_rating_weight' => '10%',
                    'completed_history_weight' => '10%',
                    'note' => 'Current comparison is hybrid rule-based scoring. It now uses price, timing, prior property work, provider rating, and completed-job history.',
                ],
            ],
        ]);
    }

    public function comparePrice(Request $request, Order $order, PriceRecommendationService $priceRecommendationService): JsonResponse
    {
        $this->authorizeOrderAccess($request->user(), $order);

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
            abort_unless($order->property_id === $actor->property_id, 403);
            return;
        }

        abort(403);
    }
}
