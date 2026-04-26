<?php

namespace App\Services;

use App\Models\Document;
use App\Models\Bid;
use App\Models\Order;
use App\Models\Property;
use App\Models\PropertyManagerProfile;
use App\Models\ServiceProvider;
use App\Models\User;
use App\Notifications\SystemNotification;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;
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

    public function sendQuoteRequestPublished(Order $order): void
    {
        $recipients = User::query()
            ->whereHas('role', fn ($query) => $query->where('name', 'provider'))
            ->get();

        Notification::send($recipients, new SystemNotification(
            title: 'New Public Quote Request',
            message: sprintf('A new public quote request "%s" is now available.', $order->title),
            type: 'primary',
            actionUrl: '/available-jobs',
        ));
    }

    public function sendPublicInspectionPublished(Order $order): void
    {
        $recipients = User::query()
            ->whereHas('role', fn ($query) => $query->where('name', 'provider'))
            ->get();

        Notification::send($recipients, new SystemNotification(
            title: 'New Public Inspection Request',
            message: sprintf('A public inspection request for "%s" is now open.', $order->title),
            type: 'primary',
            actionUrl: '/available-jobs',
        ));
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

    private function isSameRecipient(mixed $recipient, mixed $actor): bool
    {
        if (! $recipient || ! $actor) {
            return false;
        }

        return get_class($recipient) === get_class($actor)
            && (string) $recipient->getKey() === (string) $actor->getKey();
    }
}
