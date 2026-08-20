<?php

namespace App\Console\Commands;

use App\Services\ProviderRatingService;
use Illuminate\Console\Command;

class SendProviderRatingReminders extends Command
{
    protected $signature = 'vergo:rating-reminders';

    protected $description = 'E-mail a reminder every two days for completed orders that have not been rated yet.';

    public function handle(ProviderRatingService $ratingService): int
    {
        $orders = $ratingService->ordersAwaitingReminder();
        $sent = 0;

        foreach ($orders as $order) {
            if ($ratingService->sendRatingRequest($order, isReminder: true)) {
                $sent++;
                $this->line('reminded: '.($order->order_number ?: $order->id));
            }
        }

        $this->info(sprintf('%d reminder(s) sent, %d order(s) checked.', $sent, $orders->count()));

        return self::SUCCESS;
    }
}
