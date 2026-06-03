<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreServiceProviderRequest;
use App\Http\Requests\UpdateServiceProviderRequest;
use App\Http\Resources\ServiceProviderResource;
use App\Models\Role;
use App\Models\ServiceProvider;
use App\Models\PropertyManagerProfile;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ServiceProviderController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $actor = $request->user();
        abort_unless(
            ($actor instanceof User && in_array($actor->role?->name, ['admin', 'employee'], true))
            || $actor instanceof PropertyManagerProfile,
            403
        );

        return ServiceProviderResource::collection(
            ServiceProvider::query()->withCount('bids')->latest()->get()
        );
    }

    public function store(StoreServiceProviderRequest $request): ServiceProviderResource
    {
        abort_unless($request->user() instanceof User && in_array($request->user()->role?->name, ['admin', 'employee'], true), 403);

        $provider = DB::transaction(function () use ($request) {
            $providerRole = Role::query()->where('name', 'provider')->firstOrFail();
            $status = $request->input('status', 'active');
            $providerPayload = $this->buildProviderPayload($request);

            $user = User::query()->create([
                'role_id' => $providerRole->id,
                'name' => $providerPayload['contact_name'] ?: $providerPayload['company_name'],
                'email' => $providerPayload['order_email'],
                'password' => bin2hex(random_bytes(16)),
                'domain_suffix' => $providerPayload['domain_suffix'],
                'status' => $status === 'pending' ? 'inactive' : $status,
                'phone' => $providerPayload['phone'],
            ]);

            return ServiceProvider::query()->create([
                'user_id' => $user->id,
                ...$providerPayload,
                'status' => $status,
            ]);
        });

        return new ServiceProviderResource($provider->loadCount('bids'));
    }

    public function update(UpdateServiceProviderRequest $request, ServiceProvider $serviceProvider): ServiceProviderResource
    {
        abort_unless($request->user() instanceof User && in_array($request->user()->role?->name, ['admin', 'employee'], true), 403);

        DB::transaction(function () use ($request, $serviceProvider) {
            $providerPayload = $this->buildProviderPayload($request);
            $serviceProvider->update($providerPayload + [
                'status' => $request->input('status', $serviceProvider->status),
            ]);

            $user = $serviceProvider->user;

            if (! $user) {
                $providerRole = Role::query()->where('name', 'provider')->firstOrFail();

                $user = User::query()->create([
                    'role_id' => $providerRole->id,
                    'name' => $providerPayload['contact_name'] ?: $providerPayload['company_name'],
                    'email' => $providerPayload['order_email'],
                    'password' => bin2hex(random_bytes(16)),
                    'domain_suffix' => $providerPayload['domain_suffix'],
                    'status' => $request->input('status', $serviceProvider->status) === 'pending' ? 'inactive' : $request->input('status', $serviceProvider->status),
                    'phone' => $providerPayload['phone'],
                ]);

                $serviceProvider->update(['user_id' => $user->id]);
            } else {
                $userPayload = [
                    'name' => $providerPayload['contact_name'] ?: $providerPayload['company_name'],
                    'email' => $providerPayload['order_email'],
                    'domain_suffix' => $providerPayload['domain_suffix'],
                    'status' => $request->input('status', $serviceProvider->status) === 'pending' ? 'inactive' : $request->input('status', $serviceProvider->status),
                    'phone' => $providerPayload['phone'],
                ];

                $user->update($userPayload);
            }
        });

        return new ServiceProviderResource($serviceProvider->fresh()->loadCount('bids'));
    }

    public function destroy(Request $request, ServiceProvider $serviceProvider)
    {
        abort_unless($request->user() instanceof User && in_array($request->user()->role?->name, ['admin', 'employee'], true), 403);

        DB::transaction(function () use ($serviceProvider) {
            $linkedUser = $serviceProvider->user;
            $serviceProvider->delete();
            $linkedUser?->delete();
        });

        return response()->json([
            'message' => 'Service provider deleted successfully.',
        ]);
    }

    private function buildProviderPayload(Request $request): array
    {
        $contactEmail = strtolower($request->string('contact_email')->trim()->toString());
        $orderEmail = $request->filled('order_email')
            ? strtolower($request->string('order_email')->trim()->toString())
            : $contactEmail;

        return [
            'company_name' => $request->string('company_name')->trim()->toString(),
            'contact_name' => $request->filled('contact_name') ? $request->string('contact_name')->trim()->toString() : null,
            'contact_email' => $contactEmail,
            'order_email' => $orderEmail,
            'address' => $request->string('address')->trim()->toString(),
            'postal_code' => $request->string('postal_code')->trim()->toString(),
            'city' => $request->string('city')->trim()->toString(),
            'domain_suffix' => ltrim(strtolower($request->string('domain_suffix')->trim()->toString()), '@'),
            'trade_groups' => array_values($request->input('trade_groups', [])),
            'phone' => $request->string('phone')->trim()->toString(),
        ];
    }
}
