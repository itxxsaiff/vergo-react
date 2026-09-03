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
use App\Mail\QuoteScopeChangedMail;
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
        $recipients = $this->orderRecipients($order, $actor)
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
        $recipients = $this->orderRecipients($order, $actor)
            ->merge($this->adminRecipients($actor))
            ->unique(fn ($recipient) => get_class($recipient).':'.$recipient->getKey());

        Notification::send($recipients, new SystemNotification(
            title: 'New Bid Submitted',
            message: sprintf('%s submitted a bid for "%s".', $providerName, $order->title),
            type: 'success',
            actionUrl: "/orders/{$order->id}",
        ));
    }

    public function sendInspectionQuoteCreated(Bid $bid, mixed $actor = null): void
    {
        $bid->loadMissing([
            'order.property.managerProfiles',
            'order.property.assignedManagerProfile',
            'order.property.owners',
            'order.propertyManager',
            'serviceProvider',
        ]);

        $order = $bid->order;

        if (! $order?->property) {
            return;
        }

        $providerName = $bid->serviceProvider?->company_name
            ?: $bid->serviceProvider?->contact_name
            ?: $bid->assigned_provider_email
            ?: 'A provider';

        $recipients = $this->orderRecipients($order, $actor)
            ->merge($this->adminRecipients($actor))
            ->unique(fn ($recipient) => get_class($recipient).':'.$recipient->getKey());

        Notification::send($recipients, new SystemNotification(
            title: 'Quote Created After Site Visit',
            message: sprintf('%s created a quote for "%s". Review the services and publish it for bidding.', $providerName, $order->title),
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

            $loginUrl = $this->providerLoginUrl($frontendBase, $provider->id, $provider->order_email);

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
        $loginUrl = $this->providerLoginUrl($frontendBase, $provider->id, $email);

        Mail::mailer('orders')->to($email)->send(new ProviderOrderNoticeMail(
            order: $order,
            provider: $provider,
            noticeType: 'assigned',
            loginUrl: $loginUrl,
        ));
    }

    /**
     * Tell the providers whose priced scope no longer matches the tender that
     * they have to quote again.
     *
     * @param  iterable<int, \App\Models\Bid>  $requoteBids
     */
    public function sendQuoteScopeChanged(Order $order, iterable $requoteBids, int $itemCount): void
    {
        $frontendBase = rtrim(config('app.frontend_url', env('FRONTEND_URL', 'http://localhost:5173')), '/');

        foreach ($requoteBids as $bid) {
            $provider = $bid->serviceProvider;

            if (! $provider) {
                continue;
            }

            $recipients = $this->providerRecipients(collect([$provider]));

            Notification::send($recipients, new SystemNotification(
                title: 'Auftragsvolumen geändert',
                message: sprintf('Der Umfang von "%s" wurde angepasst. Bitte reichen Sie eine neue Offerte ein.', $order->title),
                type: 'warning',
                actionUrl: '/available-jobs',
            ));

            // Goes to the company's main order inbox - the same address that
            // receives new-order notifications - not the individual who quoted.
            $email = $provider->order_email ?: $bid->assigned_provider_email;

            if (! $email) {
                Log::warning('Vergo requote email skipped: no address', [
                    'order_id' => $order->id,
                    'provider_id' => $provider->id,
                ]);

                continue;
            }

            try {
                Mail::mailer('orders')->to($email)->send(new QuoteScopeChangedMail(
                    order: $order,
                    provider: $provider,
                    itemCount: $itemCount,
                    loginUrl: $this->providerLoginUrl($frontendBase, $provider->id, $email),
                    tradeLabel: $this->tradeLabel($order->service_type),
                    propertyAddress: $this->orderAddressLine($order),
                    // The address the original quote was submitted from.
                    originalQuoteEmail: $bid->assigned_provider_email,
                ));
            } catch (\Throwable $exception) {
                Log::error('Vergo requote email failed', [
                    'order_id' => $order->id,
                    'provider_id' => $provider->id,
                    'error' => $exception->getMessage(),
                ]);
            }
        }
    }

    public function sendQuoteRequestPublished(Order $order, array $excludeProviderIds = []): void
    {
        $providers = $this->providersForTrade($order->service_type)
            ->reject(fn ($provider) => in_array($provider->id, $excludeProviderIds, true))
            ->values();
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

    public function sendProviderResponse(Bid $bid, string $status): void
    {
        $bid->loadMissing([
            'order.property.owners',
            'order.property.managerProfiles',
            'order.property.assignedManagerProfile',
            'order.propertyManager',
            'serviceProvider',
        ]);

        $order = $bid->order;

        if (! $order) {
            return;
        }

        $providerName = $bid->serviceProvider?->company_name
            ?: $bid->serviceProvider?->contact_name
            ?: $bid->assigned_provider_email
            ?: 'Ein Dienstleister';

        $isConfirmed = in_array($status, ['inspection_confirmed', 'accepted'], true);
        $title = $isConfirmed ? 'Provider Response Confirmed' : 'Provider Response Declined';
        $message = match ($status) {
            'inspection_confirmed' => sprintf('%s has confirmed the viewing for "%s".', $providerName, $order->title),
            'accepted' => sprintf('%s has accepted the order "%s".', $providerName, $order->title),
            'rejected' => sprintf('%s has declined "%s".', $providerName, $order->title),
            default => sprintf('%s responded to "%s".', $providerName, $order->title),
        };

        $recipients = $this->orderRecipients($order)
            ->merge($this->adminRecipients())
            ->unique(fn ($recipient) => get_class($recipient).':'.$recipient->getKey());

        Notification::send($recipients, new SystemNotification(
            title: $title,
            message: $message,
            type: $isConfirmed ? 'success' : 'danger',
            actionUrl: "/orders/{$order->id}",
        ));
    }

    public function sendInspectionAppointmentConfirmed(Bid $bid): void
    {
        $bid->loadMissing(['order.property', 'order.propertyObject', 'serviceProvider']);

        $onsiteContact = data_get($bid->order?->workflow_meta ?? [], 'inspection.onsite_contact', []);
        $onsiteEmail = data_get($onsiteContact, 'email');
        $onsiteName = trim(implode(' ', array_filter([
            data_get($onsiteContact, 'first_name'),
            data_get($onsiteContact, 'last_name'),
        ])));

        if (! $onsiteEmail) {
            return;
        }

        try {
            Mail::mailer('orders')->to($onsiteEmail, $onsiteName ?: null)->send(new InspectionAppointmentConfirmedMail($bid));
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

    /**
     * Everyone who should be told about activity on an order: the property
     * owners, the managers linked to the property, and the manager who raised
     * the order itself.
     */
    private function orderRecipients(Order $order, mixed $actor = null): Collection
    {
        // Load here rather than relying on every caller to remember: a missing
        // relation silently drops the manager from the recipient list.
        $order->loadMissing([
            'property.owners',
            'property.managerProfiles',
            'property.assignedManagerProfile',
            'propertyManager',
        ]);

        $recipients = $this->basePropertyRecipients($order->property, $actor);

        if ($order->propertyManager) {
            $recipients = $recipients->concat([$order->propertyManager]);
        }

        return $recipients
            ->unique(fn ($recipient) => get_class($recipient).':'.$recipient->getKey())
            ->filter(fn ($recipient) => ! $this->isSameRecipient($recipient, $actor))
            ->values();
    }

    /**
     * Human readable trade for e-mails, which are written in German.
     */
    private function tradeLabel(?string $serviceType): ?string
    {
        if (! $serviceType) {
            return null;
        }

        $labels = [
            'painting' => 'Maler',
            'plumbing' => 'Sanitär',
            'electrical' => 'Elektro',
            'hvac_maintenance' => 'Heizung / Lüftung / Klima',
            'flooring' => 'Bodenbeläge',
            'cleaning' => 'Reinigung',
            'landscaping' => 'Garten / Umgebung',
            'security' => 'Sicherheit / Brandschutz',
            'elevator_service' => 'Lift',
            'general_maintenance' => 'Allgemeiner Unterhalt',
            'other' => 'Sonstiges',
        ];

        $key = ServiceProvider::normalizeServiceType($serviceType);

        return $labels[$key] ?? str($serviceType)->replace('_', ' ')->headline()->toString();
    }

    /**
     * Street, postcode and town of the object the order relates to.
     */
    private function orderAddressLine(Order $order): ?string
    {
        $order->loadMissing(['property', 'propertyObject']);
        $object = $order->propertyObject;
        $property = $order->property;

        $line = array_filter([
            $object?->address ?: $property?->address_line_1,
            trim(implode(' ', array_filter([
                $object?->postal_code ?: $property?->postal_code,
                $object?->city ?: $property?->city,
            ]))),
        ]);

        return $line === [] ? null : implode(', ', $line);
    }

    private function basePropertyRecipients(?Property $property, mixed $actor = null): Collection
    {
        if (! $property) {
            return collect();
        }

        $owners = $property->owners instanceof EloquentCollection ? $property->owners : collect();
        $managers = $property->managerProfiles instanceof EloquentCollection ? $property->managerProfiles : collect();

        // Manager profiles are deduplicated by e-mail, so their property_id only
        // points at the property they first signed in through. The manager
        // actually assigned to this property must be added explicitly or they
        // never get notified.
        $property->loadMissing('assignedManagerProfile');

        if ($property->assignedManagerProfile) {
            $managers = $managers->concat([$property->assignedManagerProfile]);
        }

        return $owners
            ->concat($managers)
            ->unique(fn ($recipient) => get_class($recipient).':'.$recipient->getKey())
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

    private function providerLoginUrl(string $frontendBase, int $providerId, string $email): string
    {
        return $frontendBase.'/email-otp-login?'.http_build_query([
            'customer_number' => $this->formatProviderCustomerNumber($providerId),
            'email' => $email,
            'force_otp' => '1',
        ], '', '&', PHP_QUERY_RFC3986);
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

    private function activeProviders(): Collection
    {
        return ServiceProvider::query()
            ->where('status', 'active')
            ->with('user')
            ->get();
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
