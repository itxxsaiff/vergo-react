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
            'phone' => $this->phone,
            'address' => $this->address,
            'postal_code' => $this->postal_code,
            'city' => $this->city,
            'canton' => $this->canton,
            'invoice_delivery_method' => $this->invoice_delivery_method,
            'invoice_email' => $this->invoice_email,
            'invoice_company_name' => $this->invoice_company_name,
            'invoice_company_extra' => $this->invoice_company_extra,
            'invoice_address' => $this->invoice_address,
            'invoice_postal_code' => $this->invoice_postal_code,
            'invoice_city' => $this->invoice_city,
            'domain_suffix' => $this->domain_suffix,
            'last_login_at' => $this->last_login_at?->toDateTimeString(),
            'property' => $this->whenLoaded('property', fn () => [
                'id' => $this->property->id,
                'li_number' => $this->property->li_number,
                'title' => $this->property->title,
            ]),
            'assigned_properties_count' => $this->whenCounted('assignedProperties'),
            'orders_count' => $this->orders_count ?? 0,
            'active_orders_count' => $this->active_orders_count ?? 0,
            'created_at' => $this->created_at?->toDateTimeString(),
        ];
    }
}
