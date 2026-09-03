<?php

namespace App\Services;

use App\Models\Bid;
use App\Models\Order;

/**
 * The award round after the bidding deadline.
 *
 * The manager opens the best offer, then accepts or rejects it. A rejection
 * needs a reason and releases the next-best offer. An acceptance awards the job
 * and waits for the provider to confirm.
 */
class OfferAwardService
{
    /**
     * Manager accepts the offer. The provider still has to confirm before work
     * starts, so the order is not "approved" yet.
     */
    public function accept(Order $order, Bid $bid): Bid
    {
        $bid->forceFill([
            'status' => 'awarded_pending_acceptance',
            'awarded_at' => now(),
            'provider_declined_at' => null,
            'provider_decline_reason' => null,
        ])->save();

        $order->forceFill(['status' => 'awaiting_provider_acceptance'])->save();

        return $bid->fresh();
    }

    /**
     * Manager rejects the offer with a reason. The next-ranked offer becomes
     * the one that can be opened.
     */
    public function reject(Order $order, Bid $bid, string $reason): Bid
    {
        $bid->forceFill([
            'status' => 'rejected',
            'rejection_reason' => $reason,
        ])->save();

        return $bid->fresh();
    }

    /**
     * The provider confirms the award and work begins.
     */
    public function providerAccept(Bid $bid): Bid
    {
        $bid->forceFill([
            'status' => 'accepted',
            'provider_accepted_at' => now(),
        ])->save();

        $order = $bid->order;

        if ($order) {
            $order->forceFill(['status' => 'approved'])->save();

            // Everyone else is out. They are not e-mailed: they simply see the
            // outcome the next time they open the job.
            Bid::query()
                ->where('order_id', $order->id)
                ->where('id', '!=', $bid->id)
                ->whereNotIn('status', ['rejected', 'cancelled'])
                ->update(['status' => 'rejected']);
        }

        return $bid->fresh();
    }

    /**
     * The provider turns the award down. The order goes back to the manager so
     * they can pick another company.
     */
    public function providerDecline(Bid $bid, ?string $reason = null): Bid
    {
        $bid->forceFill([
            'status' => 'rejected',
            'provider_declined_at' => now(),
            'provider_decline_reason' => $reason,
        ])->save();

        $order = $bid->order;

        if ($order) {
            $order->forceFill(['status' => 'in_review'])->save();
            $this->reinstateOtherBids($order, $bid);
        }

        return $bid->fresh();
    }

    /**
     * The awarded company backed out, so the offers that were closed off when
     * the award was made become available again. The manager or owner can then
     * open the next best one and hire a company they had previously turned down.
     */
    private function reinstateOtherBids(Order $order, Bid $awardedBid): void
    {
        Bid::query()
            ->where('order_id', $order->id)
            ->where('id', '!=', $awardedBid->id)
            ->whereNull('cancelled_at')
            ->whereNull('provider_declined_at')
            ->whereIn('status', ['rejected'])
            ->update([
                'status' => 'submitted',
                // The old reason no longer applies to a fresh decision.
                'rejection_reason' => null,
            ]);
    }

    /**
     * The provider abandons a job that had already started.
     */
    public function providerCancel(Bid $bid, string $reason): Bid
    {
        $bid->forceFill([
            'status' => 'cancelled',
            'cancelled_at' => now(),
            'cancellation_reason' => $reason,
        ])->save();

        $order = $bid->order;

        if ($order) {
            $order->forceFill(['status' => 'in_review'])->save();
            $this->reinstateOtherBids($order, $bid);
            $this->appendAudit($order, 'provider_cancelled', [
                'company' => $bid->serviceProvider?->company_name,
                'reason' => $reason,
            ]);
        }

        return $bid->fresh();
    }

    /**
     * The details the manager copies when they notify the company themselves.
     *
     * @return array<string, mixed>
     */
    public function awardSummary(Order $order, Bid $bid): array
    {
        $order->loadMissing(['property', 'propertyObject']);
        $object = $order->propertyObject;
        $property = $order->property;

        return [
            'vergo_order_number' => $order->order_number,
            // Only shown when the provider recorded one of their own.
            'provider_reference' => $bid->provider_reference ?: null,
            'address' => $object?->address ?: $property?->address_line_1,
            'postal_code_city' => trim(implode(' ', array_filter([
                $object?->postal_code ?: $property?->postal_code,
                $object?->city ?: $property?->city,
            ]))) ?: null,
            'job_title' => $order->title,
            'total_price' => $bid->amount !== null ? (float) $bid->amount : null,
            'currency' => $bid->currency ?: 'CHF',
            'company_name' => $bid->serviceProvider?->company_name,
        ];
    }

    /**
     * Records something the owner should be able to review later, such as a
     * manager closing the tab while an offer was open.
     *
     * @param  array<string, mixed>  $context
     */
    public function appendAudit(Order $order, string $event, array $context = []): void
    {
        $audit = $order->award_audit ?? [];

        $audit[] = array_merge([
            'event' => $event,
            'at' => now()->toDateTimeString(),
        ], $context);

        $order->forceFill(['award_audit' => $audit])->save();
    }
}
