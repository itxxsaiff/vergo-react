<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePropertyManagerProfileRequest;
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
        $this->authorizeEmployeeManagement($request);

        return PropertyManagerProfileResource::collection(
            PropertyManagerProfile::query()
                ->with('property:id,li_number,title')
                ->withCount('orders')
                ->latest()
                ->get()
        );
    }

    public function store(StorePropertyManagerProfileRequest $request): PropertyManagerProfileResource
    {
        $this->authorizeEmployeeManagement($request);

        $profile = PropertyManagerProfile::query()->create([
            'property_id' => $request->integer('property_id'),
            'name' => $request->input('name'),
            'email' => strtolower($request->string('email')->trim()->toString()),
        ]);

        return new PropertyManagerProfileResource(
            $profile->load('property:id,li_number,title')->loadCount('orders')
        );
    }

    public function update(UpdatePropertyManagerProfileRequest $request, PropertyManagerProfile $propertyManagerProfile): PropertyManagerProfileResource
    {
        $this->authorizeEmployeeManagement($request);

        $propertyManagerProfile->update($request->safe()->toArray());

        return new PropertyManagerProfileResource(
            $propertyManagerProfile->load('property:id,li_number,title')->loadCount('orders')
        );
    }

    public function destroy(Request $request, PropertyManagerProfile $propertyManagerProfile)
    {
        $this->authorizeEmployeeManagement($request);

        $propertyManagerProfile->delete();

        return response()->json([
            'message' => 'Property manager deleted successfully.',
        ]);
    }

    private function authorizeEmployeeManagement(Request $request): void
    {
        abort_unless(
            $request->user() instanceof User
            && in_array($request->user()->role?->name, ['admin', 'employee'], true),
            403
        );
    }
}
