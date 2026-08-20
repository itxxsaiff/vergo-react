<?php

namespace App\Services;

use App\Models\Bid;
use App\Models\Order;

/**
 * Controls how much of the bid field the awarding side may see at once.
 *
 * Only the best-ranked open offer is disclosed: company, price, dates. Every
 * other offer stays anonymous until the disclosed one is rejected with a
 * reason, which then opens the next-ranked offer.
 */
class BidDisclosureService
{
    public function __construct(private OfferEvaluationService $evaluation)
    {
    }

    /**
     * @return array<string, mixed>
     */
    public function build(Order $order): array
    {
        $evaluation = $this->evaluation->evaluate($order);
        $ranked = collect($evaluation['offers'] ?? []);

        if ($ranked->isEmpty()) {
            return ['disclosed' => null, 'queue' => [], 'rejected' => [], 'evaluated_at' => $evaluation['evaluated_at'] ?? null];
        }

        $bids = $order->bids()->with('serviceProvider:id,company_name,contact_email')->get()->keyBy('id');

        $rejected = [];
        $queue = [];
        $disclosed = null;

        foreach ($ranked as $entry) {
            $bid = $bids->get($entry['bid_id']);

            if (! $bid) {
                continue;
            }

            if ($bid->status === 'rejected') {
                $rejected[] = $this->openEntry($bid, $entry) + [
                    'rejection_reason' => $bid->rejection_reason,
                ];

                continue;
            }

            // The first offer still in play is the one that may be opened.
            if ($disclosed === null) {
                $disclosed = $this->openEntry($bid, $entry);

                continue;
            }

            $queue[] = [
                'rank' => $entry['rank'],
                'score' => $entry['score'],
                // Deliberately anonymous until it is this offer's turn.
                'company_name' => null,
                'amount' => null,
                'locked' => true,
            ];
        }

        return [
            'evaluated_at' => $evaluation['evaluated_at'] ?? null,
            'reference' => $evaluation['reference'] ?? null,
            'disclosed' => $disclosed,
            'queue' => $queue,
            'rejected' => $rejected,
            'remaining_count' => count($queue),
        ];
    }

    /**
     * Reject the currently disclosed offer. A reason is mandatory, and only
     * the disclosed offer may be rejected - never one further down the queue.
     */
    public function reject(Order $order, Bid $bid, string $reason): void
    {
        $state = $this->build($order);

        abort_if($state['disclosed'] === null, 422, 'There is no open offer to reject.');
        abort_unless(
            (int) $state['disclosed']['bid_id'] === $bid->id,
            422,
            'Only the currently disclosed offer can be rejected.'
        );

        $bid->forceFill([
            'status' => 'rejected',
            'rejection_reason' => $reason,
        ])->save();
    }

    /**
     * @param  array<string, mixed>  $entry
     * @return array<string, mixed>
     */
    private function openEntry(Bid $bid, array $entry): array
    {
        return [
            'bid_id' => $bid->id,
            'rank' => $entry['rank'],
            'score' => $entry['score'],
            'company_name' => $bid->serviceProvider?->company_name,
            'contact_email' => $bid->serviceProvider?->contact_email,
            'amount' => (float) $bid->amount,
            'currency' => $bid->currency,
            'estimated_start_date' => $bid->estimated_start_date?->toDateString(),
            'estimated_completion_date' => $bid->estimated_completion_date?->toDateString(),
            'notes' => $bid->notes,
            'line_items' => $bid->line_items ?? [],
            'categories' => $entry['categories'] ?? [],
            'anomalies' => $entry['anomalies'] ?? [],
            'locked' => false,
        ];
    }
}
