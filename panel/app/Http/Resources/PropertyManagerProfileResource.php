<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PropertyManagerProfileResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'property_id' => $this->property_id,
            'name' => $this->name,
            'email' => $this->email,
            'address' => $this->address,
            'postal_code' => $this->postal_code,
            'city' => $this->city,
            'domain_suffix' => $this->domain_suffix,
            'last_login_at' => $this->last_login_at?->toDateTimeString(),
            'property' => $this->whenLoaded('property', fn () => [
                'id' => $this->property->id,
                'li_number' => $this->property->li_number,
                'title' => $this->property->title,
            ]),
            'orders_count' => $this->whenCounted('orders'),
            'created_at' => $this->created_at?->toDateTimeString(),
        ];
    }
}
