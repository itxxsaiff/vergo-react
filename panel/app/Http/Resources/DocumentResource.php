<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DocumentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'property_id' => $this->property_id,
            'property_object_id' => $this->property_object_id,
            'property_object_ids' => $this->property_object_ids ?? [],
            'order_id' => $this->order_id,
            'service_provider_id' => $this->service_provider_id,
            'type' => $this->type,
            'service_type' => $this->service_type,
            'trade_object' => $this->trade_object,
            'trade_activity' => $this->trade_activity,
            'title' => $this->title,
            'file_name' => $this->file_name,
            'mime_type' => $this->mime_type,
            'size' => $this->size,
            'status' => $this->status,
            'download_url' => route('documents.download', $this->id),
            'property' => $this->whenLoaded('property', fn () => $this->property ? [
                'id' => $this->property->id,
                'li_number' => $this->property->li_number,
                'title' => $this->property->title,
            ] : null),
            'property_object' => $this->whenLoaded('propertyObject', fn () => $this->propertyObject ? [
                'id' => $this->propertyObject->id,
                'property_id' => $this->propertyObject->property_id,
                'name' => $this->propertyObject->name,
                'address' => $this->propertyObject->address,
                'postal_code' => $this->propertyObject->postal_code,
                'city' => $this->propertyObject->city,
            ] : null),
            'order' => $this->whenLoaded('order', fn () => $this->order ? [
                'id' => $this->order->id,
                'title' => $this->order->title,
            ] : null),
            'service_provider' => $this->whenLoaded('serviceProvider', fn () => $this->serviceProvider ? [
                'id' => $this->serviceProvider->id,
                'company_name' => $this->serviceProvider->company_name,
                'contact_email' => $this->serviceProvider->contact_email,
            ] : null),
            'analysis_results' => $this->whenLoaded('analysisResults', fn () => $this->analysisResults
                ->sortByDesc('created_at')
                ->values()
                ->map(fn ($result) => [
                    'id' => $result->id,
                    'status' => $result->status,
                    'score' => $result->score,
                    'summary' => $result->summary,
                    'comparison_data' => $result->comparison_data,
                    'created_at' => $result->created_at?->toDateTimeString(),
                ])),
            'created_at' => $this->created_at?->toDateTimeString(),
        ];
    }
}
