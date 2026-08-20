<?php

namespace App\Services;

use App\Models\Bid;
use App\Models\Order;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Portfolio analytics for a property owner: volumes, spend and supplier
 * performance across every property they own.
 *
 * "Spend" always means the awarded bid amount of a completed order, so figures
 * reflect money actually committed rather than quotes received.
 */
class OwnerAnalyticsService
{
    /**
     * @return array<string, mixed>
     */
    public function build(User $owner): array
    {
        $propertyIds = $owner->ownedProperties()->pluck('properties.id');

        if ($propertyIds->isEmpty()) {
            return $this->emptyResult();
        }

        $orders = Order::query()
            ->withTrashed()
            ->with([
                'property:id,li_number,title,postal_code,city,state,management',
                'propertyObject:id,name,address,postal_code,city',
                'propertyManager:id,name,email',
                'approvedBid.serviceProvider:id,company_name',
            ])
            ->whereIn('property_id', $propertyIds)
            ->get();

        return [
            'totals' => $this->totals($orders),
            'spend_by_property' => $this->spendByProperty($orders),
            'spend_by_object' => $this->spendByObject($orders),
            'spend_by_canton' => $this->spendByCanton($orders),
            'orders_by_property' => $this->countBy($orders, fn (Order $o): ?string => $o->property?->title ?: $o->property?->li_number),
            'orders_by_object' => $this->countBy($orders, fn (Order $o): ?string => $o->propertyObject?->name ?: $o->propertyObject?->address),
            'orders_by_management' => $this->countBy($orders, fn (Order $o): ?string => $o->property?->management ?: $o->propertyManager?->name),
            'orders_by_manager_email' => $this->countBy($orders, fn (Order $o): ?string => $o->propertyManager?->email ?: $o->requester_email),
            'providers' => $this->providerBreakdown($orders),
            'providers_by_property' => $this->providerByProperty($orders),
            'top_services_by_property' => $this->topServicesByProperty($orders),
            'cancellations_by_manager' => $this->cancellationsByManager($orders),
        ];
    }

    /**
     * @param  Collection<int, Order>  $orders
     * @return array<string, mixed>
     */
    private function totals(Collection $orders): array
    {
        $completed = $orders->filter(fn (Order $o): bool => $o->status === 'completed');

        return [
            'order_count' => $orders->count(),
            'active_order_count' => $orders->filter(fn (Order $o): bool => $this->isActive($o))->count(),
            'completed_order_count' => $completed->count(),
            'cancelled_order_count' => $orders->filter(fn (Order $o): bool => $this->isCancelled($o))->count(),
            'total_spend' => round($completed->sum(fn (Order $o): float => $this->awardedAmount($o)), 2),
            'property_count' => $orders->pluck('property_id')->unique()->count(),
        ];
    }

    /**
     * @param  Collection<int, Order>  $orders
     * @return array<int, array<string, mixed>>
     */
    private function spendByProperty(Collection $orders): array
    {
        return $this->spendGroup($orders, fn (Order $o): ?string => $o->property?->title ?: $o->property?->li_number);
    }

    /**
     * @param  Collection<int, Order>  $orders
     * @return array<int, array<string, mixed>>
     */
    private function spendByObject(Collection $orders): array
    {
        return $this->spendGroup($orders, fn (Order $o): ?string => $o->propertyObject?->name ?: $o->propertyObject?->address);
    }

    /**
     * @param  Collection<int, Order>  $orders
     * @return array<int, array<string, mixed>>
     */
    private function spendByCanton(Collection $orders): array
    {
        // Swiss properties carry the canton in the `state` column.
        return $this->spendGroup($orders, fn (Order $o): ?string => $o->property?->state);
    }

    /**
     * @param  Collection<int, Order>  $orders
     * @return array<int, array<string, mixed>>
     */
    private function spendGroup(Collection $orders, callable $key): array
    {
        return $orders
            ->filter(fn (Order $o): bool => $key($o) !== null && $key($o) !== '')
            ->groupBy($key)
            ->map(fn (Collection $group, string $label): array => [
                'label' => $label,
                'order_count' => $group->count(),
                'completed_count' => $group->filter(fn (Order $o): bool => $o->status === 'completed')->count(),
                'total_spend' => round(
                    $group->filter(fn (Order $o): bool => $o->status === 'completed')
                        ->sum(fn (Order $o): float => $this->awardedAmount($o)),
                    2
                ),
            ])
            ->sortByDesc('total_spend')
            ->values()
            ->all();
    }

    /**
     * @param  Collection<int, Order>  $orders
     * @return array<int, array<string, mixed>>
     */
    private function countBy(Collection $orders, callable $key): array
    {
        return $orders
            ->filter(fn (Order $o): bool => filled($key($o)))
            ->groupBy($key)
            ->map(fn (Collection $group, string $label): array => [
                'label' => $label,
                'order_count' => $group->count(),
            ])
            ->sortByDesc('order_count')
            ->values()
            ->all();
    }

