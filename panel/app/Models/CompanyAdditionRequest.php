<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CompanyAdditionRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'property_manager_profile_id',
        'property_id',
        'company_name',
        'contact_name',
        'email',
        'phone',
        'canton',
        'city',
        'notes',
        'status',
    ];

    public function propertyManagerProfile(): BelongsTo
    {
        return $this->belongsTo(PropertyManagerProfile::class);
    }

    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class);
    }
}
