<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\ProviderReview;
use App\Models\User;
use App\Services\ProviderRatingService;
use App\Services\VergoRankingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProviderRatingController extends Controller
{
    /**
     * Public, token-addressed: what the emailed rating button opens.
     * No login required - the token in the link is the authorisation.
     */
    public function show(Request $request, ProviderRatingService $ratingService): JsonResponse
    {
        $order = $this->resolveByToken($request);

        return response()->json([
            'data' => [
                'order_number' => $order->order_number,
                'title' => $order->title,
                'property' => $order->property?->title,
                'provider_name' => $order->approvedBid?->serviceProvider?->company_name,
                'already_rated' => $order->reviewed_at !== null,
                'reason_required_at_or_below' => 2,
            ],
        ]);
    }

    public function store(Request $request, ProviderRatingService $ratingService, VergoRankingService $rankingService): JsonResponse
    {
        $order = $this->resolveByToken($request);

        abort_if($order->reviewed_at !== null, 422, 'This order has already been rated.');

        $validated = $request->validate([
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'reason' => ['nullable', 'string', 'max:2000'],
        ]);

        $rating = (int) $validated['rating'];
        $reason = $validated['reason'] ?? null;

        // 1 or 2 stars must be explained; above that it is optional.
        if ($ratingService->reasonRequired($rating) && ! filled($reason)) {
            return response()->json([
                'message' => 'Please tell us briefly why you rated this job with '.$rating.' star(s).',
                'errors' => ['reason' => ['A reason is required for ratings of 1 or 2 stars.']],
            ], 422);
        }

        $ratingService->recordReview($order, $rating, $reason);

        if ($provider = $order->approvedBid?->serviceProvider) {
            $rankingService->recalculate($provider);
        }

        return response()->json(['message' => 'Thank you for your rating.']);
    }

    /**
     * Admin-only list of the individual confidential ratings.
     * Providers and other clients never see these.
     */
    public function adminIndex(Request $request): JsonResponse
    {
        $actor = $request->user();

        abort_unless(
            $actor instanceof User
            && ($actor->role?->name === 'admin'
                || ($actor->role?->name === 'employee' && $actor->access_level === 'power_user')),
            403
        );

        $reviews = ProviderReview::query()
            ->with(['serviceProvider:id,company_name,vergo_ranking_score', 'order:id,order_number,title'])
            ->whereNotNull('rating')
            ->latest()
            ->get()
            ->map(fn (ProviderReview $review): array => [
                'id' => $review->id,
                'rating' => $review->rating,
                'reason' => $review->comment,
                'company_name' => $review->serviceProvider?->company_name,
                'vergo_ranking_score' => $review->serviceProvider?->vergo_ranking_score,
                'order_number' => $review->order?->order_number,
                'order_title' => $review->order?->title,
                'created_at' => $review->created_at?->toDateTimeString(),
            ]);

        return response()->json(['data' => $reviews]);
    }

    private function resolveByToken(Request $request): Order
    {
        $token = (string) $request->input('token', $request->query('token'));

        abort_unless($token !== '', 422, 'A rating token is required.');

        return Order::query()
            ->with(['property:id,title', 'approvedBid.serviceProvider:id,company_name'])
            ->where('review_token', $token)
            ->firstOr(fn () => abort(404, 'This rating link is not valid.'));
    }
}