    /**
     * How many orders each supplier completed for this owner, and the revenue
     * they earned from them.
     *
     * @param  Collection<int, Order>  $orders
     * @return array<int, array<string, mixed>>
     */
    private function providerBreakdown(Collection $orders): array
    {
        return $orders
            ->filter(fn (Order $o): bool => $o->approvedBid?->serviceProvider !== null)
            ->groupBy(fn (Order $o): string => $o->approvedBid->serviceProvider->company_name ?: '-')
            ->map(function (Collection $group, string $company): array {
                $completed = $group->filter(fn (Order $o): bool => $o->status === 'completed');

                return [
                    'company_name' => $company,
                    'awarded_count' => $group->count(),
                    'completed_count' => $completed->count(),
                    'revenue' => round($completed->sum(fn (Order $o): float => $this->awardedAmount($o)), 2),
                ];
            })
            ->sortByDesc('revenue')
            ->values()
            ->all();
    }

    /**
     * @param  Collection<int, Order>  $orders
     * @return array<int, array<string, mixed>>
     */
    private function providerByProperty(Collection $orders): array
    {
        return $orders
            ->filter(fn (Order $o): bool => $o->approvedBid?->serviceProvider !== null && $o->property !== null)
            ->groupBy(fn (Order $o): string => ($o->property->title ?: $o->property->li_number).'|'.$o->approvedBid->serviceProvider->company_name)
            ->map(function (Collection $group, string $key): array {
                [$property, $company] = array_pad(explode('|', $key, 2), 2, '-');
                $completed = $group->filter(fn (Order $o): bool => $o->status === 'completed');

                return [
                    'property' => $property,
                    'company_name' => $company,
                    'awarded_count' => $group->count(),
                    'completed_count' => $completed->count(),
                    'revenue' => round($completed->sum(fn (Order $o): float => $this->awardedAmount($o)), 2),
                ];
            })
            ->sortByDesc('completed_count')
            ->values()
            ->all();
    }

    /**
     * The most frequently requested trade per property.
     *
     * @param  Collection<int, Order>  $orders
     * @return array<int, array<string, mixed>>
     */
    private function topServicesByProperty(Collection $orders): array
    {
        return $orders
            ->filter(fn (Order $o): bool => $o->property !== null && filled($o->service_type))
            ->groupBy(fn (Order $o): string => $o->property->title ?: $o->property->li_number)
            ->map(function (Collection $group, string $property): array {
                $services = $group->groupBy('service_type')
                    ->map(fn (Collection $rows, string $service): array => [
                        'service_type' => $service,
                        'order_count' => $rows->count(),
                    ])
                    ->sortByDesc('order_count')
                    ->values();

                return [
                    'property' => $property,
                    'services' => $services->all(),
                    'top_service' => $services->first()['service_type'] ?? null,
                ];
            })
            ->values()
            ->all();
    }

    /**
     * Which property manager cancelled how many orders.
     *
     * @param  Collection<int, Order>  $orders
     * @return array<int, array<string, mixed>>
     */
    private function cancellationsByManager(Collection $orders): array
    {
        return $orders
            ->filter(fn (Order $o): bool => $this->isCancelled($o))
            ->groupBy(fn (Order $o): string => $o->propertyManager?->email ?: ($o->requester_email ?: '-'))
            ->map(fn (Collection $group, string $email): array => [
                'manager_email' => $email,
                'manager_name' => $group->first()->propertyManager?->name,
                'cancelled_count' => $group->count(),
            ])
            ->sortByDesc('cancelled_count')
            ->values()
            ->all();
    }

    private function awardedAmount(Order $order): float
    {
        return (float) ($order->approvedBid?->amount ?? 0);
    }

    private function isCancelled(Order $order): bool
    {
        return $order->cancelled_at !== null || $order->deleted_at !== null;
    }

    private function isActive(Order $order): bool
    {
        return ! $this->isCancelled($order) && ! in_array($order->status, ['completed', 'closed'], true);
    }

    /**
     * @return array<string, mixed>
     */
    private function emptyResult(): array
    {
        return [
            'totals' => [
                'order_count' => 0, 'active_order_count' => 0, 'completed_order_count' => 0,
                'cancelled_order_count' => 0, 'total_spend' => 0, 'property_count' => 0,
            ],
            'spend_by_property' => [], 'spend_by_object' => [], 'spend_by_canton' => [],
            'orders_by_property' => [], 'orders_by_object' => [], 'orders_by_management' => [],
            'orders_by_manager_email' => [], 'providers' => [], 'providers_by_property' => [],
            'top_services_by_property' => [], 'cancellations_by_manager' => [],
        ];
    }
}
