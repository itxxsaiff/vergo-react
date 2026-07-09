<?php

namespace App\Services;

use App\Models\Document;
use App\Models\Bid;
use App\Models\Order;
use App\Models\Property;
use App\Models\PropertyManagerProfile;
use App\Models\ServiceProvider;
use App\Models\User;
use App\Mail\InspectionAppointmentConfirmedMail;
use App\Mail\ProviderOrderNoticeMail;
use App\Notifications\SystemNotification;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;

class NotificationService
{
    public function sendOrderCreated(Order $order, mixed $actor = null): void
    {
        $order->loadMissing(['property.owners', 'property.managerProfiles']);

        $recipients = $this->basePropertyRecipients($order->property, $actor)
            ->merge($this->adminRecipients($actor))
            ->unique(fn ($recipient) => get_class($recipient).':'.$recipient->getKey());

        Notification::send($recipients, new SystemNotification(
            title: 'Order Created',
            message: sprintf('A new order "%s" was created for %s.', $order->title, $order->property?->li_number ?? 'a property'),
            type: 'primary',
            actionUrl: "/orders/{$order->id}",
        ));
    }

    public function sendBidSubmitted(Order $order, string $providerName, mixed $actor = null): void
    {
        $order->loadMissing(['property.owners', 'property.managerProfiles']);

        $recipients = $this->basePropertyRecipients($order->property, $actor)
            ->merge($this->adminRecipients($actor))
            ->unique(fn ($recipient) => get_class($recipient).':'.$recipient->getKey());

        Notification::send($recipients, new SystemNotification(
            title: 'New Bid Submitted',
            message: sprintf('%s submitted a bid for "%s".', $providerName, $order->title),
            type: 'success',
            actionUrl: "/orders/{$order->id}",
        ));
    }

    public function sendInspectionRequestAssigned(Order $order, iterable $providers): void
    {
        $recipients = $this->providerRecipients($providers);

        Notification::send($recipients, new SystemNotification(
            title: 'Inspection Request Assigned',
            message: sprintf('A direct inspection request for "%s" is waiting for your response.', $order->title),
            type: 'primary',
            actionUrl: '/bids',
        ));
    }

    public function sendDirectAwardAssigned(Order $order, iterable $providers): void
    {
        $recipients = $this->providerRecipients($providers);

        Notification::send($recipients, new SystemNotification(
            title: 'Direct Award Assigned',
            message: sprintf('You have been invited to accept the job "%s".', $order->title),
            type: 'success',
            actionUrl: '/bids',
        ));
    }

    public function sendProviderOrderEmails(Order $order, iterable $providers, string $noticeType): void
    {
        $order->loadMissing('property');
        $frontendBase = rtrim(config('app.frontend_url', env('FRONTEND_URL', 'http://localhost:5173')), '/');
        $targetedProviders = [];
        $skippedProviders = [];

        foreach ($providers as $provider) {
            if (! $provider instanceof ServiceProvider) {
                $skippedProviders[] = [
                    'provider_id' => null,
                    'reason' => 'invalid_provider_instance',
                ];
                continue;
            }

            if (! $provider->order_email) {
                $skippedProviders[] = [
                    'provider_id' => $provider->id,
                    'reason' => 'missing_order_email',
                ];
                continue;
            }

            $loginUrl = sprintf(
                '%s/email-otp-login?customer_number=%s&email=%s&force_otp=1',
                $frontendBase,
                urlencode($this->formatProviderCustomerNumber($provider->id)),
                urlencode($provider->order_email)
            );

            try {
                Mail::mailer('orders')->to($provider->order_email)->send(new ProviderOrderNoticeMail(
                    order: $order,
                    provider: $provider,
                    noticeType: $noticeType,
                    loginUrl: $loginUrl,
                ));

                $targetedProviders[] = [
                    'provider_id' => $provider->id,
                    'order_email' => $provider->order_email,
                ];
            } catch (\Throwable $exception) {
                Log::error('Vergo provider order email failed', [
                    'order_id' => $order->id,
                    'provider_id' => $provider->id,
                    'order_email' => $provider->order_email,
                    'notice_type' => $noticeType,
                    'error' => $exception->getMessage(),
                ]);
            }
        }

        Log::info('Vergo provider order email dispatch completed', [
            'order_id' => $order->id,
            'notice_type' => $noticeType,
            'frontend_base' => $frontendBase,
            'sent_count' => count($targetedProviders),
            'skipped_count' => count($skippedProviders),
            'sent_providers' => $targetedProviders,
            'skipped_providers' => $skippedProviders,
        ]);
    }

    public function sendProviderPersonalAssignmentEmail(Order $order, ServiceProvider $provider, string $email): void
    {
        $order->loadMissing('property');
        $frontendBase = rtrim(config('app.frontend_url', env('FRONTEND_URL', 'http://localhost:5173')), '/');
        $loginUrl = sprintf(
            '%s/email-otp-login?customer_number=%s&email=%s&force_otp=1',
            $frontendBase,
            urlencode($this->formatProviderCustomerNumber($provider->id)),
            urlencode($email)
        );

        Mail::mailer('orders')->to($email)->send(new ProviderOrderNoticeMail(
            order: $order,
            provider: $provider,
            noticeType: 'assigned',
            loginUrl: $loginUrl,
        ));
    }

