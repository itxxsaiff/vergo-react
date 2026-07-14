<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ServiceProvider extends Model
{
    use HasFactory;

    private const TRADE_GROUP_SERVICE_TYPE_MAP = [
        'elektro' => 'electrical',
        'gebaeudeautomation_schwachstrom_kommunikation' => 'security',
        'heizung' => 'hvac_maintenance',
        'lueftung' => 'hvac_maintenance',
        'klima_kaelte' => 'hvac_maintenance',
        'sanitaer' => 'plumbing',
        'maler' => 'painting',
        'gipser_trockenbau' => 'general_maintenance',
        'bodenbelaege' => 'flooring',
        'plattenleger' => 'flooring',
        'schreiner_innenausbau' => 'general_maintenance',
        'metallbau_schloss_beschlaege' => 'general_maintenance',
        'fenster_glas_storen_sonnenschutz' => 'general_maintenance',
        'dach_spengler_flachdach' => 'general_maintenance',
        'fassade_gebaeudehuelle' => 'general_maintenance',
        'maurer_beton_kernbohrung' => 'general_maintenance',
        'reinigung' => 'cleaning',
        'garten_umgebung_winterdienst' => 'landscaping',
        'kanal_entwaesserung' => 'plumbing',
        'kueche_geraete_haushaltstechnik' => 'general_maintenance',
        'lift' => 'elevator_service',
        'brandschutz_sicherheit' => 'security',
        'holzbau_zimmermann' => 'general_maintenance',
        'solar_photovoltaik_solarthermie' => 'electrical',
        'tuer_tor_garagentor' => 'general_maintenance',
        'geruestbau' => 'general_maintenance',
        'schadstoffsanierung_rueckbau' => 'general_maintenance',
        'raeumung_entsorgung' => 'other',
    ];

    protected $fillable = [
        'user_id',
        'company_name',
        'contact_name',
        'contact_email',
        'order_email',
        'address',
        'postal_code',
        'city',
        'canton',
        'domain_suffix',
        'trade_groups',
        'phone',
        'is_vat_subject',
        'rating',
        'completed_jobs_count',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'rating' => 'decimal:2',
            'completed_jobs_count' => 'integer',
            'trade_groups' => 'array',
            'is_vat_subject' => 'boolean',
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

    public function documents(): HasMany
    {
        return $this->hasMany(Document::class);
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
        $hasCompletedOrderWork = $this->bids()
            ->where('status', 'approved')
            ->whereHas('order', function ($query) use ($propertyId, $excludeOrderId) {
                $query->where('property_id', $propertyId)
                    ->where('status', 'completed');

                if ($excludeOrderId) {
                    $query->where('orders.id', '!=', $excludeOrderId);
                }
            })
            ->exists();

        if ($hasCompletedOrderWork) {
            return true;
        }

        return $this->documents()
            ->where('property_id', $propertyId)
            ->where('type', 'invoice')
            ->exists();
    }

    public function supportedServiceTypes(): array
    {
        return collect($this->trade_groups ?? [])
            ->flatMap(function ($tradeGroup) {
                $normalizedTradeGroup = strtolower((string) $tradeGroup);
                $resolvedServiceType = self::TRADE_GROUP_SERVICE_TYPE_MAP[$normalizedTradeGroup] ?? $normalizedTradeGroup;

                return array_filter([$normalizedTradeGroup, $resolvedServiceType]);
            })
            ->unique()
            ->values()
            ->all();
    }

    public function supportsServiceType(?string $serviceType): bool
    {
        if (! $serviceType) {
            return false;
        }

        $supportedServiceTypes = $this->supportedServiceTypes();

        if (empty($supportedServiceTypes)) {
            return true;
        }

        return in_array(strtolower($serviceType), $supportedServiceTypes, true);
    }
}
