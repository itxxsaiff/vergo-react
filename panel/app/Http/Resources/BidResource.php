<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BidResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'order_id' => $this->order_id,
            'service_provider_id' => $this->service_provider_id,
            'amount' => $this->amount,
            'currency' => $this->currency,
            'line_items' => $this->line_items ?? [],
            'estimated_start_date' => $this->estimated_start_date?->toDateString(),
            'estimated_completion_date' => $this->estimated_completion_date?->toDateString(),
            'notes' => $this->notes,
            'workflow_meta' => $this->workflow_meta ?? [],
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
}
