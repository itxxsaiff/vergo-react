<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreServiceProviderRequest;
use App\Http\Requests\UpdateServiceProviderRequest;
use App\Http\Resources\ServiceProviderResource;
use App\Models\Role;
use App\Models\ServiceProvider;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ServiceProviderController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        abort_unless($request->user() instanceof User && $request->user()->role?->name === 'admin', 403);

        return ServiceProviderResource::collection(
            ServiceProvider::query()->withCount('bids')->latest()->get()
        );
    }

    public function store(StoreServiceProviderRequest $request): ServiceProviderResource
    {
        abort_unless($request->user() instanceof User && $request->user()->role?->name === 'admin', 403);

        $provider = DB::transaction(function () use ($request) {
            $providerRole = Role::query()->where('name', 'provider')->firstOrFail();
            $status = $request->input('status', 'active');

            $user = User::query()->create([
                'role_id' => $providerRole->id,
                'name' => $request->input('contact_name') ?: $request->string('company_name')->toString(),
                'email' => $request->string('contact_email')->toString(),
                'password' => $request->string('password')->toString(),
                'status' => $status === 'pending' ? 'inactive' : $status,
                'phone' => $request->input('phone'),
            ]);

            return ServiceProvider::query()->create([
                'user_id' => $user->id,
                'company_name' => $request->string('company_name')->toString(),
                'contact_name' => $request->input('contact_name'),
                'contact_email' => $request->string('contact_email')->toString(),
                'phone' => $request->input('phone'),
                'status' => $status,
            ]);
        });

        return new ServiceProviderResource($provider->loadCount('bids'));
    }

    public function update(UpdateServiceProviderRequest $request, ServiceProvider $serviceProvider): ServiceProviderResource
    {
        abort_unless($request->user() instanceof User && $request->user()->role?->name === 'admin', 403);

        DB::transaction(function () use ($request, $serviceProvider) {
            $serviceProvider->update($request->safe()->except('password'));

            $user = $serviceProvider->user;

            if (! $user) {
                $providerRole = Role::query()->where('name', 'provider')->firstOrFail();

                $user = User::query()->create([
                    'role_id' => $providerRole->id,
                    'name' => $request->input('contact_name') ?: $request->input('company_name', $serviceProvider->company_name),
                    'email' => $request->input('contact_email', $serviceProvider->contact_email),
                    'password' => $request->input('password', 'password123'),
                    'status' => $request->input('status', $serviceProvider->status) === 'pending' ? 'inactive' : $request->input('status', $serviceProvider->status),
                    'phone' => $request->input('phone', $serviceProvider->phone),
                ]);

                $serviceProvider->update(['user_id' => $user->id]);
            } else {
                $userPayload = [
                    'name' => $request->input('contact_name', $serviceProvider->contact_name) ?: $request->input('company_name', $serviceProvider->company_name),
                    'email' => $request->input('contact_email', $serviceProvider->contact_email),
                    'status' => $request->input('status', $serviceProvider->status) === 'pending' ? 'inactive' : $request->input('status', $serviceProvider->status),
                    'phone' => $request->input('phone', $serviceProvider->phone),
                ];

                if ($request->filled('password')) {
                    $userPayload['password'] = $request->string('password')->toString();
                }

                $user->update($userPayload);
            }
        });

        return new ServiceProviderResource($serviceProvider->fresh()->loadCount('bids'));
    }

    public function destroy(Request $request, ServiceProvider $serviceProvider)
    {
        abort_unless($request->user() instanceof User && $request->user()->role?->name === 'admin', 403);

        DB::transaction(function () use ($serviceProvider) {
            $linkedUser = $serviceProvider->user;
            $serviceProvider->delete();
            $linkedUser?->delete();
        });

        return response()->json([
            'message' => 'Service provider deleted successfully.',
        ]);
    }
}
