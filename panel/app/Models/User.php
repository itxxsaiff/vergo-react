<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'role_id',
        'name',
        'first_name',
        'last_name',
        'location',
        'image',
        'email',
        'password',
        'phone',
        'status',
        'access_level',
        'owner_type',
        'company_name',
        'address',
        'postal_code',
        'city',
        'domain_suffix',
        'login_email',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    public function ownedProperties(): BelongsToMany
    {
        return $this->belongsToMany(Property::class, 'property_owner_assignments', 'owner_id', 'property_id')
            ->withPivot('assigned_at')
            ->withTimestamps();
    }

    public function createdProperties(): HasMany
    {
        return $this->hasMany(Property::class, 'created_by');
    }

    public function serviceProvider(): HasOne
    {
        return $this->hasOne(ServiceProvider::class);
    }

    public function getDisplayNameAttribute(): string
    {
        if ($this->owner_type === 'company' && $this->company_name) {
            return $this->company_name;
        }

        $personName = trim(implode(' ', array_filter([
            $this->first_name,
            $this->last_name,
        ])));

        if ($personName !== '') {
            return $personName;
        }

        return $this->name;
    }
}
