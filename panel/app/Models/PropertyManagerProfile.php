<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class PropertyManagerProfile extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'property_id',
        'name',
        'email',
        'phone',
        'address',
        'postal_code',
        'city',
        'canton',
        'invoice_delivery_method',
        'invoice_email',
        'invoice_company_name',
        'invoice_company_extra',
        'invoice_address',
        'invoice_postal_code',
        'invoice_city',
        'domain_suffix',
        'last_login_at',
    ];

    protected $hidden = [
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'last_login_at' => 'datetime',
        ];
    }

    public function getPropertyIdAttribute($value): ?int
    {
        $activePropertyId = $this->activePropertyIdFromCurrentToken();

        if ($activePropertyId) {
            return $activePropertyId;
        }

        return $value === null ? null : (int) $value;
    }

    public function accessiblePropertyIds(): array
    {
        $ids = [];
        $activePropertyId = $this->activePropertyIdFromCurrentToken();
        $storedPropertyId = $this->getRawOriginal('property_id');

        if ($activePropertyId) {
            return [$activePropertyId];
        }

        if ($storedPropertyId) {
            $ids[] = (int) $storedPropertyId;
        }

        $assignedPropertyIds = $this->assignedProperties()
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        return array_values(array_unique([...$ids, ...$assignedPropertyIds]));
    }

    public function canAccessProperty(int $propertyId): bool
    {
        return in_array($propertyId, $this->accessiblePropertyIds(), true);
    }

    private function activePropertyIdFromCurrentToken(): ?int
    {
        $abilities = $this->currentAccessToken()?->abilities ?? [];

        foreach ($abilities as $ability) {
            if (! is_string($ability) || ! str_starts_with($ability, 'property:')) {
                continue;
            }

            $propertyId = (int) substr($ability, strlen('property:'));

            return $propertyId > 0 ? $propertyId : null;
        }

        return null;
    }

    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class);
    }

    public function loginCodes(): HasMany
    {
        return $this->hasMany(ManagerLoginCode::class, 'email', 'email');
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class, 'property_manager_profile_id');
    }

    public function assignedProperties(): HasMany
    {
        return $this->hasMany(Property::class, 'property_manager_profile_id');
    }
}
