<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Bid extends Model
{
    use HasFactory;

    protected $fillable = [
        'order_id',
        'service_provider_id',
        'amount',
        'currency',
        'estimated_start_date',
        'estimated_completion_date',
        'notes',
        'attachment_name',
        'attachment_path',
        'attachment_mime_type',
        'attachment_size',
        'status',
        'submitted_at',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'estimated_start_date' => 'date',
            'estimated_completion_date' => 'date',
            'submitted_at' => 'datetime',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function serviceProvider(): BelongsTo
    {
        return $this->belongsTo(ServiceProvider::class);
    }
}
