<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AiAnalysisResultResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'document_id' => $this->document_id,
            'order_id' => $this->order_id,
            'property_id' => $this->property_id,
            'status' => $this->status,
            'score' => $this->score,
            'summary' => $this->summary,
            'comparison_data' => $this->comparison_data,
            'document' => $this->whenLoaded('document', fn () => $this->document ? [
                'id' => $this->document->id,
                'title' => $this->document->title,
                'type' => $this->document->type,
                'status' => $this->document->status,
                'file_name' => $this->document->file_name,
                'property' => $this->document->property ? [
                    'id' => $this->document->property->id,
                    'li_number' => $this->document->property->li_number,
                    'title' => $this->document->property->title,
                ] : null,
                'order' => $this->document->order ? [
                    'id' => $this->document->order->id,
                    'title' => $this->document->order->title,
                ] : null,
            ] : null),
            'order' => $this->whenLoaded('order', fn () => $this->order ? [
                'id' => $this->order->id,
                'title' => $this->order->title,
                'status' => $this->order->status,
                'property' => $this->order->property ? [
                    'id' => $this->order->property->id,
                    'li_number' => $this->order->property->li_number,
                    'title' => $this->order->property->title,
                ] : null,
            ] : null),
            'property' => $this->whenLoaded('property', fn () => $this->property ? [
                'id' => $this->property->id,
                'li_number' => $this->property->li_number,
                'title' => $this->property->title,
                'size' => $this->property->size !== null ? (float) $this->property->size : null,
                'city' => $this->property->city,
                'country' => $this->property->country,
            ] : null),
            'created_at' => $this->created_at?->toDateTimeString(),
            'updated_at' => $this->updated_at?->toDateTimeString(),
        ];
    }
}
