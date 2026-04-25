<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AiAnalysisResult;
use App\Models\Property;
use App\Models\PropertyManagerProfile;
use App\Models\User;
use App\Services\PriceRecommendationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PropertyComparisonController extends Controller
{
    public function __invoke(Request $request, Property $property, PriceRecommendationService $priceRecommendationService): JsonResponse
    {
        $this->authorizePropertyAccess($request->user(), $property);

        $property->load([
            'owners',
            'orders.bids.serviceProvider',
            'documents.analysisResults',
        ]);

        $recommendation = $priceRecommendationService->buildForProperty($property);

        $analysisResult = AiAnalysisResult::query()->create([
            'property_id' => $property->id,
            'status' => 'analyzed',
            'score' => $recommendation['score'],
            'summary' => $recommendation['summary'],
            'comparison_data' => $recommendation['comparison_data'],
        ]);

        return response()->json([
            'message' => 'Property price recommendation completed.',
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

    private function authorizePropertyAccess(mixed $actor, Property $property): void
    {
        if ($actor instanceof User && in_array($actor->role?->name, ['admin', 'employee'], true)) {
            return;
        }

        if ($actor instanceof User && $actor->role?->name === 'owner') {
            abort_unless($property->owners()->where('users.id', $actor->id)->exists(), 403);
            return;
        }

        if ($actor instanceof PropertyManagerProfile) {
            abort_unless($actor->property_id === $property->id, 403);
            return;
        }

        abort(403);
    }
}
