<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BidResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $hideScopeSeedPrices = $this->shouldHideScopeSeedPrices($request);

        return [
            'id' => $this->id,
            'order_id' => $this->order_id,
            'service_provider_id' => $this->service_provider_id,
            'assigned_provider_email' => $this->assigned_provider_email,
            'amount' => $hideScopeSeedPrices ? null : $this->amount,
            'currency' => $this->currency,
            'line_items' => $hideScopeSeedPrices ? $this->scopeOnlyLineItems($this->line_items ?? []) : ($this->line_items ?? []),
            'prices_hidden' => $hideScopeSeedPrices,
            'estimated_start_date' => $this->estimated_start_date?->toDateString(),
            'estimated_completion_date' => $this->estimated_completion_date?->toDateString(),
            'notes' => $this->notes,
            'workflow_meta' => $this->workflow_meta ?? [],
            'draft_payload' => $this->draft_payload ?? null,
            'draft_saved_at' => $this->draft_saved_at?->toDateTimeString(),
            'attachment_name' => $this->attachment_name,
            'attachment_mime_type' => $this->attachment_mime_type,
            'attachment_size' => $this->attachment_size,
            'status' => $this->status,
            'rejection_reason' => $this->rejection_reason,
            'submitted_at' => $this->submitted_at?->toDateTimeString(),
            'attachment_download_url' => $this->attachment_path ? route('bids.attachment.download', $this->id) : null,
            'order' => $this->whenLoaded('order', fn () => [
                'id' => $this->order->id,
                'title' => $this->order->title,
                'service_type' => $this->order->service_type,
                'job_type' => $this->order->service_type,
                'status' => $this->order->status,
                'property' => $this->order->property ? [
                    'id' => $this->order->property->id,
                    'li_number' => $this->order->property->li_number,
                    'title' => $this->order->property->title,
                    'postal_code' => $this->order->property->postal_code,
                    'city' => $this->order->property->city,
                ] : null,
                'property_object' => $this->order->propertyObject ? [
                    'id' => $this->order->propertyObject->id,
                    'name' => $this->order->propertyObject->name,
                    'address' => $this->order->propertyObject->address,
                    'postal_code' => $this->order->propertyObject->postal_code,
                    'city' => $this->order->propertyObject->city,
                ] : null,
            ]),
            'service_provider' => $this->whenLoaded('serviceProvider', fn () => [
                'id' => $this->serviceProvider->id,
                'company_name' => $this->serviceProvider->company_name,
                'contact_name' => $this->serviceProvider->contact_name,
                'contact_email' => $this->serviceProvider->contact_email,
            ]),
            'created_at' => $this->created_at?->toDateTimeString(),
        ];
    }

    private function shouldHideScopeSeedPrices(Request $request): bool
    {
        if (! data_get($this->workflow_meta ?? [], 'quote_scope_seed')) {
            return false;
        }

        $actor = $request->user();

        return ! (
            $actor instanceof User
            && $actor->role?->name === 'provider'
            && $actor->serviceProvider?->id === $this->service_provider_id
        );
    }

    private function scopeOnlyLineItems(array $lineItems): array
    {
        return collect($lineItems)
            ->map(fn ($item) => [
                'label' => data_get($item, 'label'),
                'code' => data_get($item, 'code'),
                'unit' => data_get($item, 'unit'),
                'quantity' => data_get($item, 'quantity'),
                'is_custom' => (bool) data_get($item, 'is_custom', true),
            ])
            ->values()
            ->all();
    }
}
