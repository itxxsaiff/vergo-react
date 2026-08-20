<?php

namespace App\Services;

use App\Mail\ProviderRatingRequestMail;
use App\Models\Order;
use App\Models\ProviderReview;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Drives the confidential 1-5 star rating the owner/manager gives after a job
 * is finished, including the reminder cycle every two days until it arrives.
 */
class ProviderRatingService
{
    public const REMINDER_INTERVAL_DAYS = 2;

    public function ratingUrl(Order $order): string
    {
        $base = rtrim(config('app.frontend_url', env('FRONTEND_URL', 'http://localhost:5173')), '/');

        return $base.'/rate-provider?token='.urlencode((string) $order->review_token);
    }

    /**
     * The person who has to rate: the manager that placed the order, falling
     * back to the requester address on the order itself.
     */
    public function recipientEmail(Order $order): ?string
    {
        return $order->propertyManager?->email ?: $order->requester_email;
    }

    public function sendRatingRequest(Order $order, bool $isReminder = false): bool
    {
        $email = $this->recipientEmail($order);

        if (! $email || ! $order->review_token) {
            return false;
        }

        $providerName = $order->approvedBid?->serviceProvider?->company_name ?: 'Dienstleister';

        try {
            Mail::mailer('orders')->to($email)->send(new ProviderRatingRequestMail(
                order: $order,
                providerName: $providerName,
                ratingUrl: $this->ratingUrl($order),
                isReminder: $isReminder,
            ));
        } catch (\Throwable $exception) {
            Log::error('Vergo rating request email failed', [
                'order_id' => $order->id,
                'error' => $exception->getMessage(),
            ]);

            return false;
        }

        $order->forceFill([
            'review_last_reminded_at' => now(),
            'review_reminder_count' => $isReminder ? $order->review_reminder_count + 1 : $order->review_reminder_count,
        ])->save();

        return true;
    }

    /**
     * Orders that are finished, still unrated, and whose last e-mail is at
     * least the reminder interval old.
     *
     * @return \Illuminate\Database\Eloquent\Collection<int, Order>
     */
    public function ordersAwaitingReminder()
    {
        return Order::query()
            ->whereNotNull('review_token')
            ->whereNotNull('review_requested_at')
            ->whereNull('reviewed_at')
            ->where(function ($query): void {
                $query->whereNull('review_last_reminded_at')
                    ->orWhere('review_last_reminded_at', '<=', now()->subDays(self::REMINDER_INTERVAL_DAYS));
            })
            ->with(['propertyManager', 'approvedBid.serviceProvider'])
            ->get();
    }

    /**
     * A rating of 1 or 2 stars must carry a reason; above that it is optional.
     */
    public function reasonRequired(int $rating): bool
    {
        return $rating <= 2;
    }

    public function recordReview(Order $order, int $rating, ?string $reason): ProviderReview
    {
        $bid = $order->approvedBid;

        $review = ProviderReview::query()->updateOrCreate(
            [
                'order_id' => $order->id,
                'service_provider_id' => $bid?->service_provider_id,
            ],
            [
                'property_id' => $order->property_id,
                'reviewer_manager_profile_id' => $order->property_manager_profile_id,
                'rating' => $rating,
                'comment' => $reason,
            ],
        );

        $order->forceFill(['reviewed_at' => now()])->save();

        return $review;
    }
}
