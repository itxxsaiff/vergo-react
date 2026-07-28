<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreBidRequest;
use App\Http\Requests\UpdateBidRequest;
use App\Http\Resources\BidResource;
use App\Models\AiAnalysisResult;
use App\Models\Bid;
use App\Models\Order;
use App\Models\PropertyManagerProfile;
use App\Models\User;
use App\Services\BidComparisonService;
use App\Services\NotificationService;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class BidController extends Controller
{
    private const VAT_RATE = 0.081;

    public function index(Request $request): AnonymousResourceCollection
    {
        $actor = $request->user();

        $query = Bid::query()
            ->with([
                'order.property:id,li_number,title,postal_code,city',
                'order.propertyObject:id,name,address,postal_code,city,type,reference',
                'serviceProvider:id,company_name,contact_name,contact_email',
            ])
            ->latest();

        if ($actor instanceof User && $actor->role?->name === 'provider') {
            $serviceProvider = $actor->serviceProvider;
            abort_unless($serviceProvider, 403);
            $query->where('service_provider_id', $serviceProvider->id);
        } elseif ($actor instanceof User && $actor->role?->name === 'owner') {
            $query->whereHas('order.property.owners', fn ($ownerQuery) => $ownerQuery->where('users.id', $actor->id));
        } elseif ($actor instanceof PropertyManagerProfile) {
            $propertyIds = $actor->accessiblePropertyIds();
            $query->whereHas('order', fn ($orderQuery) => $orderQuery->whereIn('property_id', $propertyIds ?: [0]));
        } else {
            abort_unless($actor instanceof User && $actor->role?->name === 'admin', 403);
        }

        return BidResource::collection($query->get());
    }

    public function store(StoreBidRequest $request, NotificationService $notificationService): BidResource|JsonResponse
    {
        $actor = $request->user();
        abort_unless($actor instanceof User && $actor->role?->name === 'provider', 403);

        $serviceProvider = $actor->serviceProvider;
        abort_unless($serviceProvider, 403);

        $order = Order::query()->findOrFail($request->integer('order_id'));
        $existingBid = Bid::query()
            ->where('order_id', $order->id)
            ->where('service_provider_id', $serviceProvider->id)
            ->first();
        $isConfirmedInspectionBid = $existingBid
            && $order->workflow_type === 'inspection'
            && $existingBid->status === 'inspection_confirmed';

        abort_unless(
            in_array($order->workflow_status, ['public_inspection_open', 'inspection_signup_closed', 'published_for_quotes'], true)
            || $isConfirmedInspectionBid,
            422,
            'This workflow is not open for provider submissions.'
        );
        $providerLoginEmail = $this->providerLoginEmail($request);

        abort_unless(
            ! $existingBid?->assigned_provider_email || strtolower($existingBid->assigned_provider_email) === $providerLoginEmail,
            403,
            'This order is already assigned to another employee from your company.'
        );

        $attachment = $request->file('attachment');
        $attachmentPath = $attachment?->store('vergo-bid-attachments');
        $lineItems = collect($request->input('line_items', []))->values()->all();
        $currency = 'CHF';
        $workflowMeta = $request->input('workflow_meta', []);

        $isQuoteSubmission = $order->workflow_status === 'published_for_quotes'
            || ($order->workflow_status === 'inspection_signup_closed' && $existingBid)
            || $isConfirmedInspectionBid;
        $isInspectionSignup = $order->workflow_status === 'public_inspection_open';
        $isInspectionQuoteSeed = $isQuoteSubmission && $isConfirmedInspectionBid;

        if ($isQuoteSubmission && ! $isConfirmedInspectionBid) {
            abort_unless(
                ! $order->bid_deadline_at || now()->lte($order->bid_deadline_at),
                422,
                'The bid deadline has already passed.'
            );
        }

        if ($order->workflow_status === 'inspection_signup_closed' && ! $existingBid) {
            abort(422, 'This inspection request has already reached the signup limit.');
        }

        if ($existingBid && ! $isQuoteSubmission && $existingBid->status !== 'working') {
            abort(422, 'You have already registered for this order.');
        }

        if ($existingBid && $isQuoteSubmission) {
            abort_unless(
                in_array($existingBid->status, ['working', 'inspection_interest', 'inspection_confirmed'], true),
                422,
                'You have already submitted a bid for this order.'
            );
        }

        if ($isInspectionQuoteSeed) {
            $workflowMeta = [
                ...$workflowMeta,
                'quote_scope_seed' => true,
                'quote_scope_seeded_at' => now()->toDateTimeString(),
            ];
        }

        if ($isInspectionSignup) {
            $this->validateSelectedInspectionSlot($order, $workflowMeta);
        }

        $pricing = $this->resolveBidPricing($lineItems, $request->input('amount'), $workflowMeta, $serviceProvider);
        $amount = $pricing['amount'];

        if (! empty($lineItems) && $pricing['breakdown']) {
            $workflowMeta = [
                ...$workflowMeta,
                'pricing' => $pricing['breakdown'],
            ];
        }

        $status = $isQuoteSubmission ? 'submitted' : ($isInspectionSignup ? 'inspection_confirmed' : 'inspection_interest');

        if ($isQuoteSubmission) {
            abort_unless($amount !== null && $amount > 0, 422, 'Please enter a valid bid amount.');

            $benchmarkWarning = $this->getBenchmarkWarning($order, $amount);
            $warningAlreadyAccepted = (bool) data_get($workflowMeta, 'benchmark_warning_acknowledged');

            if ($benchmarkWarning && ! $warningAlreadyAccepted) {
                return response()->json([
                    'message' => 'Your price is below the benchmark for this service.',
                    'requires_confirmation' => true,
                    'benchmark' => $benchmarkWarning,
                ], 422);
            }
        }

        $bidPayload = [
            'order_id' => $order->id,
            'service_provider_id' => $serviceProvider->id,
            'assigned_provider_email' => $existingBid?->assigned_provider_email ?: $providerLoginEmail,
            'amount' => $amount,
            'currency' => $currency,
            'line_items' => $lineItems,
            'estimated_start_date' => $request->input('estimated_start_date'),
            'estimated_completion_date' => $request->input('estimated_completion_date'),
            'notes' => $request->input('notes'),
            'workflow_meta' => $workflowMeta,
            'attachment_name' => $attachment?->getClientOriginalName(),
            'attachment_path' => $attachmentPath,
            'attachment_mime_type' => $attachment?->getMimeType(),
            'attachment_size' => $attachment?->getSize(),
            'status' => $status,
            'submitted_at' => now(),
        ];

        $bid = $existingBid && ($isQuoteSubmission || $isInspectionSignup)
            ? tap($existingBid)->update($bidPayload)
            : Bid::query()->create($bidPayload);

        if ($isQuoteSubmission) {
            $this->publishQuoteItemsFromBid($order, $lineItems, $bid);

            if ($isInspectionQuoteSeed) {
                $notificationService->sendInspectionQuoteCreated(
                    $bid->fresh()->load(['order.property.managerProfiles', 'serviceProvider']),
                    $actor
                );
            } else {
                $notificationService->sendBidSubmitted(
                    $order->load('property.owners', 'property.managerProfiles'),
                    $serviceProvider->company_name ?: $serviceProvider->contact_name ?: 'A provider',
                    $actor
                );
            }

            $this->syncOrderStatus($order->fresh());
        } elseif ($isInspectionSignup) {
            $count = Bid::query()
                ->where('order_id', $order->id)
                ->whereIn('status', ['inspection_interest', 'inspection_confirmed'])
                ->count();
            $signupLimit = $this->inspectionSignupLimit($order);

            if ($count >= $signupLimit) {
                $order->update(['workflow_status' => 'inspection_signup_closed']);
            }

            $notificationService->sendInspectionAppointmentConfirmed(
                $bid->fresh()->load(['order.property', 'order.propertyObject', 'serviceProvider'])
            );
            $notificationService->sendProviderResponse(
                $bid->fresh()->load(['order.property.owners', 'order.property.managerProfiles', 'serviceProvider']),
                'inspection_confirmed'
            );
            $this->syncOrderStatus($order->fresh());
        }

        return new BidResource($bid->load([
            'order.property:id,li_number,title,postal_code,city',
            'order.propertyObject:id,name,address,postal_code,city,type,reference',
            'serviceProvider:id,company_name,contact_name,contact_email',
        ]));
    }

    public function assignToProvider(Request $request, Order $order, NotificationService $notificationService): BidResource
    {
        $actor = $request->user();
        abort_unless($actor instanceof User && $actor->role?->name === 'provider', 403);

        $serviceProvider = $actor->serviceProvider;
        abort_unless($serviceProvider, 403);
        $validated = $request->validate([
            'assigned_provider_email' => ['nullable', 'email', 'max:255'],
        ]);
        $providerLoginEmail = $this->providerLoginEmail($request);
        $assignedEmail = strtolower($validated['assigned_provider_email'] ?? $providerLoginEmail);

        if (! empty($validated['assigned_provider_email'])) {
            $assignedDomain = strtolower((string) str($assignedEmail)->after('@'));
            $allowedDomain = strtolower((string) $serviceProvider->domain_suffix);

            abort_unless(
                $allowedDomain && $assignedDomain === $allowedDomain,
                422,
                'This email domain does not match your company domain.'
            );
        }

        $isVisiblePublicOrder = in_array($order->workflow_status, ['public_inspection_open', 'inspection_signup_closed', 'published_for_quotes'], true)
            && $serviceProvider->supportsServiceType($order->service_type);

        $bid = Bid::query()
            ->where('order_id', $order->id)
            ->where('service_provider_id', $serviceProvider->id)
            ->first();

        abort_unless($bid || $isVisiblePublicOrder, 403, 'This order is not available for your company.');

        if (! $bid) {
            if (in_array($order->workflow_status, ['public_inspection_open', 'inspection_signup_closed'], true)) {
                $confirmedOrInterestedCount = Bid::query()
                    ->where('order_id', $order->id)
                    ->whereIn('status', ['inspection_interest', 'inspection_confirmed'])
                    ->count();

                abort_unless(
                    $order->workflow_status === 'public_inspection_open'
                    && $confirmedOrInterestedCount < $this->inspectionSignupLimit($order),
                    422,
                    'This inspection request has already reached the signup limit.'
                );
            }

            $bid = Bid::query()->create([
                'order_id' => $order->id,
                'service_provider_id' => $serviceProvider->id,
                'amount' => null,
                'currency' => 'CHF',
                'status' => 'working',
                'workflow_meta' => [
                    'source' => 'provider_self_assignment',
                ],
                'submitted_at' => now(),
            ]);
        }

        $bid->update([
            'assigned_provider_email' => $assignedEmail,
            'workflow_meta' => [
                ...($bid->workflow_meta ?? []),
                'assigned_at' => now()->toDateTimeString(),
                'assigned_provider_email' => $assignedEmail,
                'assigned_by_email' => $providerLoginEmail,
            ],
        ]);

        if ($assignedEmail !== $providerLoginEmail) {
            $notificationService->sendProviderPersonalAssignmentEmail(
                $order->load('property'),
                $serviceProvider,
                $assignedEmail
            );
        }

        return new BidResource($bid->fresh()->load([
            'order.property:id,li_number,title,postal_code,city',
            'order.propertyObject:id,name,address,postal_code,city,type,reference',
            'serviceProvider:id,company_name,contact_name,contact_email',
        ]));
    }

    public function saveDraft(Request $request, Bid $bid): BidResource
    {
        $actor = $request->user();
        abort_unless($actor instanceof User && $actor->role?->name === 'provider', 403);

        $serviceProvider = $actor->serviceProvider;
        abort_unless($serviceProvider && $bid->service_provider_id === $serviceProvider->id, 403);

        $validated = $request->validate([
            'draft_payload' => ['required', 'array'],
        ]);

        $bid->update([
            'assigned_provider_email' => $bid->assigned_provider_email ?: $this->providerLoginEmail($request),
            'draft_payload' => $validated['draft_payload'],
            'draft_saved_at' => now(),
            'workflow_meta' => [
                ...($bid->workflow_meta ?? []),
                'assigned_provider_email' => $bid->assigned_provider_email ?: $this->providerLoginEmail($request),
            ],
        ]);

        return new BidResource($bid->fresh()->load([
            'order.property:id,li_number,title,postal_code,city',
            'order.propertyObject:id,name,address,postal_code,city,type,reference',
            'serviceProvider:id,company_name,contact_name,contact_email',
        ]));
    }

    public function update(UpdateBidRequest $request, Bid $bid, NotificationService $notificationService, BidComparisonService $comparisonService): BidResource
    {
        $actor = $request->user();

        if ($actor instanceof User && $actor->role?->name === 'provider') {
            $serviceProvider = $actor->serviceProvider;
            abort_unless($serviceProvider && $bid->service_provider_id === $serviceProvider->id, 403);

            $status = $request->input('status', $bid->status);
            abort_unless(
                in_array($status, ['inspection_confirmed', 'accepted', 'completed', 'rejected'], true),
                422,
                'Providers can only confirm inspections, accept or decline assignments, or complete work.'
            );

            if ($status === 'inspection_confirmed') {
                abort_unless(in_array($bid->status, ['inspection_requested', 'inspection_interest'], true), 422);
                $order = $bid->order()->firstOrFail();
                $this->validateSelectedInspectionSlot($order, $request->input('workflow_meta', []));
            }

            if ($status === 'accepted') {
                abort_unless(in_array($bid->status, ['awarded_pending_acceptance', 'approved'], true), 422);
            }

            if ($status === 'completed') {
                abort_unless(in_array($bid->status, ['accepted', 'approved'], true), 422);
            }

            if ($status === 'rejected') {
                abort_unless(in_array($bid->status, ['inspection_requested', 'awarded_pending_acceptance'], true), 422);
            }

            $nextWorkflowMeta = [
                ...($bid->workflow_meta ?? []),
                ...($request->input('workflow_meta', [])),
                'assigned_provider_email' => $bid->assigned_provider_email ?: $this->providerLoginEmail($request),
                'provider_last_action_at' => now()->toDateTimeString(),
            ];

            $bid->update([
                'status' => $status,
                'assigned_provider_email' => $bid->assigned_provider_email ?: $this->providerLoginEmail($request),
                'workflow_meta' => $nextWorkflowMeta,
            ]);

            if ($status === 'inspection_confirmed') {
                $notificationService->sendInspectionAppointmentConfirmed(
                    $bid->fresh()->load(['order.property', 'order.propertyObject', 'serviceProvider'])
                );
            }

            if (in_array($status, ['inspection_confirmed', 'accepted', 'rejected'], true)) {
                $notificationService->sendProviderResponse(
                    $bid->fresh()->load(['order.property.owners', 'order.property.managerProfiles', 'serviceProvider']),
                    $status
                );
            }
        } elseif ($actor instanceof PropertyManagerProfile) {
            $propertyIds = $actor->accessiblePropertyIds();
            abort_unless($bid->order()->whereIn('property_id', $propertyIds ?: [0])->exists(), 403);

            $status = $request->input('status', $bid->status);
            $order = $bid->order()->firstOrFail();

            if ($order->workflow_status === 'published_for_quotes') {
                abort_unless(! $order->bid_deadline_at || now()->gt($order->bid_deadline_at), 422, 'Bids remain hidden until the submission deadline passes.');
                abort_unless(in_array($status, ['approved', 'rejected'], true), 422, 'Managers can only award or reject ranked bids.');

                $orderedBids = $this->orderedBidsForQuoteReview($order, $comparisonService);

                $currentReviewIndex = $orderedBids->search(fn ($item) => !in_array($item->status, ['rejected', 'approved', 'accepted', 'completed'], true));
                $currentBid = $currentReviewIndex !== false ? $orderedBids->get($currentReviewIndex) : null;

                abort_unless($currentBid && $currentBid->id === $bid->id, 422, 'You must review bids in the AI-ranked option order and reject the current top candidate before opening the next one.');

                if ($status === 'rejected') {
                    abort_unless($request->filled('rejection_reason'), 422, 'A rejection reason is required before the next bid can be opened.');
                }

                $bid->update([
                    'status' => $status,
                    'rejection_reason' => $status === 'rejected' ? $request->input('rejection_reason') : null,
                ]);

                if ($status === 'approved') {
                    $order->bids()
                        ->where('id', '!=', $bid->id)
                        ->where('status', '!=', 'rejected')
                        ->update(['status' => 'rejected']);

                    $order->update([
                        'status' => 'approved',
                        'workflow_status' => 'awarded',
                    ]);
                }
            } else {
                abort_unless(in_array($status, ['shortlisted', 'approved', 'rejected'], true), 422, 'Invalid manager bid action.');

                if ($status === 'shortlisted') {
                    abort_unless($bid->status === 'submitted', 422, 'Only newly submitted bids can be shortlisted.');
                }

                if ($status === 'approved') {
                    abort_unless(in_array($bid->status, ['inspection_confirmed', 'inspection_interest', 'inspection_requested', 'shortlisted'], true), 422);
                }

                if ($status === 'rejected') {
                    abort_unless($request->filled('rejection_reason'), 422, 'A rejection reason is required.');
                }

                $bid->update([
                    'status' => $status,
                    'rejection_reason' => $status === 'rejected' ? $request->input('rejection_reason') : null,
                ]);

                if ($status === 'approved') {
                    $order->update([
                        'status' => 'approved',
                        'workflow_status' => $order->workflow_status === 'inspection_requested' || str_starts_with((string) $order->workflow_status, 'public_inspection')
                            ? 'inspection_company_selected'
                            : 'awarded',
                    ]);
                }
            }
        } elseif ($actor instanceof User && $actor->role?->name === 'owner') {
            abort_unless(
                $bid->order()->whereHas('property.owners', fn ($ownerQuery) => $ownerQuery->where('users.id', $actor->id))->exists(),
                403
            );

            $status = $request->input('status', $bid->status);
            abort_unless(in_array($status, ['approved', 'rejected'], true), 422, 'Owners can only approve or reject shortlisted bids.');
            abort_unless($bid->status === 'shortlisted', 422, 'Only shortlisted bids can be approved or rejected by owners.');

            $bid->update([
                'status' => $status,
                'rejection_reason' => $status === 'rejected' ? $request->input('rejection_reason', $bid->rejection_reason) : null,
            ]);
        } else {
            abort(403, 'Admins can only review bids.');
        }

        $this->syncOrderStatus($bid->order()->firstOrFail());

        return new BidResource($bid->fresh()->load([
            'order.property:id,li_number,title,postal_code,city',
            'order.propertyObject:id,name,address,postal_code,city,type,reference',
            'serviceProvider:id,company_name,contact_name,contact_email',
        ]));
    }

    public function destroy(Request $request, Bid $bid): JsonResponse
    {
        $actor = $request->user();

        abort(403, 'Submitted bids cannot be deleted.');

        if ($bid->attachment_path) {
            Storage::delete($bid->attachment_path);
        }

        $bid->delete();

        $this->syncOrderStatus($bid->order()->firstOrFail());

        return response()->json([
            'message' => 'Bid deleted successfully.',
        ]);
    }

    public function downloadAttachment(Request $request, Bid $bid)
    {
        $actor = $request->user();

        if ($actor instanceof User && $actor->role?->name === 'provider') {
            $serviceProvider = $actor->serviceProvider;
            abort_unless($serviceProvider && $bid->service_provider_id === $serviceProvider->id, 403);
        } elseif ($actor instanceof User && $actor->role?->name === 'owner') {
            abort_unless(
                $bid->order()->whereHas('property.owners', fn ($ownerQuery) => $ownerQuery->where('users.id', $actor->id))->exists(),
                403
            );
        } elseif ($actor instanceof PropertyManagerProfile) {
            $propertyIds = $actor->accessiblePropertyIds();
            abort_unless($bid->order()->whereIn('property_id', $propertyIds ?: [0])->exists(), 403);
        } else {
            abort_unless($actor instanceof User && $actor->role?->name === 'admin', 403);
        }

        abort_unless($bid->attachment_path, 404, 'No bid attachment found.');

        return Storage::download($bid->attachment_path, $bid->attachment_name ?: 'bid-attachment');
    }

    private function syncOrderStatus(Order $order): void
    {
        DB::transaction(function () use ($order): void {
            $order->refresh();

            $approvedBidExists = $order->bids()->whereIn('status', ['approved', 'accepted', 'completed', 'awarded_pending_acceptance'])->exists();
            $hasBids = $order->bids()->exists();
            $shortlistedBidExists = $order->bids()->where('status', 'shortlisted')->exists();
            $completedBidExists = $order->bids()->where('status', 'completed')->exists();
            $acceptedBidExists = $order->bids()->where('status', 'accepted')->exists();
            $inspectionConfirmedExists = $order->workflow_type === 'inspection'
                && $order->bids()->where('status', 'inspection_confirmed')->exists();
            $inspectionBidCount = $order->workflow_type === 'inspection'
                ? $order->bids()->whereIn('status', ['inspection_requested', 'inspection_interest', 'inspection_confirmed', 'rejected'])->count()
                : 0;
            $inspectionRejectedCount = $order->workflow_type === 'inspection'
                ? $order->bids()->where('status', 'rejected')->count()
                : 0;

            if ($completedBidExists) {
                $order->update([
                    'status' => 'completed',
                    'completed_at' => $order->completed_at ?? now(),
                    'workflow_status' => 'completed',
                ]);
                return;
            }

            if ($approvedBidExists) {
                $approvedBidId = $order->bids()
                    ->whereIn('status', ['approved', 'accepted', 'completed', 'awarded_pending_acceptance'])
                    ->latest('updated_at')
                    ->value('id');

                $order->bids()
                    ->where('id', '!=', $approvedBidId)
                    ->where('status', '!=', 'rejected')
                    ->update(['status' => 'rejected']);

                $order->update([
                    'status' => 'approved',
                    'workflow_status' => $acceptedBidExists
                        ? 'provider_accepted'
                        : ($order->workflow_status === 'direct_award_pending_acceptance'
                            ? 'direct_award_pending_acceptance'
                            : 'awarded'),
                ]);
                return;
            }

            if ($inspectionConfirmedExists) {
                $order->update([
                    'status' => 'inspection_confirmed',
                ]);
                return;
            }

            if ($inspectionBidCount > 0 && $inspectionBidCount === $inspectionRejectedCount) {
                $order->update([
                    'status' => 'inspection_rejected',
                ]);
                return;
            }

            $order->update([
                'status' => $shortlistedBidExists ? 'awaiting_owner_approval' : ($hasBids ? 'in_review' : 'open'),
            ]);
        });
    }

    private function validateSelectedInspectionSlot(Order $order, array $workflowMeta): void
    {
        $slots = data_get($order->workflow_meta ?? [], 'inspection.preferred_slots', []);
        $selectedSlotIndex = data_get($workflowMeta, 'selected_slot_index');

        abort_unless($selectedSlotIndex !== null && $selectedSlotIndex !== '', 422, 'Please select an inspection appointment.');
        abort_unless(Arr::exists($slots, (int) $selectedSlotIndex), 422, 'Please select a valid inspection appointment.');
    }

    private function inspectionSignupLimit(Order $order): int
    {
        $limit = (int) data_get($order->workflow_meta ?? [], 'inspection.public_provider_limit', 3);

        return max(1, $limit);
    }

    private function resolveBidPricing(array $lineItems, mixed $fallbackAmount, array $workflowMeta, mixed $serviceProvider): array
    {
        if (! empty($lineItems)) {
            $enteredTotal = (float) collect($lineItems)->sum(function ($item) {
                return ((float) data_get($item, 'quantity', 0)) * ((float) data_get($item, 'unit_price', 0));
            });

            $isVatSubject = (bool) data_get($serviceProvider, 'is_vat_subject');
            $vatIncluded = (bool) data_get($workflowMeta, 'vat_included');

            if (! $isVatSubject) {
                $subtotal = round($enteredTotal, 2);
                $vatAmount = 0.0;
                $total = $subtotal;
            } elseif ($vatIncluded) {
                $total = round($enteredTotal, 2);
                $subtotal = round($total / (1 + self::VAT_RATE), 2);
                $vatAmount = round($total - $subtotal, 2);
            } else {
                $subtotal = round($enteredTotal, 2);
                $vatAmount = round($subtotal * self::VAT_RATE, 2);
                $total = round($subtotal + $vatAmount, 2);
            }

            return [
                'amount' => $total,
                'breakdown' => [
                    'entered_total' => round($enteredTotal, 2),
                    'subtotal' => $subtotal,
                    'vat_rate' => $isVatSubject ? self::VAT_RATE : 0,
                    'vat_amount' => $vatAmount,
                    'total' => $total,
                    'vat_included' => $isVatSubject && $vatIncluded,
                    'vat_subject' => $isVatSubject,
                ],
            ];
        }

        return [
            'amount' => $fallbackAmount !== null ? (float) $fallbackAmount : null,
            'breakdown' => null,
        ];
    }

    private function providerLoginEmail(Request $request): string
    {
        $tokenName = (string) $request->user()?->currentAccessToken()?->name;

        if (str_starts_with($tokenName, 'vergo-provider:')) {
            return strtolower(substr($tokenName, strlen('vergo-provider:')));
        }

        return strtolower((string) $request->user()?->email);
    }

    private function publishQuoteItemsFromBid(Order $order, array $lineItems, ?Bid $bid = null): void
    {
        if (! empty($order->quote_items)) {
            return;
        }

        $quoteItems = collect($lineItems)
            ->filter(fn ($item) => filled(data_get($item, 'label')) && (float) data_get($item, 'quantity', 0) > 0)
            ->map(fn ($item) => [
                'category' => data_get($item, 'category') ?: data_get($item, 'code') ?: data_get($item, 'label'),
                'label' => data_get($item, 'label'),
                'code' => data_get($item, 'code'),
                'unit' => data_get($item, 'unit'),
                'quantity' => (float) data_get($item, 'quantity', 0),
                'is_custom' => (bool) data_get($item, 'is_custom', true),
            ])
            ->values()
            ->all();

        if (! empty($quoteItems)) {
            $selectedSlotIndex = data_get($bid?->workflow_meta ?? [], 'selected_slot_index');
            $selectedSlot = data_get($order->workflow_meta ?? [], "inspection.preferred_slots.{$selectedSlotIndex}", []);
            $quoteDueDate = data_get($selectedSlot, 'quote_due_date');

            $workflowMeta = $order->workflow_meta ?? [];
            data_set($workflowMeta, 'assignment.award_mode', 'request_quotes');
            data_set($workflowMeta, 'assignment.quote_item_source', 'provider');
            data_set($workflowMeta, 'inspection.quote_created_at', now()->toDateTimeString());

            if ($bid) {
                data_set($workflowMeta, 'inspection.quote_seed_bid_id', $bid->id);
            }

            if ($quoteDueDate) {
                data_set($workflowMeta, 'inspection.accepted_quote_due_date', $quoteDueDate);
            }

            $updates = [
                'quote_items' => $quoteItems,
                'workflow_status' => 'inspection_quote_created',
                'workflow_meta' => $workflowMeta,
            ];

            $order->update($updates);
        }
    }

    private function orderedBidsForQuoteReview(Order $order, BidComparisonService $comparisonService): Collection
    {
        $reviewableBids = $order->bids()
            ->with('serviceProvider')
            ->whereNotNull('amount')
            ->where('amount', '>', 0)
            ->get()
            ->reject(fn ($item) => $this->isHiddenScopeSeedBid($item))
            ->values();

        if ($reviewableBids->isEmpty()) {
            return $reviewableBids;
        }

        $rankedBidIds = $this->latestBidComparisonRanking($order);

        if ($rankedBidIds->isEmpty()) {
            $order->loadMissing([
                'property.owners',
                'property.documents.analysisResults',
                'documents.analysisResults',
                'bids.serviceProvider',
            ]);

            $comparison = $comparisonService->build($order);

            AiAnalysisResult::query()->create([
                'order_id' => $order->id,
                'property_id' => $order->property_id,
                'status' => 'completed',
                'score' => $comparison['score'],
                'summary' => $comparison['summary'],
                'comparison_data' => [
                    ...$comparison['comparison_data'],
                    'analysis_type' => 'bid_comparison',
                    'created_via' => 'deadline_review',
                ],
            ]);

            $rankedBidIds = collect(data_get($comparison, 'comparison_data.rankings', []))
                ->pluck('bid_id')
                ->map(fn ($id) => (int) $id)
                ->values();
        }

        $arrivalIndexByBidId = $reviewableBids
            ->sortBy(fn ($item) => $item->submitted_at ?? $item->created_at)
            ->values()
            ->mapWithKeys(fn ($item, $index) => [(int) $item->id => $index]);

        return $reviewableBids
            ->sortBy(function ($item) use ($rankedBidIds, $arrivalIndexByBidId) {
                $rankIndex = $rankedBidIds->search((int) $item->id);

                return $rankIndex !== false
                    ? $rankIndex
                    : 100000 + (int) ($arrivalIndexByBidId[(int) $item->id] ?? 100000);
            })
            ->values();
    }

    private function latestBidComparisonRanking(Order $order): Collection
    {
        $latestComparison = AiAnalysisResult::query()
            ->where('order_id', $order->id)
            ->latest()
            ->get()
            ->first(fn ($result) => data_get($result->comparison_data, 'analysis_type') === 'bid_comparison');

        return collect(data_get($latestComparison?->comparison_data, 'rankings', []))
            ->pluck('bid_id')
            ->map(fn ($id) => (int) $id)
            ->values();
    }

    private function getBenchmarkWarning(Order $order, float $amount): ?array
    {
        $benchmark = Bid::query()
            ->whereHas('order', fn ($query) => $query
                ->where('service_type', $order->service_type)
                ->where('id', '!=', $order->id)
            )
            ->whereIn('status', ['submitted', 'shortlisted', 'approved', 'accepted', 'completed'])
            ->whereNotNull('amount')
            ->where('amount', '>', 0)
            ->avg('amount');

        if (! $benchmark || $amount >= ((float) $benchmark * 0.8)) {
            return null;
        }

        return [
            'trade' => $order->service_type,
            'submitted_amount' => round($amount, 2),
            'benchmark_amount' => round((float) $benchmark, 2),
            'threshold_amount' => round((float) $benchmark * 0.8, 2),
        ];
    }

    private function isHiddenScopeSeedBid(mixed $bid): bool
    {
        return (bool) data_get($bid->workflow_meta ?? [], 'quote_scope_seed');
    }
}
