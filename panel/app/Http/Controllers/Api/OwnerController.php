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

            return User::query()->create([
                'role_id' => $ownerRole->id,
                'name' => $request->string('name')->toString(),
                'email' => $request->string('email')->toString(),
                'password' => $request->string('password')->toString(),
                'phone' => $request->input('phone'),
                'status' => $request->input('status', 'active'),
            ]);
        });

        $owner->load('role')->loadCount('ownedProperties');

        return new OwnerResource($owner);
    }

    public function update(UpdateOwnerRequest $request, User $owner): OwnerResource
    {
        abort_unless($request->user() instanceof User && $request->user()->role?->name === 'admin', 403);
        abort_unless($owner->role?->name === 'owner', 404);

        $payload = $request->safe()->toArray();

        if (empty($payload['password'])) {
            unset($payload['password']);
        }

        $owner->update($payload);
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
}
