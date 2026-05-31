<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserDirectoryOwnerResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'customer_number' => 'KND-'.str_pad((string) $this->id, 5, '0', STR_PAD_LEFT),
            'company_name' => $this->display_name,
            'address' => $this->address,
            'postal_code' => $this->postal_code,
            'city' => $this->city,
            'properties_count' => $this->whenCounted('ownedProperties'),
        ];
    }
}
