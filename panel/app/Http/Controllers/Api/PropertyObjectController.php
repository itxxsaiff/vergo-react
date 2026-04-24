<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePropertyObjectRequest;
use App\Http\Requests\UpdatePropertyObjectRequest;
use App\Http\Resources\PropertyObjectResource;
use App\Models\PropertyObject;
use App\Models\PropertyManagerProfile;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PropertyObjectController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $actor = $request->user();
        $query = PropertyObject::query()
            ->with('property:id,li_number,title')
            ->latest();

        if ($actor instanceof PropertyManagerProfile) {
            $query->where('property_id', $actor->property_id);
        } elseif ($actor instanceof User && $actor->role?->name === 'owner') {
            $query->whereHas('property.owners', fn ($ownerQuery) => $ownerQuery->where('users.id', $actor->id));
        }

        return PropertyObjectResource::collection($query->get());
    }

    public function store(StorePropertyObjectRequest $request): PropertyObjectResource
    {
        $actor = $request->user();
        abort_unless($actor instanceof User, 403);

        if ($actor->role?->name === 'owner') {
            abort_unless(
                PropertyObject::query()
                    ->where('property_id', $request->integer('property_id'))
                    ->whereHas('property.owners', fn ($ownerQuery) => $ownerQuery->where('users.id', $actor->id))
                    ->exists()
                || \App\Models\Property::query()
                    ->whereKey($request->integer('property_id'))
                    ->whereHas('owners', fn ($ownerQuery) => $ownerQuery->where('users.id', $actor->id))
                    ->exists(),
                403
            );
        } else {
            abort_unless($actor->role?->name === 'admin', 403);
        }

        $object = PropertyObject::query()->create([
            ...$request->safe()->toArray(),
            'status' => $request->input('status', 'active'),
        ]);

        return new PropertyObjectResource($object->load('property:id,li_number,title'));
    }

    public function update(UpdatePropertyObjectRequest $request, PropertyObject $propertyObject): PropertyObjectResource
    {
        $actor = $request->user();
        abort_unless($actor instanceof User, 403);

        if ($actor->role?->name === 'owner') {
            abort_unless(
                $propertyObject->property()->whereHas('owners', fn ($ownerQuery) => $ownerQuery->where('users.id', $actor->id))->exists(),
                403
            );
        } else {
            abort_unless($actor->role?->name === 'admin', 403);
        }

        $propertyObject->update($request->safe()->toArray());

        return new PropertyObjectResource($propertyObject->load('property:id,li_number,title'));
    }

    public function destroy(Request $request, PropertyObject $propertyObject)
    {
        $actor = $request->user();
        abort_unless($actor instanceof User, 403);

        if ($actor->role?->name === 'owner') {
            abort_unless(
                $propertyObject->property()->whereHas('owners', fn ($ownerQuery) => $ownerQuery->where('users.id', $actor->id))->exists(),
                403
            );
        } else {
            abort_unless($actor->role?->name === 'admin', 403);
        }

        $propertyObject->delete();

        return response()->json([
            'message' => 'Property object deleted successfully.',
        ]);
    }
}
