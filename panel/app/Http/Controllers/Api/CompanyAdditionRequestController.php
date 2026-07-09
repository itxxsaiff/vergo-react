<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CompanyAdditionRequest;
use App\Models\PropertyManagerProfile;
use App\Models\User;
use App\Notifications\SystemNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;

class CompanyAdditionRequestController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();

        abort_unless($actor instanceof User && in_array($actor->role?->name, ['admin', 'employee'], true), 403);

        $requests = CompanyAdditionRequest::query()
            ->with([
                'propertyManagerProfile:id,name,email',
                'property:id,li_number,title',
            ])
            ->latest()
            ->get()
            ->map(fn (CompanyAdditionRequest $companyRequest) => [
                'id' => $companyRequest->id,
                'company_name' => $companyRequest->company_name,
                'contact_name' => $companyRequest->contact_name,
                'email' => $companyRequest->email,
                'phone' => $companyRequest->phone,
                'canton' => $companyRequest->canton,
                'city' => $companyRequest->city,
                'notes' => $companyRequest->notes,
                'status' => $companyRequest->status,
                'property_manager' => $companyRequest->propertyManagerProfile ? [
                    'id' => $companyRequest->propertyManagerProfile->id,
                    'name' => $companyRequest->propertyManagerProfile->name,
                    'email' => $companyRequest->propertyManagerProfile->email,
                ] : null,
                'property' => $companyRequest->property ? [
                    'id' => $companyRequest->property->id,
                    'li_number' => $companyRequest->property->li_number,
                    'title' => $companyRequest->property->title,
                ] : null,
                'created_at' => $companyRequest->created_at?->toDateTimeString(),
            ]);

        return response()->json(['data' => $requests]);
    }

    public function store(Request $request): JsonResponse
    {
        $actor = $request->user();

        abort_unless($actor instanceof PropertyManagerProfile, 403, 'Only property managers can request a company addition.');

        $validated = $request->validate([
            'property_id' => ['nullable', 'integer', 'exists:properties,id'],
            'company_name' => ['required', 'string', 'max:255'],
            'contact_name' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:255'],
            'canton' => ['nullable', 'string', 'max:20'],
            'city' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ]);

        if (! empty($validated['property_id'])) {
            abort_unless((int) $validated['property_id'] === (int) $actor->property_id, 403);
        }

        $companyRequest = CompanyAdditionRequest::query()->create([
            'property_manager_profile_id' => $actor->id,
            'property_id' => $validated['property_id'] ?? $actor->property_id,
            'company_name' => $validated['company_name'],
            'contact_name' => $validated['contact_name'] ?? null,
            'email' => $validated['email'] ?? null,
            'phone' => $validated['phone'] ?? null,
            'canton' => $validated['canton'] ?? null,
            'city' => $validated['city'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'status' => 'pending',
        ]);

        $recipients = User::query()
            ->whereHas('role', fn ($query) => $query->where('name', 'admin'))
            ->get();

        Notification::send($recipients, new SystemNotification(
            title: 'Company Addition Requested',
            message: sprintf(
                '%s requested that "%s" be added as a service provider.',
                $actor->name ?: $actor->email,
                $companyRequest->company_name
            ),
            type: 'primary',
            actionUrl: '/service-providers',
        ));

        return response()->json([
            'message' => 'Company addition request submitted successfully.',
            'data' => [
                'id' => $companyRequest->id,
                'status' => $companyRequest->status,
            ],
        ], 201);
    }

    public function update(Request $request, CompanyAdditionRequest $companyAdditionRequest): JsonResponse
    {
        $actor = $request->user();

        abort_unless($actor instanceof User && in_array($actor->role?->name, ['admin', 'employee'], true), 403);

        $validated = $request->validate([
            'status' => ['required', 'string', 'in:pending,completed,dismissed'],
        ]);

        $companyAdditionRequest->update([
            'status' => $validated['status'],
        ]);

        return response()->json([
            'message' => 'Company addition request updated successfully.',
            'data' => [
                'id' => $companyAdditionRequest->id,
                'status' => $companyAdditionRequest->status,
            ],
        ]);
    }
}
