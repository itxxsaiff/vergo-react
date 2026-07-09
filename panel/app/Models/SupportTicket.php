<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SupportTicket extends Model
{
    use HasFactory;

    protected $fillable = [
        'ticket_number',
        'user_id',
        'property_manager_profile_id',
        'requester_role',
        'requester_name',
        'requester_email',
        'category',
        'priority',
        'subject',
        'message',
        'status',
        'admin_notes',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function propertyManagerProfile(): BelongsTo
    {
        return $this->belongsTo(PropertyManagerProfile::class);
    }
}
