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
            'order_id' => $this->order_id,
            'type' => $this->type,
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
            'order' => $this->whenLoaded('order', fn () => $this->order ? [
                'id' => $this->order->id,
                'title' => $this->order->title,
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
