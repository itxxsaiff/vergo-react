<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Property extends Model
{
    use HasFactory;

    protected $fillable = [
        'li_number',
        'title',
        'management',
        'size',
        'address_line_1',
        'address_line_2',
        'city',
        'state',
        'country',
        'postal_code',
        'usage',
        'lot_area',
        'description',
        'status',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'size' => 'decimal:2',
            'lot_area' => 'decimal:2',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function ownerAssignments(): HasMany
    {
        return $this->hasMany(PropertyOwnerAssignment::class);
    }

    public function owners(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'property_owner_assignments', 'property_id', 'owner_id')
            ->withPivot('assigned_at')
            ->withTimestamps();
    }

    public function objects(): HasMany
    {
        return $this->hasMany(PropertyObject::class);
    }

    public function managerDomains(): HasMany
    {
        return $this->hasMany(PropertyManagerDomain::class);
    }

    public function managerProfiles(): HasMany
    {
        return $this->hasMany(PropertyManagerProfile::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(Document::class);
    }

    public function analysisResults(): HasMany
    {
        return $this->hasMany(AiAnalysisResult::class);
    }
}
