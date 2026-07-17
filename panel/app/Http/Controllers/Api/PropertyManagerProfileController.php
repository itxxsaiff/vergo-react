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
                ->withCount('assignedProperties')
                ->withCount('orders')
                ->withCount([
                    'orders as active_orders_count' => fn ($query) => $query->whereNotIn('status', ['completed', 'closed']),
                ])
                ->latest()
                ->get()
        );
    }

    public function store(StorePropertyManagerProfileRequest $request): PropertyManagerProfileResource
    {
        $this->authorizeEmployeeManagement($request);

        $profile = PropertyManagerProfile::query()->create([
            'property_id' => $request->filled('property_id') ? $request->integer('property_id') : null,
            'name' => $request->input('name'),
            'email' => strtolower($request->string('email')->trim()->toString()),
            'phone' => $request->string('phone')->trim()->toString(),
            'address' => $request->string('address')->trim()->toString(),
            'postal_code' => $request->string('postal_code')->trim()->toString(),
            'city' => $request->string('city')->trim()->toString(),
            'canton' => strtoupper($request->string('canton')->trim()->toString()),
            'invoice_delivery_method' => $request->string('invoice_delivery_method')->trim()->toString(),
            'invoice_email' => $request->filled('invoice_email') ? strtolower($request->string('invoice_email')->trim()->toString()) : null,
            'invoice_company_name' => $request->filled('invoice_company_name') ? $request->string('invoice_company_name')->trim()->toString() : null,
            'invoice_company_extra' => $request->filled('invoice_company_extra') ? $request->string('invoice_company_extra')->trim()->toString() : null,
            'invoice_address' => $request->filled('invoice_address') ? $request->string('invoice_address')->trim()->toString() : null,
            'invoice_postal_code' => $request->filled('invoice_postal_code') ? $request->string('invoice_postal_code')->trim()->toString() : null,
            'invoice_city' => $request->filled('invoice_city') ? $request->string('invoice_city')->trim()->toString() : null,
            'domain_suffix' => strtolower(ltrim($request->string('domain_suffix')->trim()->toString(), '@')),
        ]);

        return new PropertyManagerProfileResource(
            $profile->load('property:id,li_number,title')
                ->loadCount('assignedProperties')
                ->loadCount('orders')
                ->loadCount([
                    'orders as active_orders_count' => fn ($query) => $query->whereNotIn('status', ['completed', 'closed']),
                ])
        );
    }

    public function update(UpdatePropertyManagerProfileRequest $request, PropertyManagerProfile $propertyManagerProfile): PropertyManagerProfileResource
    {
        $this->authorizeEmployeeManagement($request);

        $propertyManagerProfile->update([
            'property_id' => $request->filled('property_id') ? $request->integer('property_id') : $propertyManagerProfile->property_id,
            'name' => $request->input('name'),
            'email' => strtolower($request->string('email')->trim()->toString()),
            'phone' => $request->string('phone')->trim()->toString(),
            'address' => $request->string('address')->trim()->toString(),
            'postal_code' => $request->string('postal_code')->trim()->toString(),
            'city' => $request->string('city')->trim()->toString(),
            'canton' => strtoupper($request->string('canton')->trim()->toString()),
            'invoice_delivery_method' => $request->string('invoice_delivery_method')->trim()->toString(),
            'invoice_email' => $request->filled('invoice_email') ? strtolower($request->string('invoice_email')->trim()->toString()) : null,
            'invoice_company_name' => $request->filled('invoice_company_name') ? $request->string('invoice_company_name')->trim()->toString() : null,
            'invoice_company_extra' => $request->filled('invoice_company_extra') ? $request->string('invoice_company_extra')->trim()->toString() : null,
            'invoice_address' => $request->filled('invoice_address') ? $request->string('invoice_address')->trim()->toString() : null,
            'invoice_postal_code' => $request->filled('invoice_postal_code') ? $request->string('invoice_postal_code')->trim()->toString() : null,
            'invoice_city' => $request->filled('invoice_city') ? $request->string('invoice_city')->trim()->toString() : null,
            'domain_suffix' => strtolower(ltrim($request->string('domain_suffix')->trim()->toString(), '@')),
        ]);

        return new PropertyManagerProfileResource(
            $propertyManagerProfile->load('property:id,li_number,title')
                ->loadCount('assignedProperties')
                ->loadCount('orders')
                ->loadCount([
                    'orders as active_orders_count' => fn ($query) => $query->whereNotIn('status', ['completed', 'closed']),
                ])
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
