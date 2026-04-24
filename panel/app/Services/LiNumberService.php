<?php

namespace App\Services;

use App\Models\Property;

class LiNumberService
{
    public function generate(): string
    {
        $lastLiNumber = Property::query()
            ->where('li_number', 'like', 'Li-%')
            ->orderByDesc('li_number')
            ->value('li_number');

        if (! $lastLiNumber) {
            return 'Li-10001';
        }

        $lastSequence = (int) str($lastLiNumber)->after('Li-')->toString();
        $nextSequence = $lastSequence + 1;

        return 'Li-'.str_pad((string) $nextSequence, 5, '0', STR_PAD_LEFT);
    }
}
