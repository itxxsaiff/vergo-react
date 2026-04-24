<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PropertyObject extends Model
{
    use HasFactory;

    protected $fillable = [
        'property_id',
        'name',
        'address',
        'postal_code',
        'city',
        'type',
        'reference',
        'location',
        'floors',
        'apartment_count',
        'commercial_area',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'commercial_area' => 'decimal:2',
        ];
    }

    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }
}
