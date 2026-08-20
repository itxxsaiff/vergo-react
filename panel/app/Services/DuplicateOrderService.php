<?php

namespace App\Services;

use App\Models\Order;
use Illuminate\Support\Collection;

/**
 * Detects orders that look like duplicates of one another on the same property.
 *
 * Two situations are covered:
 *  - a manager cancels a job and immediately raises an identical one;
 *  - a manager splits what is really one job into several near-identical
 *    orders (a separate order per wall instead of one for the room).
 *
 * Similarity combines the trade, the wording of title/description and the
 * line items, so cosmetic rewording does not hide a duplicate.
 */
class DuplicateOrderService
{
    /** Similarity at or above this is reported as a likely duplicate. */
    public const THRESHOLD = 0.72;

    /** How far back a cancelled order is still considered for comparison. */
    public const CANCELLED_WINDOW_DAYS = 60;

    /** How far back a live order on the same property is compared. */
    public const ACTIVE_WINDOW_DAYS = 30;

    /**
     * Candidates that the given order may be duplicating.
     *
     * @return array<int, array<string, mixed>>
     */
    public function findDuplicates(Order $order): array
    {
        if (! $order->property_id) {
            return [];
        }

        $candidates = Order::query()
            ->withTrashed()
            ->with('propertyManager:id,name,email')
            ->where('property_id', $order->property_id)
            ->where('id', '!=', $order->id)
            ->where(function ($query): void {
                $query
                    // A cancelled or deleted job that was re-raised.
                    ->where(function ($cancelled): void {
                        $cancelled->where(function ($inner): void {
                            $inner->whereNotNull('cancelled_at')->orWhereNotNull('deleted_at');
                        })->where('created_at', '>=', now()->subDays(self::CANCELLED_WINDOW_DAYS));
                    })
                    // Or a still-live job for the same work.
                    ->orWhere(function ($active): void {
                        $active->whereNull('cancelled_at')
                            ->whereNull('deleted_at')
                            ->whereNotIn('status', ['completed', 'closed'])
                            ->where('created_at', '>=', now()->subDays(self::ACTIVE_WINDOW_DAYS));
                    });
            })
            ->latest()
            ->limit(50)
            ->get();

        return $candidates
            ->map(function (Order $candidate) use ($order): array {
                $similarity = $this->similarity($order, $candidate);

                return [
                    'order_id' => $candidate->id,
                    'order_number' => $candidate->order_number,
                    'title' => $candidate->title,
                    'service_type' => $candidate->service_type,
                    'similarity' => round($similarity, 4),
                    // Why it matters: a re-raised cancelled job or a split job.
                    'reason' => $this->isCancelled($candidate) ? 'cancelled_recreated' : 'similar_active_order',
                    'cancelled_at' => $candidate->cancelled_at?->toDateTimeString(),
                    'cancellation_reason' => $candidate->cancellation_reason,
                    'manager_name' => $candidate->propertyManager?->name,
                    'manager_email' => $candidate->propertyManager?->email ?: $candidate->requester_email,
                    'created_at' => $candidate->created_at?->toDateTimeString(),
                ];
            })
            ->filter(fn (array $row): bool => $row['similarity'] >= self::THRESHOLD)
            ->sortByDesc('similarity')
            ->values()
            ->all();
    }

    /**
     * 0..1 similarity. The trade must match for anything to be comparable at
     * all; wording and line items then decide how close the two jobs are.
     */
    public function similarity(Order $first, Order $second): float
    {
        // Different trades are never the same job.
        if (filled($first->service_type) && filled($second->service_type)
            && $first->service_type !== $second->service_type) {
            return 0.0;
        }

        $textScore = $this->textSimilarity(
            $this->orderText($first),
            $this->orderText($second),
        );

        $itemScore = $this->itemSimilarity($first, $second);

        // With no line items on either side the wording carries the decision.
        if ($itemScore === null) {
            return $textScore;
        }

        return ($textScore * 0.55) + ($itemScore * 0.45);
    }

    private function orderText(Order $order): string
    {
        return trim(($order->title ?? '').' '.($order->description ?? ''));
    }

    /**
     * Token overlap (Jaccard) with a direct-string fallback, so reordered or
     * slightly reworded descriptions still match.
     */
    private function textSimilarity(string $first, string $second): float
    {
        $a = $this->tokenise($first);
        $b = $this->tokenise($second);

        if ($a->isEmpty() || $b->isEmpty()) {
            return 0.0;
        }

        $intersection = $a->intersect($b)->count();
        $union = $a->merge($b)->unique()->count();
        $jaccard = $union > 0 ? $intersection / $union : 0.0;

        similar_text(mb_strtolower($first), mb_strtolower($second), $percent);

        return max($jaccard, $percent / 100);
    }

    /**
     * @return Collection<int, string>
     */
    private function tokenise(string $value): Collection
    {
        return collect(preg_split('/[^\p{L}\p{N}]+/u', mb_strtolower($value), -1, PREG_SPLIT_NO_EMPTY) ?: [])
            // Drop very short filler words so they do not inflate the overlap.
            ->filter(fn (string $token): bool => mb_strlen($token) > 2)
            ->unique()
            ->values();
    }

    /**
     * Overlap of the quoted services. Null when neither order lists any.
     */
    private function itemSimilarity(Order $first, Order $second): ?float
    {
        $a = $this->itemLabels($first);
        $b = $this->itemLabels($second);

        if ($a->isEmpty() && $b->isEmpty()) {
            return null;
        }

        if ($a->isEmpty() || $b->isEmpty()) {
            return 0.0;
        }

        $intersection = $a->intersect($b)->count();
        $union = $a->merge($b)->unique()->count();

        return $union > 0 ? $intersection / $union : 0.0;
    }

    /**
     * @return Collection<int, string>
     */
    private function itemLabels(Order $order): Collection
    {
        return collect($order->quote_items ?? [])
            ->map(fn ($item): string => mb_strtolower(trim((string) (data_get($item, 'label') ?: data_get($item, 'code')))))
            ->filter()
            ->unique()
            ->values();
    }

    private function isCancelled(Order $order): bool
    {
        return $order->cancelled_at !== null || $order->deleted_at !== null;
    }
}
