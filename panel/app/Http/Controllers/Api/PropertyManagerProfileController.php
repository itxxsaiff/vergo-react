<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdatePropertyManagerProfileRequest;
use App\Http\Resources\PropertyManagerProfileResource;
use App\Models\PropertyManagerProfile;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PropertyManagerProfileController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        abort_unless($request->user() instanceof User && $request->user()->role?->name === 'admin', 403);

        return PropertyManagerProfileResource::collection(
            PropertyManagerProfile::query()
                ->with('property:id,li_number,title')
                ->withCount('orders')
                ->latest()
                ->get()
        );
    }

    public function update(UpdatePropertyManagerProfileRequest $request, PropertyManagerProfile $propertyManagerProfile): PropertyManagerProfileResource
    {
        abort_unless($request->user() instanceof User && $request->user()->role?->name === 'admin', 403);

        $propertyManagerProfile->update($request->safe()->toArray());

        return new PropertyManagerProfileResource(
            $propertyManagerProfile->load('property:id,li_number,title')->loadCount('orders')
        );
    }

    public function destroy(Request $request, PropertyManagerProfile $propertyManagerProfile)
    {
        abort_unless($request->user() instanceof User && $request->user()->role?->name === 'admin', 403);

        $propertyManagerProfile->delete();

        return response()->json([
            'message' => 'Property manager deleted successfully.',
        ]);
    }
}