    public function sendQuoteRequestPublished(Order $order): void
    {
        $providers = $this->providersForTrade($order->service_type);
        $recipients = $this->providerRecipients($providers);

        Notification::send($recipients, new SystemNotification(
            title: 'New Public Quote Request',
            message: sprintf('A new public quote request "%s" is now available.', $order->title),
            type: 'primary',
            actionUrl: '/available-jobs',
        ));

        $this->sendProviderOrderEmails($order, $providers, 'published');
    }

    public function sendPublicInspectionPublished(Order $order): void
    {
        $providers = $this->providersForTrade($order->service_type);
        $recipients = $this->providerRecipients($providers);

        Notification::send($recipients, new SystemNotification(
            title: 'New Public Inspection Request',
            message: sprintf('A public inspection request for "%s" is now open.', $order->title),
            type: 'primary',
            actionUrl: '/available-jobs',
        ));

        $this->sendProviderOrderEmails($order, $providers, 'published');
    }

    public function sendBidDecision(Bid $bid, string $title, string $message): void
    {
        $recipient = $bid->serviceProvider?->user;

        if (! $recipient) {
            return;
        }

        $recipient->notify(new SystemNotification(
            title: $title,
            message: $message,
            type: 'primary',
            actionUrl: '/bids',
        ));
    }

    public function sendInspectionAppointmentConfirmed(Bid $bid): void
    {
        $bid->loadMissing(['order.property', 'order.propertyObject', 'serviceProvider']);

        $onsiteEmail = data_get($bid->order?->workflow_meta ?? [], 'inspection.onsite_contact.email');

        if (! $onsiteEmail) {
            return;
        }

        try {
            Mail::mailer('orders')->to($onsiteEmail)->send(new InspectionAppointmentConfirmedMail($bid));
        } catch (\Throwable $exception) {
            Log::error('Vergo inspection appointment confirmation email failed', [
                'order_id' => $bid->order_id,
                'bid_id' => $bid->id,
                'onsite_email' => $onsiteEmail,
                'error' => $exception->getMessage(),
            ]);
        }
    }

    public function sendDocumentAnalysisFinished(Document $document, string $status): void
    {
        $document->loadMissing(['property.owners', 'property.managerProfiles', 'order']);

        $recipients = $this->basePropertyRecipients($document->property)
            ->merge($this->adminRecipients())
            ->unique(fn ($recipient) => get_class($recipient).':'.$recipient->getKey());

        Notification::send($recipients, new SystemNotification(
            title: $status === 'analyzed' ? 'AI Analysis Completed' : 'AI Analysis Failed',
            message: $status === 'analyzed'
                ? sprintf('Document "%s" finished Gemini analysis.', $document->title)
                : sprintf('Document "%s" failed during Gemini analysis.', $document->title),
            type: $status === 'analyzed' ? 'success' : 'danger',
            actionUrl: '/ai-analysis',
        ));
    }

    private function basePropertyRecipients(?Property $property, mixed $actor = null): Collection
    {
        if (! $property) {
            return collect();
        }

        $owners = $property->owners instanceof EloquentCollection ? $property->owners : collect();
        $managers = $property->managerProfiles instanceof EloquentCollection ? $property->managerProfiles : collect();

        return $owners
            ->concat($managers)
            ->filter(fn ($recipient) => ! $this->isSameRecipient($recipient, $actor));
    }

    private function adminRecipients(mixed $actor = null): Collection
    {
        return User::query()
            ->whereHas('role', fn ($query) => $query->where('name', 'admin'))
            ->get()
            ->filter(fn ($recipient) => ! $this->isSameRecipient($recipient, $actor));
    }

    private function providerRecipients(iterable $providers): Collection
    {
        return collect($providers)
            ->map(function ($provider) {
                if ($provider instanceof ServiceProvider) {
                    return $provider->user;
                }

                return null;
            })
            ->filter();
    }

    private function providersForTrade(?string $trade): Collection
    {
        $providers = ServiceProvider::query()
            ->with('user.role')
            ->where('status', 'active')
            ->get();

        if (! $trade) {
            Log::info('Vergo provider trade filter resolved', [
                'trade' => null,
                'provider_count' => $providers->count(),
                'provider_ids' => $providers->pluck('id')->values()->all(),
            ]);
            return $providers;
        }

        $filteredProviders = $providers
            ->filter(fn ($provider) => $provider->supportsServiceType($trade))
            ->values();

        Log::info('Vergo provider trade filter resolved', [
            'trade' => $trade,
            'provider_count' => $filteredProviders->count(),
            'provider_ids' => $filteredProviders->pluck('id')->values()->all(),
        ]);

        return $filteredProviders;
    }

    private function formatProviderCustomerNumber(int $id): string
    {
        return 'DLS-'.str_pad((string) $id, 5, '0', STR_PAD_LEFT);
    }

    private function isSameRecipient(mixed $recipient, mixed $actor): bool
    {
        if (! $recipient || ! $actor) {
            return false;
        }

        return get_class($recipient) === get_class($actor)
            && (string) $recipient->getKey() === (string) $actor->getKey();
    }
}
