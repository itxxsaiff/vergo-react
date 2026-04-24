<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserDirectoryAdminResource extends JsonResource
{
    private const PLACEHOLDER_IMAGE = 'https://i.sstatic.net/y9DpT.jpg';

    public function toArray(Request $request): array
    {
        $firstName = $this->first_name ?: $this->name ?: 'Admin';
        $lastName = $this->last_name ?: '';

        return [
            'id' => $this->id,
            'first_name' => $firstName,
            'last_name' => $lastName,
            'location' => $this->location,
            'photo_url' => $this->image ?: self::PLACEHOLDER_IMAGE,
        ];
    }
}
