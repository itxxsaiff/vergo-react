<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AiAnalysisResult extends Model
{
    use HasFactory;

    protected $fillable = [
        'document_id',
        'order_id',
        'property_id',
        'status',
        'score',
        'summary',
        'comparison_data',
    ];

    protected function casts(): array
    {
        return [
            'score' => 'decimal:2',
            'comparison_data' => 'array',
        ];
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class);
    }
}
