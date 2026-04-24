<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ServiceProviderResource;
use App\Http\Resources\UserDirectoryAdminResource;
use App\Http\Resources\UserDirectoryOwnerResource;
use App\Models\ServiceProvider;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class UserDirectoryController extends Controller
{
    public function owners(Request $request): AnonymousResourceCollection
    {
        $this->authorizeDirectoryAccess($request);

        $owners = User::query()
            ->withCount('ownedProperties')
            ->with([
                'ownedProperties' => fn ($query) => $query
                    ->select('properties.id', 'address_line_1', 'address_line_2', 'postal_code', 'city')
                    ->orderBy('properties.id'),
            ])
            ->whereHas('role', fn ($query) => $query->where('name', 'owner'))
            ->latest()
            ->get();

        return UserDirectoryOwnerResource::collection($owners);
    }

    public function serviceProviders(Request $request): AnonymousResourceCollection
    {
        $this->authorizeDirectoryAccess($request);

        return ServiceProviderResource::collection(
            ServiceProvider::query()->withCount('bids')->latest()->get()
        );
    }

    public function admins(Request $request): AnonymousResourceCollection
    {
        $this->authorizeDirectoryAccess($request);

        $admins = User::query()
            ->whereHas('role', fn ($query) => $query->where('name', 'admin'))
            ->latest()
            ->get();

        return UserDirectoryAdminResource::collection($admins);
    }

    private function authorizeDirectoryAccess(Request $request): void
    {
        abort_unless(
            $request->user() instanceof User
            && in_array($request->user()->role?->name, ['admin', 'employee'], true),
            403
        );
    }
}
