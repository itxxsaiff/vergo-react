<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Order extends Model
{
    use HasFactory;

    protected $fillable = [
        'property_id',
        'property_manager_profile_id',
        'property_object_id',
        'requester_name',
        'requester_email',
        'title',
        'service_type',
        'description',
        'status',
        'due_date',
        'requested_at',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'due_date' => 'date',
            'requested_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class);
    }

    public function propertyManager(): BelongsTo
    {
        return $this->belongsTo(PropertyManagerProfile::class, 'property_manager_profile_id');
    }

    public function propertyObject(): BelongsTo
    {
        return $this->belongsTo(PropertyObject::class);
    }

    public function bids(): HasMany
    {
        return $this->hasMany(Bid::class);
    }

    public function approvedBid(): HasOne
    {
        return $this->hasOne(Bid::class)->where('status', 'approved')->latestOfMany();
    }

    public function documents(): HasMany
    {
        return $this->hasMany(Document::class);
    }

    public function analysisResults(): HasMany
    {
        return $this->hasMany(AiAnalysisResult::class);
    }

    public function providerReviews(): HasMany
    {
        return $this->hasMany(ProviderReview::class);
    }
}
