<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePropertyRequest;
use App\Http\Requests\UpdatePropertyRequest;
use App\Http\Resources\PropertyResource;
use App\Models\Property;
use App\Models\PropertyManagerProfile;
use App\Models\PropertyManagerDomain;
use App\Models\PropertyOwnerAssignment;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class PropertyController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $actor = $request->user();
        $query = Property::query()
            ->with(['owners:id,name,email', 'managerDomains'])
            ->withCount(['objects', 'orders', 'documents'])
            ->latest();

        if ($actor instanceof PropertyManagerProfile) {
            $query->whereKey($actor->property_id);
        } elseif ($actor instanceof User && $actor->role?->name === 'owner') {
            $query->whereHas('owners', fn ($ownerQuery) => $ownerQuery->where('users.id', $actor->id));
        }

        $properties = $query->get();

        return PropertyResource::collection($properties);
    }

    public function show(Request $request, Property $property): PropertyResource
    {
        $this->authorizePropertyAccess($request->user(), $property);

        $property->load([
            'owners:id,name,email',
            'managerDomains',
            'objects',
            'orders.propertyObject:id,name,type,reference',
            'documents.analysisResults',
            'analysisResults',
        ])
            ->loadCount(['objects', 'orders', 'documents']);

        return new PropertyResource($property);
    }

    public function store(StorePropertyRequest $request): PropertyResource
    {
        $actor = $request->user();
        abort_unless(
            $actor instanceof User && in_array($actor->role?->name, ['admin', 'owner', 'employee'], true),
            403
        );

        $property = DB::transaction(function () use ($request, $actor) {
            $payload = $request->safe()->except(['owner_id', 'manager_domains']);
            $payload['created_by'] = $actor->id;

            $property = Property::query()->create($payload);

            $ownerId = $actor->role?->name === 'owner'
                ? $actor->id
                : ($request->filled('owner_id') ? $request->integer('owner_id') : null);

            if ($ownerId) {
                PropertyOwnerAssignment::query()->updateOrCreate(
                    [
                        'property_id' => $property->id,
                        'owner_id' => $ownerId,
                    ],
                    [
                        'assigned_at' => now(),
                    ],
                );
            }

            $this->syncManagerDomains($property, $request->input('manager_domains', []));

            return $property;
        });

        $property->load(['owners:id,name,email', 'managerDomains'])->loadCount(['objects', 'orders', 'documents']);

        return new PropertyResource($property);
    }

    public function update(UpdatePropertyRequest $request, Property $property): PropertyResource
    {
        $actor = $request->user();
        abort_unless($actor instanceof User, 403);

        if ($actor->role?->name === 'owner') {
            abort_unless($property->owners()->where('users.id', $actor->id)->exists(), 403);
        } else {
            abort_unless(in_array($actor->role?->name, ['admin', 'employee'], true), 403);
        }

        DB::transaction(function () use ($request, $property, $actor) {
            $payload = $request->safe()->except(['owner_id', 'manager_domains']);

            $property->update($payload);

            if (in_array($actor->role?->name, ['admin', 'employee'], true) && $request->exists('owner_id')) {
                $property->ownerAssignments()->delete();

                if ($request->filled('owner_id')) {
                    PropertyOwnerAssignment::query()->create([
                        'property_id' => $property->id,
                        'owner_id' => $request->integer('owner_id'),
                        'assigned_at' => now(),
                    ]);
                }
            }

            if ($request->exists('manager_domains')) {
                $this->syncManagerDomains($property, $request->input('manager_domains', []));
            }
        });

        $property->load(['owners:id,name,email', 'managerDomains'])->loadCount(['objects', 'orders', 'documents']);

        return new PropertyResource($property);
    }

    public function destroy(Request $request, Property $property)
    {
        $actor = $request->user();
        abort_unless($actor instanceof User, 403);

        if ($actor->role?->name === 'owner') {
            abort_unless($property->owners()->where('users.id', $actor->id)->exists(), 403);
        } else {
            abort_unless($actor->role?->name === 'admin', 403);
        }

        $property->delete();

        return response()->json([
            'message' => 'Property deleted successfully.',
        ]);
    }

    private function syncManagerDomains(Property $property, array $domains): void
    {
        $normalizedDomains = collect($domains)
            ->map(fn ($domain) => strtolower(trim((string) $domain)))
            ->filter()
            ->unique()
            ->values();

        $property->managerDomains()->delete();

        $normalizedDomains->each(function (string $domain) use ($property): void {
            PropertyManagerDomain::query()->create([
                'property_id' => $property->id,
                'domain' => $domain,
                'is_active' => true,
            ]);
        });
    }

    private function authorizePropertyAccess(mixed $actor, Property $property): void
    {
        if ($actor instanceof User && in_array($actor->role?->name, ['admin', 'employee'], true)) {
            return;
        }

        if ($actor instanceof User && $actor->role?->name === 'owner') {
            abort_unless(
                $property->owners()->where('users.id', $actor->id)->exists(),
                403
            );

            return;
        }

        if ($actor instanceof PropertyManagerProfile) {
            abort_unless($actor->property_id === $property->id, 403);

            return;
        }

        abort(403);
    }
}
