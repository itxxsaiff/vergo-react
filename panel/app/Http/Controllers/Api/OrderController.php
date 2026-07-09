<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreOrderRequest;
use App\Http\Requests\UpdateOrderRequest;
use App\Http\Resources\OrderResource;
use App\Models\Bid;
use App\Models\Order;
use App\Models\Property;
use App\Models\PropertyManagerProfile;
use App\Models\PropertyObject;
use App\Models\ServiceProvider;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class OrderController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $actor = $request->user();

        $query = Order::query()
            ->with([
                'property:id,li_number,title,postal_code,city,country',
                'propertyObject:id,name,address,postal_code,city,type,reference',
                'propertyManager:id,name,email',
                'approvedBid.serviceProvider:id,company_name,contact_email',
            ])
            ->withCount('bids')
            ->latest();

        if ($actor instanceof User && $actor->role?->name === 'provider') {
            $serviceProvider = $actor->serviceProvider;
            abort_unless($serviceProvider, 403);
            $supportedServiceTypes = $serviceProvider->supportedServiceTypes();

            $query->where(function ($providerQuery) use ($serviceProvider, $supportedServiceTypes) {
                $providerQuery
                    ->where(function ($publicQuery) use ($supportedServiceTypes) {
                        $publicQuery
                            ->whereIn('workflow_status', ['public_inspection_open', 'inspection_signup_closed', 'published_for_quotes']);

                        if (! empty($supportedServiceTypes)) {
                            $publicQuery->whereIn('service_type', $supportedServiceTypes);
                        }
                    })
                    ->orWhereHas('bids', function ($bidQuery) use ($serviceProvider) {
                        $bidQuery
                            ->where('service_provider_id', $serviceProvider->id)
                            ->whereIn('status', [
                                'inspection_requested',
                                'working',
                                'inspection_interest',
                                'inspection_confirmed',
                                'awarded_pending_acceptance',
                                'approved',
                                'accepted',
                                'completed',
                                'rejected',
                            ]);
                    });
            });
        } elseif ($actor instanceof PropertyManagerProfile) {
            $query->where('property_id', $actor->property_id);
        } elseif ($actor instanceof User && $actor->role?->name === 'owner') {
            $query->whereHas('property.owners', fn ($ownerQuery) => $ownerQuery->where('users.id', $actor->id));
        }

        return OrderResource::collection($query->get());
    }

    public function show(Request $request, Order $order): OrderResource
    {
        $this->authorizeOrderAccess($request->user(), $order);

        $order->load([
            'property:id,li_number,title,postal_code,city,country',
            'propertyObject:id,name,address,postal_code,city,type,reference',
            'propertyManager:id,name,email',
            'bids.serviceProvider:id,company_name,contact_email',
            'approvedBid.serviceProvider:id,company_name,contact_email',
            'providerReviews.reviewerUser:id,name',
            'providerReviews.reviewerManagerProfile:id,name,email',
            'documents',
            'analysisResults',
        ])->loadCount('bids');

        return new OrderResource($order);
    }

    public function store(StoreOrderRequest $request, NotificationService $notificationService): OrderResource
    {
        $actor = $request->user();
        $isDraft = $request->input('status') === 'draft';
        $property = Property::query()->findOrFail($request->integer('property_id'));

        if ($actor instanceof PropertyManagerProfile) {
            abort_unless($this->canCreateOrders($actor), 403, 'You are not allowed to create orders with this login.');
            abort_unless($property->id === $actor->property_id, 403);
        } else {
            abort(403, 'Admins can only review orders.');
        }

        $propertyObjectId = $request->integer('property_object_id') ?: null;
        $propertyObjectIds = collect($request->input('property_object_ids', []))
            ->map(fn ($id) => (int) $id)
            ->filter()
            ->unique()
            ->values();

        if ($propertyObjectIds->isNotEmpty() && !$propertyObjectId) {
            $propertyObjectId = $propertyObjectIds->first();
        }

        if ($propertyObjectId) {
            $propertyObject = PropertyObject::query()->findOrFail($propertyObjectId);
            abort_unless($propertyObject->property_id === $property->id, 422, 'Selected property object does not belong to this property.');
        }

        if ($propertyObjectIds->isNotEmpty()) {
            $validObjectCount = PropertyObject::query()
                ->where('property_id', $property->id)
                ->whereIn('id', $propertyObjectIds)
                ->count();

            abort_unless($validObjectCount === $propertyObjectIds->count(), 422, 'One or more selected property objects do not belong to this property.');
        }

        $workflowStatus = $isDraft
            ? 'draft'
            : $this->determineWorkflowStatus(
                $request->input('workflow_type'),
                $request->input('workflow_meta', [])
            );
        $selectedProviderIds = collect(data_get($request->input('workflow_meta', []), 'provider_selection.selected_provider_ids', []))
            ->map(fn ($id) => (int) $id)
            ->filter()
            ->unique()
            ->values();
        $attachment = $request->file('attachment');
        $attachmentPath = $attachment?->store('vergo-order-attachments');

        $order = DB::transaction(function () use (
            $actor,
            $request,
            $property,
            $propertyObjectId,
            $propertyObjectIds,
            $workflowStatus,
            $selectedProviderIds,
            $attachment,
            $attachmentPath,
            $isDraft,
            $notificationService
        ) {
            $workflowMeta = $this->normalizeWorkflowMeta(
                $request->input('workflow_meta', []),
                $actor,
            );

            $order = Order::query()->create([
                'property_id' => $property->id,
                'property_manager_profile_id' => $actor instanceof PropertyManagerProfile ? $actor->id : null,
                'property_object_id' => $propertyObjectId,
                'property_object_ids' => $propertyObjectIds->values()->all(),
                'requester_name' => $actor instanceof PropertyManagerProfile
                    ? ($actor->name ?: 'Property Manager')
                    : ($request->input('requester_name') ?: $actor->name),
                'requester_email' => $actor instanceof PropertyManagerProfile
                    ? $actor->email
                    : ($request->input('requester_email') ?: $actor->email),
                'title' => $request->string('title')->toString(),
                'service_type' => $request->input('service_type'),
                'description' => $request->input('description'),
                'status' => $isDraft
                    ? 'draft'
                    : (in_array($workflowStatus, ['direct_award_pending_acceptance'], true) ? 'approved' : 'open'),
                'workflow_type' => $request->input('workflow_type'),
                'workflow_status' => $workflowStatus,
                'bid_priority' => $request->input('bid_priority'),
                'due_date' => $request->input('due_date'),
                'bid_deadline_at' => $request->input('bid_deadline_at'),
                'workflow_meta' => $workflowMeta,
                'quote_items' => $request->input('quote_items'),
                'attachment_name' => $attachment?->getClientOriginalName(),
                'attachment_path' => $attachmentPath,
                'attachment_mime_type' => $attachment?->getMimeType(),
                'attachment_size' => $attachment?->getSize(),
                'requested_at' => $request->input('requested_at', now()),
            ]);

            if (! $isDraft && $selectedProviderIds->isNotEmpty()) {
                $selectedProviders = ServiceProvider::query()
                    ->with('user')
                    ->whereIn('id', $selectedProviderIds)
                    ->get();

                if (in_array($workflowStatus, ['inspection_requested', 'direct_award_pending_acceptance'], true)) {
                    $this->createDirectProviderInvitations($order, $selectedProviders, $workflowStatus, $notificationService);
                    $notificationService->sendProviderOrderEmails($order, $selectedProviders, 'assigned');
                }
            }

            if ($isDraft) {
                return $order;
            }

            if ($workflowStatus === 'published_for_quotes') {
                $notificationService->sendQuoteRequestPublished($order);
            } elseif ($workflowStatus === 'public_inspection_open') {
                $notificationService->sendPublicInspectionPublished($order);
            }

            return $order;
        });

        if (! $isDraft) {
            $notificationService->sendOrderCreated($order->load('property.owners', 'property.managerProfiles'), $actor);
        }

        return new OrderResource($order->load([
            'property:id,li_number,title,postal_code,city,country',
            'propertyObject:id,name,address,postal_code,city,type,reference',
            'propertyManager:id,name,email',
        ]));
    }

    public function update(UpdateOrderRequest $request, Order $order, NotificationService $notificationService): OrderResource
    {
        $actor = $request->user();
        $isDraft = $request->input('status', $order->status) === 'draft';

        if ($actor instanceof PropertyManagerProfile) {
            abort_unless($this->canEditOrders($actor), 403, 'You are not allowed to edit orders with this login.');
            abort_unless(
                $order->property_id === $actor->property_id && $order->requester_email === $actor->email,
                403
            );

            if ($order->status !== 'draft' && ! $isDraft) {
                abort(422, 'Published orders cannot be edited. Please delete the order and create a new one.');
            }
        } else {
            abort(403, 'Admins can only review orders.');
        }

        $propertyId = $request->has('property_id') ? $request->integer('property_id') : $order->property_id;
        $propertyObjectId = $request->has('property_object_id')
            ? ($request->integer('property_object_id') ?: null)
            : $order->property_object_id;
        $propertyObjectIds = $request->has('property_object_ids')
            ? collect($request->input('property_object_ids', []))
                ->map(fn ($id) => (int) $id)
                ->filter()
                ->unique()
                ->values()
            : collect($order->property_object_ids ?? [])
                ->map(fn ($id) => (int) $id)
                ->filter()
                ->unique()
                ->values();

        if ($actor instanceof PropertyManagerProfile) {
            abort_unless($propertyId === $actor->property_id, 403);
        }

        if ($propertyObjectIds->isNotEmpty() && !$propertyObjectId) {
            $propertyObjectId = $propertyObjectIds->first();
        }

        if ($propertyObjectId) {
            $propertyObject = PropertyObject::query()->findOrFail($propertyObjectId);
            abort_unless($propertyObject->property_id === $propertyId, 422, 'Selected property object does not belong to this property.');
        }

        if ($propertyObjectIds->isNotEmpty()) {
            $validObjectCount = PropertyObject::query()
                ->where('property_id', $propertyId)
                ->whereIn('id', $propertyObjectIds)
                ->count();

            abort_unless($validObjectCount === $propertyObjectIds->count(), 422, 'One or more selected property objects do not belong to this property.');
        }

        $selectedProviderIds = collect(data_get($request->input('workflow_meta', $order->workflow_meta ?? []), 'provider_selection.selected_provider_ids', []))
            ->map(fn ($id) => (int) $id)
            ->filter()
            ->unique()
            ->values();

        $order->update([
            'property_id' => $propertyId,
            'property_object_id' => $propertyObjectId,
            'property_object_ids' => $propertyObjectIds->values()->all(),
            'requester_name' => $actor->name ?: 'Property Manager',
            'requester_email' => $actor->email,
            'title' => $request->input('title', $order->title),
            'service_type' => $request->input('service_type', $order->service_type),
            'description' => $request->input('description', $order->description),
            'status' => $isDraft
                ? 'draft'
                : (in_array($request->input('workflow_status', $this->determineWorkflowStatus(
                    $request->input('workflow_type', $order->workflow_type),
                    $request->input('workflow_meta', $order->workflow_meta ?? [])
                )), ['direct_award_pending_acceptance'], true) ? 'approved' : 'open'),
            'workflow_type' => $request->input('workflow_type', $order->workflow_type),
            'workflow_status' => $isDraft
                ? 'draft'
                : $request->input('workflow_status', $this->determineWorkflowStatus(
                    $request->input('workflow_type', $order->workflow_type),
                    $request->input('workflow_meta', $order->workflow_meta ?? [])
                )),
            'bid_priority' => $request->input('bid_priority', $order->bid_priority),
            'due_date' => $request->input('due_date', $order->due_date),
            'bid_deadline_at' => $request->input('bid_deadline_at', $order->bid_deadline_at),
            'workflow_meta' => $this->normalizeWorkflowMeta(
                $request->input('workflow_meta', $order->workflow_meta ?? []),
                $actor,
                $order->workflow_meta ?? []
            ),
            'quote_items' => $request->input('quote_items', $order->quote_items),
            'requested_at' => $request->input('requested_at', $order->requested_at),
        ]);

        if ($request->hasFile('attachment')) {
            if ($order->attachment_path) {
                Storage::delete($order->attachment_path);
            }

            $attachment = $request->file('attachment');
            $attachmentPath = $attachment?->store('vergo-order-attachments');

            $order->update([
                'attachment_name' => $attachment?->getClientOriginalName(),
                'attachment_path' => $attachmentPath,
                'attachment_mime_type' => $attachment?->getMimeType(),
                'attachment_size' => $attachment?->getSize(),
            ]);
        }

        if (! $isDraft && $order->wasChanged('status') && $order->status === 'open') {
            if ($selectedProviderIds->isNotEmpty()) {
                $selectedProviders = ServiceProvider::query()
                    ->with('user')
                    ->whereIn('id', $selectedProviderIds)
                    ->get();

                if ($order->workflow_status === 'inspection_requested') {
                    $this->createDirectProviderInvitations($order, $selectedProviders, $order->workflow_status, $notificationService);
                    $notificationService->sendProviderOrderEmails($order, $selectedProviders, 'assigned');
                }
            }

            if ($order->workflow_status === 'published_for_quotes') {
                $notificationService->sendQuoteRequestPublished($order);
            } elseif ($order->workflow_status === 'public_inspection_open') {
                $notificationService->sendPublicInspectionPublished($order);
            }

            $notificationService->sendOrderCreated($order->load('property.owners', 'property.managerProfiles'), $actor);
        }

        return new OrderResource($order->load([
            'property:id,li_number,title,postal_code,city,country',
            'propertyObject:id,name,address,postal_code,city,type,reference',
            'propertyManager:id,name,email',
        ]));
    }

    public function destroy(Request $request, Order $order)
    {
        $actor = $request->user();

        if ($actor instanceof PropertyManagerProfile) {
            abort_unless($this->canDeleteOrders($actor), 403, 'You are not allowed to delete orders with this login.');
            abort_unless(
                $order->property_id === $actor->property_id && $order->requester_email === $actor->email,
                403
            );
        } else {
            abort(403, 'Only property managers can delete orders.');
        }

        if ($order->attachment_path) {
            Storage::delete($order->attachment_path);
        }

        $order->delete();

        return response()->json([
            'message' => 'Order deleted successfully.',
        ]);
    }

    public function markCompleted(Request $request, Order $order): OrderResource
    {
        $actor = $request->user();

        if ($actor instanceof User && $actor->role?->name === 'owner') {
            abort_unless(
                $order->property()->whereHas('owners', fn ($ownerQuery) => $ownerQuery->where('users.id', $actor->id))->exists(),
                403
            );
        } elseif ($actor instanceof PropertyManagerProfile) {
            abort_unless($order->property_id === $actor->property_id, 403);
        } else {
            abort(403, 'Only owners or property managers can complete orders.');
        }

        abort_unless($order->status === 'approved', 422, 'Only approved orders can be marked as completed.');
        abort_unless($order->approvedBid()->exists(), 422, 'An approved provider is required before completing an order.');

        $order->update([
            'status' => 'completed',
            'completed_at' => now(),
        ]);

        return new OrderResource($order->fresh()->load([
            'property:id,li_number,title,postal_code,city,country',
            'propertyObject:id,name,address,postal_code,city,type,reference',
            'propertyManager:id,name,email',
            'bids.serviceProvider:id,company_name,contact_email',
            'approvedBid.serviceProvider:id,company_name,contact_email',
            'providerReviews.reviewerUser:id,name',
            'providerReviews.reviewerManagerProfile:id,name,email',
            'documents',
            'analysisResults',
        ])->loadCount('bids'));
    }

    public function downloadAttachment(Request $request, Order $order)
    {
        $this->authorizeOrderAccess($request->user(), $order);

        abort_unless($order->attachment_path, 404, 'No order attachment found.');

        return Storage::download($order->attachment_path, $order->attachment_name ?: 'order-attachment');
    }

    private function authorizeOrderAccess(mixed $actor, Order $order): void
    {
        if ($actor instanceof User && $actor->role?->name === 'admin') {
            return;
        }

        if ($actor instanceof User && $actor->role?->name === 'owner') {
            abort_unless(
                $order->property()->whereHas('owners', fn ($ownerQuery) => $ownerQuery->where('users.id', $actor->id))->exists(),
                403
            );

            return;
        }

        if ($actor instanceof PropertyManagerProfile) {
            abort_unless($order->property_id === $actor->property_id, 403);
            return;
        }

        if ($actor instanceof User && $actor->role?->name === 'provider') {
            $serviceProvider = $actor->serviceProvider;
            abort_unless($serviceProvider, 403);

            $hasLinkedBid = $order->bids()
                ->where('service_provider_id', $serviceProvider->id)
                ->exists();
            $isVisiblePublicOrder = in_array($order->workflow_status, ['public_inspection_open', 'inspection_signup_closed', 'published_for_quotes'], true)
                && $serviceProvider->supportsServiceType($order->service_type);

            abort_unless($hasLinkedBid || $isVisiblePublicOrder, 403);
            return;
        }

        abort(403);
    }

    private function canCreateOrders(PropertyManagerProfile $manager): bool
    {
        $abilities = $manager->currentAccessToken()?->abilities ?? [];

        return in_array('orders:create', $abilities, true);
    }

    private function canEditOrders(PropertyManagerProfile $manager): bool
    {
        return true;
    }

    private function canDeleteOrders(PropertyManagerProfile $manager): bool
    {
        return $this->canEditOrders($manager);
    }

    private function determineWorkflowStatus(?string $workflowType, array $workflowMeta = []): string
    {
        if ($workflowType === 'inspection') {
            return data_get($workflowMeta, 'inspection.request_mode') === 'direct'
                ? 'inspection_requested'
                : 'public_inspection_open';
        }

        if ($workflowType === 'direct_order') {
            return data_get($workflowMeta, 'assignment.award_mode') === 'direct_award'
                ? 'direct_award_pending_acceptance'
                : 'published_for_quotes';
        }

        return 'created';
    }

    private function normalizeWorkflowMeta(array $workflowMeta, PropertyManagerProfile $actor, array $existingWorkflowMeta = []): array
    {
        $existingAssignment = data_get($existingWorkflowMeta, 'assignment');
        $assignment = data_get($workflowMeta, 'assignment');

        if (! is_array($existingAssignment)) {
            $existingAssignment = [];
        }

        if (! is_array($assignment)) {
            $assignment = [];
        }

        $existingInvoiceRecipient = data_get($existingAssignment, 'invoice_recipient');
        $invoiceRecipient = data_get($assignment, 'invoice_recipient');

        if (! is_array($existingInvoiceRecipient)) {
            $existingInvoiceRecipient = [];
        }

        if (! is_array($invoiceRecipient)) {
            $invoiceRecipient = [];
        }

        if (data_get($invoiceRecipient, 'recipient_type') === 'manager_profile') {
            $invoiceRecipient = [
                'recipient_type' => 'manager_profile',
                'recipient_label' => $actor->name ?: 'Property Manager',
                'delivery_method' => $actor->invoice_delivery_method ?: 'email',
                'email' => $actor->invoice_email,
                'company_name' => $actor->invoice_company_name,
                'company_extra' => $actor->invoice_company_extra,
                'first_name' => null,
                'last_name' => null,
                'address' => $actor->invoice_address,
                'postal_code' => $actor->invoice_postal_code,
                'city' => $actor->invoice_city,
            ];
        } elseif (data_get($invoiceRecipient, 'recipient_type') === 'third_party') {
            $deliveryMethod = data_get($invoiceRecipient, 'delivery_method');

            $invoiceRecipient = [
                'recipient_type' => 'third_party',
                'recipient_label' => 'Third Party',
                'delivery_method' => $deliveryMethod,
                'email' => $deliveryMethod === 'email' ? data_get($invoiceRecipient, 'email') : null,
                'company_name' => data_get($invoiceRecipient, 'company_name'),
                'company_extra' => data_get($invoiceRecipient, 'company_extra'),
                'first_name' => data_get($invoiceRecipient, 'first_name'),
                'last_name' => data_get($invoiceRecipient, 'last_name'),
                'address' => data_get($invoiceRecipient, 'address'),
                'postal_code' => data_get($invoiceRecipient, 'postal_code'),
                'city' => data_get($invoiceRecipient, 'city'),
            ];
        } else {
            $invoiceRecipient = $existingInvoiceRecipient;
        }

        return [
            ...$existingWorkflowMeta,
            ...$workflowMeta,
            'assignment' => [
                ...$existingAssignment,
                ...$assignment,
                'invoice_recipient' => $invoiceRecipient,
            ],
        ];
    }

    private function createDirectProviderInvitations(
        Order $order,
        $providers,
        string $workflowStatus,
        NotificationService $notificationService
    ): void {
        foreach ($providers as $provider) {
            Bid::query()->firstOrCreate(
                [
                    'order_id' => $order->id,
                    'service_provider_id' => $provider->id,
                ],
                [
                    'amount' => null,
                    'currency' => 'CHF',
                    'status' => $workflowStatus === 'inspection_requested' ? 'inspection_requested' : 'awarded_pending_acceptance',
                    'workflow_meta' => [
                        'source' => 'manager_direct_selection',
                    ],
                    'submitted_at' => now(),
                ]
            );
        }

        if ($workflowStatus === 'inspection_requested') {
            $notificationService->sendInspectionRequestAssigned($order, $providers);
            return;
        }

        if ($workflowStatus === 'direct_award_pending_acceptance') {
            $notificationService->sendDirectAwardAssigned($order, $providers);
        }
    }
}
