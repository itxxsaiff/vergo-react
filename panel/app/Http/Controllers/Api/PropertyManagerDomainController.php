<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePropertyManagerDomainRequest;
use App\Http\Requests\UpdatePropertyManagerDomainRequest;
use App\Http\Resources\PropertyManagerDomainResource;
use App\Models\PropertyManagerDomain;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PropertyManagerDomainController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        abort_unless($request->user() instanceof User && $request->user()->role?->name === 'admin', 403);

        return PropertyManagerDomainResource::collection(
            PropertyManagerDomain::query()
                ->with('property:id,li_number,title')
                ->latest()
                ->get()
        );
    }

    public function store(StorePropertyManagerDomainRequest $request): PropertyManagerDomainResource
    {
        abort_unless($request->user() instanceof User && $request->user()->role?->name === 'admin', 403);

        $domain = PropertyManagerDomain::query()->create([
            ...$request->safe()->toArray(),
            'is_active' => $request->boolean('is_active', true),
        ]);

        return new PropertyManagerDomainResource($domain->load('property:id,li_number,title'));
    }

    public function update(UpdatePropertyManagerDomainRequest $request, PropertyManagerDomain $propertyManagerDomain): PropertyManagerDomainResource
    {
        abort_unless($request->user() instanceof User && $request->user()->role?->name === 'admin', 403);

        $propertyManagerDomain->update($request->safe()->toArray());

        return new PropertyManagerDomainResource($propertyManagerDomain->load('property:id,li_number,title'));
    }

    public function destroy(Request $request, PropertyManagerDomain $propertyManagerDomain)
    {
        abort_unless($request->user() instanceof User && $request->user()->role?->name === 'admin', 403);

        $propertyManagerDomain->delete();

        return response()->json([
            'message' => 'Allowed domain deleted successfully.',
        ]);
    }
}
