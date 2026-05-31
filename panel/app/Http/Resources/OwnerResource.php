<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OwnerResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'owner_type' => $this->owner_type,
            'name' => $this->display_name,
            'company_name' => $this->company_name,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'address' => $this->address,
            'postal_code' => $this->postal_code,
            'city' => $this->city,
            'domain_suffix' => $this->domain_suffix,
            'email' => $this->login_email,
            'login_email' => $this->login_email,
            'phone' => $this->phone,
            'status' => $this->status,
            'role' => $this->role?->name,
            'properties_count' => $this->whenCounted('ownedProperties'),
            'created_at' => $this->created_at?->toDateTimeString(),
        ];
    }
}
