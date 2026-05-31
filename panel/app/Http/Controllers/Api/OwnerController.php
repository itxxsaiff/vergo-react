<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreOwnerRequest;
use App\Http\Requests\UpdateOwnerRequest;
use App\Http\Resources\OwnerResource;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class OwnerController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        abort_unless($request->user() instanceof User && $request->user()->role?->name === 'admin', 403);

        $owners = User::query()
            ->with('role')
            ->withCount('ownedProperties')
            ->whereHas('role', fn ($query) => $query->where('name', 'owner'))
            ->latest()
            ->get();

        return OwnerResource::collection($owners);
    }

    public function store(StoreOwnerRequest $request): OwnerResource
    {
        abort_unless($request->user() instanceof User && $request->user()->role?->name === 'admin', 403);

        $owner = DB::transaction(function () use ($request) {
            $ownerRole = Role::query()->firstOrCreate(
                ['name' => 'owner'],
                ['label' => 'Owner'],
            );

            return User::query()->create($this->buildOwnerPayload($request, $ownerRole->id));
        });

        $owner->load('role')->loadCount('ownedProperties');

        return new OwnerResource($owner);
    }

    public function update(UpdateOwnerRequest $request, User $owner): OwnerResource
    {
        abort_unless($request->user() instanceof User && $request->user()->role?->name === 'admin', 403);
        abort_unless($owner->role?->name === 'owner', 404);

        $owner->update($this->buildOwnerPayload($request, $owner->role_id, $owner));
        $owner->load('role')->loadCount('ownedProperties');

        return new OwnerResource($owner);
    }

    public function destroy(Request $request, User $owner)
    {
        abort_unless($request->user() instanceof User && $request->user()->role?->name === 'admin', 403);
        abort_unless($owner->role?->name === 'owner', 404);

        $owner->delete();

        return response()->json([
            'message' => 'Owner deleted successfully.',
        ]);
    }

    private function buildOwnerPayload(Request $request, int $roleId, ?User $existingOwner = null): array
    {
        $ownerType = $request->string('owner_type')->toString();
        $isCompany = $ownerType === 'company';
        $companyName = $isCompany ? $request->string('company_name')->trim()->toString() : null;
        $firstName = $isCompany ? null : $request->string('first_name')->trim()->toString();
        $lastName = $isCompany ? null : $request->string('last_name')->trim()->toString();
        $displayName = $isCompany
            ? $companyName
            : trim(implode(' ', array_filter([$firstName, $lastName])));
        $ownerEmail = strtolower($request->string('email')->trim()->toString());
        $domainSuffix = $isCompany ? ltrim(strtolower($request->string('domain_suffix')->trim()->toString()), '@') : null;

        return [
            'role_id' => $roleId,
            'owner_type' => $ownerType,
            'name' => $displayName,
            'company_name' => $companyName,
            'first_name' => $firstName,
            'last_name' => $lastName,
            'address' => $request->string('address')->trim()->toString(),
            'postal_code' => $request->string('postal_code')->trim()->toString(),
            'city' => $request->string('city')->trim()->toString(),
            'domain_suffix' => $domainSuffix,
            'login_email' => $ownerEmail,
            'email' => $ownerEmail,
            'phone' => $isCompany ? null : $request->string('phone')->trim()->toString(),
            'status' => $request->input('status', $existingOwner?->status ?? 'active'),
            'password' => $existingOwner?->password ?? bin2hex(random_bytes(16)),
        ];
    }
}
