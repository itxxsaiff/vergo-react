<?php

namespace App\Services;

use App\Models\Order;
use Illuminate\Support\Str;

/**
 * Builds the summary a service provider receives once they mark a job finished,
 * and opens the owner/manager rating cycle for that order.
 */
class OrderCompletionService
{
    /**
     * Everything the provider needs to raise their invoice.
     *
     * @return array<string, mixed>
     */
    public function buildSummary(Order $order): array
    {
        $order->loadMissing(['property.owners', 'propertyObject', 'propertyManager', 'approvedBid.serviceProvider']);

        $property = $order->property;
        $object = $order->propertyObject;
        $owner = $property?->owners?->first();
        $manager = $order->propertyManager;
        $bid = $order->approvedBid;

        return [
            'order_number' => $order->order_number,
            'provider_reference' => $bid?->provider_reference,
            'property' => [
                'name' => $property?->title,
                'li_number' => $property?->li_number,
                // Street of the specific object when the order targets one,
                // otherwise the property address.
                'street' => $object?->address ?: $property?->address_line_1,
                'postal_code' => $object?->postal_code ?: $property?->postal_code,
                'city' => $object?->city ?: $property?->city,
            ],
            'owner' => $owner ? [
                'name' => $owner->display_name,
                'address' => $owner->address,
                'postal_code' => $owner->postal_code,
                'city' => $owner->city,
            ] : null,
            'property_manager' => $manager ? [
                'name' => $manager->name,
                'address' => $manager->address,
                'postal_code' => $manager->postal_code,
                'city' => $manager->city,
            ] : null,
            'billing_address' => $this->resolveBillingAddress($order),
        ];
    }

    /**
     * Where the invoice has to be sent. A third party named on the order wins;
     * otherwise the manager's invoice details, falling back to their postal
     * address when no separate invoice address was captured.
     *
     * @return array<string, mixed>
     */
    private function resolveBillingAddress(Order $order): array
    {
        $recipient = data_get($order->workflow_meta ?? [], 'assignment.invoice_recipient', []);

        if (data_get($recipient, 'recipient_type') === 'third_party') {
            return [
                'source' => 'third_party',
                'name' => trim(implode(' ', array_filter([
                    data_get($recipient, 'first_name'),
                    data_get($recipient, 'last_name'),
                ]))) ?: data_get($recipient, 'company_name'),
                'company' => data_get($recipient, 'company_name'),
                'address' => data_get($recipient, 'address'),
                'postal_code' => data_get($recipient, 'postal_code'),
                'city' => data_get($recipient, 'city'),
                'email' => data_get($recipient, 'email'),
                'delivery_method' => data_get($recipient, 'delivery_method') ?: 'email',
            ];
        }

        $manager = $order->propertyManager;

        if (! $manager) {
            return ['source' => 'unknown'];
        }

        return [
            'source' => 'property_manager',
            'name' => $manager->invoice_company_name ?: $manager->name,
            'company' => $manager->invoice_company_name,
            'company_extra' => $manager->invoice_company_extra,
            'address' => $manager->invoice_address ?: $manager->address,
            'postal_code' => $manager->invoice_postal_code ?: $manager->postal_code,
            'city' => $manager->invoice_city ?: $manager->city,
            'email' => $manager->invoice_email ?: $manager->email,
            'delivery_method' => $manager->invoice_delivery_method ?: 'email',
        ];
    }

    /**
     * Mark the job finished by the provider and open the rating window.
     * The token backs the one-click rating link in the e-mail.
     */
    public function markProviderCompleted(Order $order): Order
    {
        $order->forceFill([
            'status' => 'completed',
            'provider_completed_at' => now(),
            'completed_at' => $order->completed_at ?? now(),
            'review_token' => $order->review_token ?: Str::random(48),
            'review_requested_at' => $order->review_requested_at ?? now(),
        ])->save();

        return $order->fresh();
    }
}
