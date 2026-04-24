<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PropertyManagerDomainResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'property_id' => $this->property_id,
            'domain' => $this->domain,
            'is_active' => $this->is_active,
            'property' => $this->whenLoaded('property', fn () => [
                'id' => $this->property->id,
                'li_number' => $this->property->li_number,
                'title' => $this->property->title,
            ]),
            'created_at' => $this->created_at?->toDateTimeString(),
        ];
    }
}
