<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Models\Order;
use App\Models\Property;
use App\Models\PropertyManagerProfile;
use App\Models\ServiceProvider;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $actor = $request->user();

        if ($actor instanceof PropertyManagerProfile) {
            return response()->json([
                'data' => [
                    'properties' => 1,
                    'owners' => 0,
                    'orders' => Order::where('property_id', $actor->property_id)
                        ->where('requester_email', $actor->email)
                        ->count(),
                    'documents' => Document::where('property_id', $actor->property_id)->count(),
                    'service_providers' => 0,
                ],
            ]);
        }

        if ($actor instanceof User && $actor->role?->name === 'owner') {
            $ownedPropertyIds = $actor->ownedProperties()->pluck('properties.id');

            return response()->json([
                'data' => [
                    'properties' => $ownedPropertyIds->count(),
                    'owners' => 1,
                    'orders' => Order::whereIn('property_id', $ownedPropertyIds)->count(),
                    'documents' => Document::whereIn('property_id', $ownedPropertyIds)->count(),
                    'service_providers' => 0,
                ],
            ]);
        }

        if ($actor instanceof User && $actor->role?->name === 'provider') {
            $serviceProvider = $actor->serviceProvider;

            return response()->json([
                'data' => [
                    'properties' => 0,
                    'owners' => 0,
                    'orders' => Order::whereIn('status', ['open', 'in_review'])->count(),
                    'documents' => 0,
                    'service_providers' => $serviceProvider ? 1 : 0,
                    'bids' => $serviceProvider ? $serviceProvider->bids()->count() : 0,
                ],
            ]);
        }

        return response()->json([
            'data' => [
                'properties' => Property::count(),
                'owners' => User::whereHas('role', fn ($query) => $query->where('name', 'owner'))->count(),
                'orders' => Order::count(),
                'documents' => Document::count(),
                'service_providers' => ServiceProvider::count(),
            ],
        ]);
    }
}
