<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\OrderCancelledMail;
use App\Models\Bid;
use App\Models\Order;
use App\Models\PropertyManagerProfile;
use App\Models\User;
use App\Services\BidDisclosureService;
use App\Services\DuplicateOrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class OrderLifecycleController extends Controller
{
    /**
     * Cancel a job. A reason is mandatory and every provider that already bid
     * is told the job is off, and why.
     */
    public function cancel(Request $request, Order $order): JsonResponse
    {
        $actor = $this->authorizeManagerSide($request, $order);

        abort_if($order->cancelled_at !== null, 422, 'This order has already been cancelled.');
        abort_if(
            in_array($order->status, ['completed', 'closed'], true),
            422,
            'A completed order can no longer be cancelled.'
        );

        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:5', 'max:2000'],
        ], [
            'reason.required' => 'Please state why this order is being cancelled.',
        ]);

        $order->forceFill([
            'status' => 'cancelled',
            'cancelled_at' => now(),
            'cancellation_reason' => $validated['reason'],
            'cancelled_by_type' => $actor instanceof PropertyManagerProfile ? 'manager' : 'user',
            'cancelled_by_id' => $actor->id,
        ])->save();

        $this->notifyProviders($order, $validated['reason']);

        return response()->json([
            'message' => 'Order cancelled and all bidders informed.',
            'data' => ['cancelled_at' => $order->cancelled_at?->toDateTimeString()],
        ]);
    }

    /**
     * Called before publishing: warns the manager when this job looks like a
     * re-raised cancelled order, or like one of several near-identical orders
     * on the same property.
     */
    public function duplicateCheck(Request $request, Order $order, DuplicateOrderService $duplicates): JsonResponse
    {
        $this->authorizeManagerSide($request, $order);

        $matches = $duplicates->findDuplicates($order);

        return response()->json([
            'data' => [
                'requires_explanation' => $matches !== [],
                'matches' => $matches,
            ],
        ]);
    }

    /**
     * Records the mandatory explanation and links the order to the one it
     * duplicates, so the owner can review it later.
     */
    public function acknowledgeDuplicate(Request $request, Order $order): JsonResponse
    {
        $this->authorizeManagerSide($request, $order);

        $validated = $request->validate([
            'duplicate_of_order_id' => ['required', 'integer', 'exists:orders,id'],
            'similarity' => ['nullable', 'numeric', 'min:0', 'max:1'],
            'reason' => ['nullable', 'string', 'max:32'],
            'explanation' => ['required', 'string', 'min:5', 'max:2000'],
        ], [
            'explanation.required' => 'Please explain why this is a separate order.',
        ]);

        $order->forceFill([
            'duplicate_of_order_id' => $validated['duplicate_of_order_id'],
            'duplicate_similarity' => $validated['similarity'] ?? null,
            'duplicate_reason' => $validated['reason'] ?? null,
            'duplicate_explanation' => $validated['explanation'],
            'duplicate_acknowledged_at' => now(),
        ])->save();

        return response()->json(['message' => 'Explanation recorded.']);
    }

    /**
     * The offer currently open for a decision, plus how many stay locked.
     */
    public function disclosure(Request $request, Order $order, BidDisclosureService $disclosure): JsonResponse
    {
        $this->authorizeManagerSide($request, $order);

        return response()->json(['data' => $disclosure->build($order)]);
    }

    /**
     * Reject the open offer with a reason, which unlocks the next-ranked one.
     */
    public function rejectBid(Request $request, Order $order, Bid $bid, BidDisclosureService $disclosure): JsonResponse
    {
        $this->authorizeManagerSide($request, $order);
        abort_unless($bid->order_id === $order->id, 404);

        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:5', 'max:2000'],
        ], [
            'reason.required' => 'Please state why this offer is being rejected.',
        ]);

        $disclosure->reject($order, $bid, $validated['reason']);

        return response()->json([
            'message' => 'Offer rejected. The next-ranked offer is now available.',
            'data' => $disclosure->build($order->fresh()),
        ]);
    }

    private function notifyProviders(Order $order, string $reason): void
    {
        $bids = $order->bids()->with('serviceProvider')->get();

        foreach ($bids as $bid) {
            $provider = $bid->serviceProvider;
            $email = $bid->assigned_provider_email ?: $provider?->order_email;

            if (! $provider || ! $email) {
                continue;
            }

            try {
                Mail::mailer('orders')->to($email)->send(new OrderCancelledMail($order, $provider, $reason));
            } catch (\Throwable $exception) {
                Log::error('Vergo order cancellation email failed', [
                    'order_id' => $order->id,
                    'provider_id' => $provider->id,
                    'error' => $exception->getMessage(),
                ]);
            }
        }
    }

    private function authorizeManagerSide(Request $request, Order $order)
    {
        $actor = $request->user();

        if ($actor instanceof PropertyManagerProfile) {
            abort_unless($actor->canAccessProperty($order->property_id), 403);

            return $actor;
        }

        abort_unless(
            $actor instanceof User && in_array($actor->role?->name, ['admin', 'owner', 'employee'], true),
            403
        );

        return $actor;
    }
}
