<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\User;
use App\Services\OrderCompletionService;
use App\Services\ProviderRatingService;
use App\Services\VergoRankingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrderCompletionController extends Controller
{
    /**
     * The provider marks the job finished. This closes the order, opens the
     * confidential rating window for the client, and returns the invoicing
     * summary the provider needs.
     */
    public function complete(
        Request $request,
        Order $order,
        OrderCompletionService $completionService,
        ProviderRatingService $ratingService,
        VergoRankingService $rankingService,
    ): JsonResponse {
        $bid = $this->authorizeProviderForOrder($request, $order);

        abort_unless(
            in_array($order->status, ['approved', 'in_progress'], true),
            422,
            'Only an awarded order can be marked as completed.'
        );

        $order = $completionService->markProviderCompleted($order);

        // Ask the client for the confidential rating straight away; reminders
        // follow every two days via vergo:rating-reminders.
        $ratingService->sendRatingRequest($order->load(['propertyManager', 'approvedBid.serviceProvider']));
        $rankingService->recalculate($bid->serviceProvider);

        return response()->json([
            'message' => 'Order marked as completed.',
            'data' => $completionService->buildSummary($order->fresh()),
        ]);
    }

    /**
     * The same summary on demand, so the provider can look it up again.
     */
    public function summary(Request $request, Order $order, OrderCompletionService $completionService): JsonResponse
    {
        $this->authorizeProviderForOrder($request, $order);

        return response()->json([
            'data' => $completionService->buildSummary($order),
        ]);
    }

    private function authorizeProviderForOrder(Request $request, Order $order)
    {
        $actor = $request->user();

        abort_unless($actor instanceof User && $actor->role?->name === 'provider', 403);

        $provider = $actor->serviceProvider;
        abort_unless($provider, 403);

        $bid = $order->bids()
            ->where('service_provider_id', $provider->id)
            ->whereIn('status', ['approved', 'accepted', 'completed'])
            ->first();

        abort_unless($bid, 403, 'This order is not awarded to your company.');

        return $bid->setRelation('serviceProvider', $provider);
    }
}
