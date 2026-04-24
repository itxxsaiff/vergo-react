<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserDirectoryAdminResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $photoIndex = (($this->id - 1) % 10) + 1;
        $firstName = $this->first_name ?: $this->name ?: 'Admin';
        $lastName = $this->last_name ?: '';

        return [
            'id' => $this->id,
            'first_name' => $firstName,
            'last_name' => $lastName,
            'location' => $this->location,
            'photo_url' => "/assets/images/profile/user-{$photoIndex}.jpg",
        ];
    }
}
