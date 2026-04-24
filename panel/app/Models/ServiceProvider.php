<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ServiceProvider extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'company_name',
        'contact_name',
        'contact_email',
        'phone',
        'rating',
        'completed_jobs_count',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'rating' => 'decimal:2',
            'completed_jobs_count' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function bids(): HasMany
    {
        return $this->hasMany(Bid::class);
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(ProviderReview::class);
    }

    public function getAverageRatingValue(): ?float
    {
        $average = $this->reviews()->avg('rating');

        return $average !== null ? round((float) $average, 2) : null;
    }

    public function getCompletedJobsCountValue(): int
    {
        return (int) $this->bids()
            ->where('status', 'approved')
            ->whereHas('order', fn ($query) => $query->where('status', 'completed'))
            ->count();
    }

    public function hasWorkedOnPropertyBefore(int $propertyId, ?int $excludeOrderId = null): bool
    {
        return $this->bids()
            ->where('status', 'approved')
            ->whereHas('order', function ($query) use ($propertyId, $excludeOrderId) {
                $query->where('property_id', $propertyId)
                    ->where('status', 'completed');

                if ($excludeOrderId) {
                    $query->where('orders.id', '!=', $excludeOrderId);
                }
            })
            ->exists();
    }
}
