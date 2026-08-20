<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BidLineItemPhoto extends Model
{
    use HasFactory;

    protected $fillable = [
        'order_id', 'bid_id', 'service_provider_id', 'line_item_index',
        'name', 'path', 'mime_type', 'size', 'is_published', 'published_at',
    ];

    protected function casts(): array
    {
        return [
            'line_item_index' => 'integer',
            'is_published' => 'boolean',
            'published_at' => 'datetime',
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
