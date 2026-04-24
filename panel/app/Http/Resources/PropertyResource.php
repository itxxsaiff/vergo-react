<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PropertyResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'li_number' => $this->li_number,
            'title' => $this->title,
            'management' => $this->management,
            'size' => $this->size !== null ? (float) $this->size : null,
            'address_line_1' => $this->address_line_1,
            'address_line_2' => $this->address_line_2,
            'city' => $this->city,
            'state' => $this->state,
            'country' => $this->country,
            'postal_code' => $this->postal_code,
            'usage' => $this->usage,
            'lot_area' => $this->lot_area !== null ? (float) $this->lot_area : null,
            'description' => $this->description,
            'status' => $this->status,
            'owners' => $this->whenLoaded('owners', function () {
                return $this->owners->map(fn ($owner) => [
                    'id' => $owner->id,
                    'name' => $owner->name,
                    'email' => $owner->email,
                ])->values();
            }),
            'manager_domains' => $this->whenLoaded('managerDomains', function () {
                return $this->managerDomains->map(fn ($domain) => [
                    'id' => $domain->id,
                    'domain' => $domain->domain,
                    'is_active' => $domain->is_active,
                ])->values();
            }),
            'objects' => $this->whenLoaded('objects', function () {
                return $this->objects->map(fn ($object) => [
                    'id' => $object->id,
                    'name' => $object->name,
                    'address' => $object->address,
                    'postal_code' => $object->postal_code,
                    'city' => $object->city,
                    'type' => $object->type,
                    'reference' => $object->reference,
                    'location' => $object->location,
                    'floors' => $object->floors,
                    'apartment_count' => $object->apartment_count,
                    'commercial_area' => $object->commercial_area !== null ? (float) $object->commercial_area : null,
                    'status' => $object->status,
                ])->values();
            }),
            'orders' => $this->whenLoaded('orders', function () {
                return $this->orders->map(fn ($order) => [
                    'id' => $order->id,
                    'title' => $order->title,
                    'service_type' => $order->service_type,
                    'status' => $order->status,
                    'due_date' => $order->due_date?->toDateString(),
                    'property_object' => $order->propertyObject ? [
                        'id' => $order->propertyObject->id,
                        'name' => $order->propertyObject->name,
                        'type' => $order->propertyObject->type,
                    ] : null,
                ])->values();
            }),
            'documents' => $this->whenLoaded('documents', function () {
                return $this->documents->map(fn ($document) => [
                    'id' => $document->id,
                    'title' => $document->title,
                    'type' => $document->type,
                    'status' => $document->status,
                    'file_name' => $document->file_name,
                    'analysis_results' => $document->analysisResults->map(fn ($result) => [
                        'id' => $result->id,
                        'status' => $result->status,
                        'score' => $result->score,
                        'summary' => $result->summary,
                        'comparison_data' => $result->comparison_data,
                        'created_at' => $result->created_at?->toDateTimeString(),
                    ])->values(),
                ])->values();
            }),
            'analysis_results' => $this->whenLoaded('analysisResults', function () {
                return $this->analysisResults
                    ->sortByDesc('created_at')
                    ->values()
                    ->map(fn ($result) => [
                        'id' => $result->id,
                        'status' => $result->status,
                        'score' => $result->score,
                        'summary' => $result->summary,
                        'comparison_data' => $result->comparison_data,
                        'created_at' => $result->created_at?->toDateTimeString(),
                    ]);
            }),
            'objects_count' => $this->whenCounted('objects'),
            'orders_count' => $this->whenCounted('orders'),
            'documents_count' => $this->whenCounted('documents'),
            'created_at' => $this->created_at?->toDateTimeString(),
        ];
    }
}
