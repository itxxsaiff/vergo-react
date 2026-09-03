<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bid;
use App\Models\Order;
use App\Models\User;
use App\Services\NotificationService;
use App\Services\OfferAwardService;
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

    /**
     * The provider confirms an awarded job and work begins. Everyone else's
     * offer is closed off at the same moment.
     */
    public function acceptAward(Request $request, Order $order, OfferAwardService $award, NotificationService $notifications): JsonResponse
    {
        $bid = $this->awardedBid($request, $order);

        $award->providerAccept($bid);
        $notifications->sendProviderResponse($bid->fresh()->load(['order.property.owners', 'order.property.managerProfiles', 'serviceProvider']), 'accepted');

        return response()->json(['message' => 'Job accepted. You can start work.']);
    }

    /**
     * The provider turns the award down; the manager picks someone else.
     */
    public function declineAward(Request $request, Order $order, OfferAwardService $award, NotificationService $notifications): JsonResponse
    {
        $bid = $this->awardedBid($request, $order);

        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:2000'],
        ]);

        $award->providerDecline($bid, $validated['reason'] ?? null);
        $notifications->sendProviderResponse($bid->fresh()->load(['order.property.owners', 'order.property.managerProfiles', 'serviceProvider']), 'rejected');

        return response()->json(['message' => 'Job declined. The management has been informed.']);
    }

    /**
     * The provider abandons a job that had already started. A substantial
     * reason is required and is kept for the owner to review.
     */
    public function cancelAward(Request $request, Order $order, OfferAwardService $award, NotificationService $notifications): JsonResponse
    {
        $actor = $request->user();
        abort_unless($actor instanceof User && $actor->role?->name === 'provider', 403);

        $provider = $actor->serviceProvider;
        abort_unless($provider, 403);

        $bid = $order->bids()
            ->where('service_provider_id', $provider->id)
            ->whereIn('status', ['accepted', 'approved'])
            ->first();

        abort_unless($bid, 403, 'You have no running job on this order.');

        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:20', 'max:2000'],
        ], [
            'reason.min' => 'Please give a reason of at least 20 characters.',
            'reason.required' => 'Please state why you are cancelling this job.',
        ]);

        $award->providerCancel($bid->setRelation('serviceProvider', $provider), $validated['reason']);
        $notifications->sendProviderResponse($bid->fresh()->load(['order.property.owners', 'order.property.managerProfiles', 'serviceProvider']), 'rejected');

        return response()->json(['message' => 'Job cancelled. The management has been informed.']);
    }

    /**
     * The bid this provider was awarded and has not answered yet.
     */
    private function awardedBid(Request $request, Order $order): Bid
    {
        $actor = $request->user();
        abort_unless($actor instanceof User && $actor->role?->name === 'provider', 403);

        $provider = $actor->serviceProvider;
        abort_unless($provider, 403);

        $bid = $order->bids()
            ->where('service_provider_id', $provider->id)
            ->where('status', 'awarded_pending_acceptance')
            ->first();

        abort_unless($bid, 403, 'This order is not awaiting your acceptance.');

        return $bid->setRelation('serviceProvider', $provider);
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
