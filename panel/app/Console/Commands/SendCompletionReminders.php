<?php

namespace App\Console\Commands;

use App\Mail\JobCompletionReminderMail;
use App\Models\Bid;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * On the day a company said the work would be finished, remind them to close
 * the job in Vergo - that is what releases their invoicing details.
 */
class SendCompletionReminders extends Command
{
    protected $signature = 'vergo:completion-reminders {--date= : Run as if today were this date (Y-m-d)}';

    protected $description = 'Remind providers to close jobs due for completion today';

    public function handle(): int
    {
        $today = $this->option('date') ? \Carbon\Carbon::parse($this->option('date'))->toDateString() : now()->toDateString();

        $bids = Bid::query()
            ->with(['serviceProvider', 'order.property', 'order.propertyObject'])
            ->whereIn('status', ['accepted', 'approved'])
            ->whereDate('estimated_completion_date', $today)
            ->whereNull('completion_reminded_at')
            ->whereHas('order', fn ($query) => $query->whereNotIn('status', ['completed', 'closed', 'cancelled']))
            ->get();

        if ($bids->isEmpty()) {
            $this->info('No jobs are due for completion today.');

            return self::SUCCESS;
        }

        $frontendBase = rtrim(config('app.frontend_url', env('FRONTEND_URL', 'http://localhost:5173')), '/');
        $sent = 0;

        foreach ($bids as $bid) {
            $provider = $bid->serviceProvider;
            $email = $provider?->order_email ?: ($bid->assigned_provider_email ?: $provider?->contact_email);

            if (! $email) {
                $this->warn("Skipped bid #{$bid->id}: no address on file.");

                continue;
            }

            try {
                Mail::mailer('orders')->to($email)->send(new JobCompletionReminderMail(
                    order: $bid->order,
                    bid: $bid,
                    loginUrl: $frontendBase.'/available-jobs',
                    propertyAddress: trim(implode(', ', array_filter([
                        $bid->order?->propertyObject?->address ?: $bid->order?->property?->title,
                        trim(($bid->order?->propertyObject?->postal_code ?: $bid->order?->property?->postal_code).' '
                            .($bid->order?->propertyObject?->city ?: $bid->order?->property?->city)),
                    ]))) ?: null,
                ));

                // Never remind the same job twice.
                $bid->forceFill(['completion_reminded_at' => now()])->save();
                $sent++;
                $this->line("  reminded {$provider->company_name} about {$bid->order?->order_number}");
            } catch (\Throwable $exception) {
                Log::error('Vergo completion reminder failed', [
                    'bid_id' => $bid->id,
                    'error' => $exception->getMessage(),
                ]);
                $this->error("  failed for bid #{$bid->id}: {$exception->getMessage()}");
            }
        }

        $this->info("Sent {$sent} completion reminder(s).");

        return self::SUCCESS;
    }
}
