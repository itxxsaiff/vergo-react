<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PriceChangeRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'order_id', 'bid_id', 'service_provider_id', 'items',
        'original_amount', 'requested_amount', 'status', 'decision_note',
        'decided_at', 'decided_by_type', 'decided_by_id',
    ];

    protected function casts(): array
    {
        return [
            'items' => 'array',
            'original_amount' => 'decimal:2',
            'requested_amount' => 'decimal:2',
            'decided_at' => 'datetime',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function bid(): BelongsTo
    {
        return $this->belongsTo(Bid::class);
    }

    public function serviceProvider(): BelongsTo
    {
        return $this->belongsTo(ServiceProvider::class);
    }
}
