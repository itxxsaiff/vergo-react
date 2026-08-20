<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class Order extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'order_number',
        'property_id',
        'property_manager_profile_id',
        'property_object_id',
        'property_object_ids',
        'requester_name',
        'requester_email',
        'title',
        'service_type',
        'description',
        'status',
        'workflow_type',
        'workflow_status',
        'bid_priority',
        'due_date',
        'bid_deadline_at',
        'workflow_meta',
        'quote_items',
        'attachment_name',
        'attachment_path',
        'attachment_mime_type',
        'attachment_size',
        'requested_at',
        'completed_at',
        'provider_completed_at',
        'review_token',
        'review_requested_at',
        'review_last_reminded_at',
        'review_reminder_count',
        'reviewed_at',
    ];

    protected function casts(): array
    {
        return [
            'property_object_ids' => 'array',
            'due_date' => 'date',
            'bid_deadline_at' => 'datetime',
            'workflow_meta' => 'array',
            'quote_items' => 'array',
            'requested_at' => 'datetime',
            'completed_at' => 'datetime',
            'provider_completed_at' => 'datetime',
            'review_requested_at' => 'datetime',
            'review_last_reminded_at' => 'datetime',
            'reviewed_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Order $order): void {
            if ($order->order_number) {
                return;
            }

            [$sequence, $number] = static::reserveOrderNumber();

            $order->order_sequence = $sequence;
            $order->order_number = $number;
        });
    }

    /**
     * Claim the next running order number, e.g. VER-2608-00001.
     * Locks the highest existing sequence so two concurrent creates can never
     * take the same number. Soft-deleted orders keep their number reserved.
     *
     * @return array{0: int, 1: string}
     */
    public static function reserveOrderNumber(?Carbon $issuedAt = null): array
    {
        return DB::transaction(function () use ($issuedAt): array {
            $highest = (int) static::withTrashed()
                ->lockForUpdate()
                ->max('order_sequence');

            $sequence = $highest + 1;

            return [$sequence, static::formatOrderNumber($sequence, $issuedAt)];
        });
    }

    /**
     * VER = Vergo, then the two-digit year and month of issue, then the
     * five-digit running number: VER-2608-00001.
     */
    public static function formatOrderNumber(int $sequence, ?Carbon $issuedAt = null): string
    {
        return sprintf(
            'VER-%s-%05d',
            ($issuedAt ?? now())->format('ym'),
            $sequence,
        );
    }

    public function priceChangeRequests(): HasMany
    {
        return $this->hasMany(PriceChangeRequest::class);
    }

    public function lineItemPhotos(): HasMany
    {
        return $this->hasMany(BidLineItemPhoto::class);
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

    public function confirmedInspectionBids(): HasMany
    {
        return $this->hasMany(Bid::class)->where('status', 'inspection_confirmed');
    }

    public function inspectionQuoteSeedBids(): HasMany
    {
        return $this->hasMany(Bid::class)
            ->where('status', 'submitted')
            ->whereNotNull('line_items');
    }

    public function approvedBid(): HasOne
    {
        return $this->hasOne(Bid::class)->whereIn('status', ['approved', 'accepted', 'completed', 'awarded_pending_acceptance'])->latestOfMany();
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
