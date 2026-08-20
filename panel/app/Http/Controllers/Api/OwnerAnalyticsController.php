<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\User;
use App\Services\OwnerAnalyticsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OwnerAnalyticsController extends Controller
{
    /**
     * Portfolio figures across every property the owner holds.
     */
    public function analytics(Request $request, OwnerAnalyticsService $analytics): JsonResponse
    {
        $owner = $this->authorizeOwner($request);

        return response()->json(['data' => $analytics->build($owner)]);
    }

    /**
     * Orders the system flagged as likely duplicates, with the manager's
     * explanation, so the owner can see who split or re-raised work.
     */
    public function duplicates(Request $request): JsonResponse
    {
        $owner = $this->authorizeOwner($request);
        $propertyIds = $owner->ownedProperties()->pluck('properties.id');

        $flagged = Order::query()
            ->withTrashed()
            ->with(['property:id,li_number,title', 'propertyManager:id,name,email', 'duplicateOfOrder:id,order_number,title,cancelled_at,cancellation_reason'])
            ->whereIn('property_id', $propertyIds)
            ->whereNotNull('duplicate_of_order_id')
            ->latest()
            ->get()
            ->map(fn (Order $order): array => [
                'order_id' => $order->id,
                'order_number' => $order->order_number,
                'title' => $order->title,
                'property' => $order->property?->title ?: $order->property?->li_number,
                'manager_name' => $order->propertyManager?->name,
                'manager_email' => $order->propertyManager?->email ?: $order->requester_email,
                'similarity' => $order->duplicate_similarity !== null ? (float) $order->duplicate_similarity : null,
                'reason' => $order->duplicate_reason,
                // The mandatory explanation the manager had to give.
                'explanation' => $order->duplicate_explanation,
                'acknowledged_at' => $order->duplicate_acknowledged_at?->toDateTimeString(),
                'duplicate_of' => $order->duplicateOfOrder ? [
                    'order_number' => $order->duplicateOfOrder->order_number,
                    'title' => $order->duplicateOfOrder->title,
                    'cancelled_at' => $order->duplicateOfOrder->cancelled_at?->toDateTimeString(),
                    'cancellation_reason' => $order->duplicateOfOrder->cancellation_reason,
                ] : null,
                'created_at' => $order->created_at?->toDateTimeString(),
            ]);

        return response()->json(['data' => $flagged]);
    }

    private function authorizeOwner(Request $request): User
    {
        $actor = $request->user();

        abort_unless($actor instanceof User && $actor->role?->name === 'owner', 403);

        return $actor;
    }
}
