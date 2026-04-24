<?php

namespace App\Http\Resources;

use App\Models\Property;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserDirectoryOwnerResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $primaryProperty = $this->resolvePrimaryProperty();

        return [
            'id' => $this->id,
            'customer_number' => 'KND-'.str_pad((string) $this->id, 5, '0', STR_PAD_LEFT),
            'company_name' => $this->name,
            'address' => $this->formatAddress($primaryProperty),
            'postal_code' => $primaryProperty?->postal_code,
            'city' => $primaryProperty?->city,
            'properties_count' => $this->whenCounted('ownedProperties'),
        ];
    }

    private function resolvePrimaryProperty(): ?Property
    {
        if (! $this->relationLoaded('ownedProperties')) {
            return null;
        }

        return $this->ownedProperties->first();
    }

    private function formatAddress(?Property $property): ?string
    {
        if (! $property) {
            return null;
        }

        $address = collect([
            $property->address_line_1,
            $property->address_line_2,
        ])->filter()->implode(', ');

        return $address !== '' ? $address : null;
    }
}
