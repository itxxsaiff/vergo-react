<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\InspectionNoShowMail;
use App\Mail\OrderCancelledMail;
use App\Models\Bid;
use App\Models\Order;
use App\Models\PropertyManagerProfile;
use App\Models\User;
use App\Services\BidDisclosureService;
use App\Services\DuplicateOrderService;
use App\Services\NotificationService as NotificationServiceAlias;
use App\Services\OfferAwardService;
use App\Services\VergoRankingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class OrderLifecycleController extends Controller
{
    /** An appointment can only be flagged this long after it started. */
    private const NO_SHOW_GRACE_MINUTES = 30;

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
        $this->abortIfBiddingStillOpen($order);

        return response()->json(['data' => $disclosure->build($order)]);
    }

    /**
     * Reject the open offer with a reason, which unlocks the next-ranked one.
     */
    public function rejectBid(Request $request, Order $order, Bid $bid, BidDisclosureService $disclosure): JsonResponse
    {
        $this->authorizeManagerSide($request, $order);
        $this->abortIfBiddingStillOpen($order);
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

    /**
     * The manager records that a provider did not attend the inspection they
     * confirmed. Only allowed once the appointment is at least half an hour in
     * the past, which is also enforced in the UI.
     */
    public function reportNoShow(Request $request, Order $order, Bid $bid, VergoRankingService $ranking): JsonResponse
    {
        $this->authorizeManagerSide($request, $order);
        abort_unless($bid->order_id === $order->id, 404);
        abort_if($bid->no_show_at !== null, 422, 'This appointment is already marked as not attended.');

        $slot = $this->confirmedSlot($order, $bid);
        abort_unless($slot, 422, 'This provider has no confirmed appointment.');

        abort_unless(
            $slot->copy()->addMinutes(self::NO_SHOW_GRACE_MINUTES)->isPast(),
            422,
            'This appointment can only be marked as not attended 30 minutes after it started.'
        );

        $actor = $request->user();

        $bid->forceFill([
            'no_show_at' => now(),
            'no_show_reported_by_type' => $actor instanceof PropertyManagerProfile ? 'manager' : 'user',
            'no_show_reported_by_id' => $actor->id,
        ])->save();

        $this->notifyNoShow($bid->fresh()->load(['order', 'serviceProvider']), $slot);

        if ($bid->serviceProvider) {
            $ranking->recalculate($bid->serviceProvider);
        }

        return response()->json(['message' => 'The provider was informed that the appointment was not attended.']);
    }

    /**
     * The appointment the provider actually confirmed, as a date-time.
     */
    private function confirmedSlot(Order $order, Bid $bid): ?Carbon
    {
        $index = data_get($bid->workflow_meta ?? [], 'selected_slot_index');

        if (! is_numeric($index)) {
            return null;
        }

        $slot = data_get($order->workflow_meta ?? [], 'inspection.preferred_slots.'.(int) $index);
        $date = data_get($slot, 'date');
        $time = data_get($slot, 'time');

        if (! $date) {
            return null;
        }

        try {
            return Carbon::parse(trim($date.' '.($time ?: '00:00')));
        } catch (\Throwable) {
            return null;
        }
    }

    private function notifyNoShow(Bid $bid, Carbon $slot): void
    {
        $provider = $bid->serviceProvider;
        // The primary contact address, not the orders inbox.
        $email = $provider?->contact_email ?: $provider?->order_email ?: $bid->assigned_provider_email;

        if (! $provider || ! $email) {
            return;
        }

        try {
            Mail::mailer('orders')->to($email)->send(
                new InspectionNoShowMail($bid, $slot->format('d.m.Y H:i'))
            );
        } catch (\Throwable $exception) {
            Log::error('Vergo no-show email failed', [
                'order_id' => $bid->order_id,
                'bid_id' => $bid->id,
                'error' => $exception->getMessage(),
            ]);
        }
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

    /**
     * Offers stay sealed until the submission deadline passes.
     */
    /**
     * Manager accepts the disclosed offer. The provider must still confirm.
     */
    public function acceptBid(Request $request, Order $order, Bid $bid, OfferAwardService $award): JsonResponse
    {
        $this->authorizeManagerSide($request, $order);
        $this->abortIfBiddingStillOpen($order);
        abort_unless($bid->order_id === $order->id, 404);
        abort_if($bid->status === 'rejected', 422, 'This offer has already been rejected.');

        $validated = $request->validate([
            // Whether Vergo tells the company, or the manager does it themselves.
            'notify_via' => ['required', 'in:vergo,self'],
        ]);

        $award->accept($order, $bid);
        $award->appendAudit($order, 'offer_accepted', [
            'company' => $bid->serviceProvider?->company_name,
            'notify_via' => $validated['notify_via'],
        ]);

        if ($validated['notify_via'] === 'vergo') {
            app(NotificationServiceAlias::class)->sendDirectAwardAssigned(
                $order->fresh(),
                collect([$bid->serviceProvider])->filter(),
            );
        }

        return response()->json([
            'message' => 'Offer accepted.',
            // Always returned so the manager can copy it if they notify manually.
            'data' => $award->awardSummary($order->fresh(), $bid->fresh()),
        ]);
    }

    /**
     * Manager rejects the disclosed offer; the next-best one opens up.
     */
    public function rejectOffer(Request $request, Order $order, Bid $bid, OfferAwardService $award, BidDisclosureService $disclosure): JsonResponse
    {
        $this->authorizeManagerSide($request, $order);
        $this->abortIfBiddingStillOpen($order);
        abort_unless($bid->order_id === $order->id, 404);

        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:5', 'max:2000'],
        ], [
            'reason.required' => 'Please state why this offer is being rejected.',
        ]);

        $award->reject($order, $bid, $validated['reason']);
        $award->appendAudit($order, 'offer_rejected', [
            'company' => $bid->serviceProvider?->company_name,
            'reason' => $validated['reason'],
        ]);

        return response()->json([
            'message' => 'Offer rejected. The next-ranked offer is now available.',
            'data' => $disclosure->build($order->fresh()),
        ]);
    }

    /**
     * Records that a session ended while an offer was open, so the owner can
     * see it later.
     */
    public function recordOpenOfferExit(Request $request, Order $order, OfferAwardService $award): JsonResponse
    {
        $this->authorizeManagerSide($request, $order);

        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:64'],
        ]);

        $award->appendAudit($order, 'left_with_open_offer', [
            'via' => $validated['reason'] ?? 'unknown',
        ]);

        return response()->json(['message' => 'Recorded.']);
    }

    /**
     * No usable offers left. Re-opens the tender and e-mails every provider in
     * the trade again, except those who declined or cancelled this job.
     */
    public function refreshTender(Request $request, Order $order, NotificationServiceAlias $notifications, OfferAwardService $award): JsonResponse
    {
        $this->authorizeManagerSide($request, $order);

        $validated = $request->validate([
            'bid_deadline_at' => ['required', 'date', 'after:today'],
        ], [
            'bid_deadline_at.after' => 'Please select a bid deadline after today.',
        ]);

        // Anyone who turned this job down or walked away is not invited back.
        $excluded = $order->bids()
            ->where(function ($query): void {
                $query->whereNotNull('provider_declined_at')->orWhereNotNull('cancelled_at');
            })
            ->pluck('service_provider_id')
            ->map(fn ($id): int => (int) $id)
            ->filter()
            ->unique()
            ->values()
            ->all();

        $order->forceFill([
            'status' => 'open',
            'workflow_status' => 'published_for_quotes',
            'bid_deadline_at' => $validated['bid_deadline_at'],
        ])->save();

        $award->appendAudit($order, 'tender_refreshed', ['excluded_provider_ids' => $excluded]);
        $notifications->sendQuoteRequestPublished($order->fresh(), $excluded);

        return response()->json(['message' => 'The tender was reopened and the providers were notified.']);
    }

    private function abortIfBiddingStillOpen(Order $order): void
    {
        if ($order->isBiddingStillOpen()) {
            abort(422, 'Bids remain hidden until the submission deadline passes.');
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
