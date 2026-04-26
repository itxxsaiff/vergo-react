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
        'line_items',
        'estimated_start_date',
        'estimated_completion_date',
        'notes',
        'workflow_meta',
        'attachment_name',
        'attachment_path',
        'attachment_mime_type',
        'attachment_size',
        'status',
        'rejection_reason',
        'submitted_at',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'line_items' => 'array',
            'estimated_start_date' => 'date',
            'estimated_completion_date' => 'date',
            'workflow_meta' => 'array',
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
