<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreBidRequest;
use App\Http\Requests\UpdateBidRequest;
use App\Http\Resources\BidResource;
use App\Models\Bid;
use App\Models\Order;
use App\Models\PropertyManagerProfile;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class BidController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $actor = $request->user();

        $query = Bid::query()
            ->with([
                'order.property:id,li_number,title',
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
            $query->whereHas('order', fn ($orderQuery) => $orderQuery->where('property_id', $actor->property_id));
        } else {
            abort_unless($actor instanceof User && $actor->role?->name === 'admin', 403);
        }

        return BidResource::collection($query->get());
    }

    public function store(StoreBidRequest $request, NotificationService $notificationService): BidResource
    {
        $actor = $request->user();
        abort_unless($actor instanceof User && $actor->role?->name === 'provider', 403);

        $serviceProvider = $actor->serviceProvider;
        abort_unless($serviceProvider, 403);

        $order = Order::query()->findOrFail($request->integer('order_id'));
        abort_unless(
            in_array($order->workflow_status, ['public_inspection_open', 'inspection_signup_closed', 'published_for_quotes'], true),
            422,
            'This workflow is not open for provider submissions.'
        );
        abort_if(
            Bid::query()
                ->where('order_id', $order->id)
                ->where('service_provider_id', $serviceProvider->id)
                ->exists(),
            422,
            'You have already submitted a bid for this order.'
        );

        $attachment = $request->file('attachment');
        $attachmentPath = $attachment?->store('vergo-bid-attachments');
        $lineItems = collect($request->input('line_items', []))->values()->all();
        $currency = $request->string('currency')->toString() ?: 'EUR';

        if ($order->workflow_status === 'published_for_quotes') {
            abort_unless(
                ! $order->bid_deadline_at || now()->lte($order->bid_deadline_at),
                422,
                'The bid deadline has already passed.'
            );
        }

        if ($order->workflow_status === 'inspection_signup_closed') {
            abort(422, 'This inspection request has already reached the signup limit.');
        }

        $amount = $this->resolveBidAmount($lineItems, $request->input('amount'));
        $status = $order->workflow_status === 'published_for_quotes' ? 'submitted' : 'inspection_interest';
        $workflowMeta = $request->input('workflow_meta', []);

        $bid = Bid::query()->create([
            'order_id' => $order->id,
            'service_provider_id' => $serviceProvider->id,
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
        ]);

        if ($order->workflow_status === 'published_for_quotes') {
            $notificationService->sendBidSubmitted(
                $order->load('property.owners', 'property.managerProfiles'),
                $serviceProvider->company_name ?: $serviceProvider->contact_name ?: 'A provider',
                $actor
            );
        } else {
            $count = Bid::query()
                ->where('order_id', $order->id)
                ->whereIn('status', ['inspection_interest', 'inspection_confirmed'])
                ->count();

            if ($count >= 3) {
                $order->update(['workflow_status' => 'inspection_signup_closed']);
            }
        }

        return new BidResource($bid->load([
            'order.property:id,li_number,title',
            'serviceProvider:id,company_name,contact_name,contact_email',
        ]));
    }

    public function update(UpdateBidRequest $request, Bid $bid): BidResource
    {
        $actor = $request->user();

        if ($actor instanceof User && $actor->role?->name === 'provider') {
            $serviceProvider = $actor->serviceProvider;
            abort_unless($serviceProvider && $bid->service_provider_id === $serviceProvider->id, 403);

            $status = $request->input('status', $bid->status);
            abort_unless(
                in_array($status, ['inspection_confirmed', 'accepted', 'completed'], true),
                422,
                'Providers can only confirm inspections, accept awards, or complete work.'
            );

            if ($status === 'inspection_confirmed') {
                abort_unless(in_array($bid->status, ['inspection_requested', 'inspection_interest'], true), 422);
            }

            if ($status === 'accepted') {
                abort_unless(in_array($bid->status, ['awarded_pending_acceptance', 'approved'], true), 422);
            }

            if ($status === 'completed') {
                abort_unless(in_array($bid->status, ['accepted', 'approved'], true), 422);
            }

            $bid->update([
                'status' => $status,
                'workflow_meta' => [
                    ...($bid->workflow_meta ?? []),
                    'provider_last_action_at' => now()->toDateTimeString(),
                ],
            ]);
        } elseif ($actor instanceof PropertyManagerProfile) {
            abort_unless($bid->order()->where('property_id', $actor->property_id)->exists(), 403);

            $status = $request->input('status', $bid->status);
            $order = $bid->order()->firstOrFail();

            if ($order->workflow_status === 'published_for_quotes') {
                abort_unless(! $order->bid_deadline_at || now()->gt($order->bid_deadline_at), 422, 'Bids remain hidden until the submission deadline passes.');
                abort_unless(in_array($status, ['approved', 'rejected'], true), 422, 'Managers can only award or reject ranked bids.');

                $orderedBids = $order->bids()
                    ->with('serviceProvider')
                    ->get()
                    ->sortByDesc(fn ($item) => (float) $item->amount)
                    ->values();

                $currentReviewIndex = $orderedBids->search(fn ($item) => !in_array($item->status, ['rejected', 'approved'], true));
                $currentBid = $currentReviewIndex !== false ? $orderedBids->get($currentReviewIndex) : null;

                abort_unless($currentBid && $currentBid->id === $bid->id, 422, 'You must review bids in order and reject the current top candidate before opening the next one.');

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
            'order.property:id,li_number,title',
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
            abort_unless($bid->order()->where('property_id', $actor->property_id)->exists(), 403);
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

            $order->update([
                'status' => $shortlistedBidExists ? 'awaiting_owner_approval' : ($hasBids ? 'in_review' : 'open'),
            ]);
        });
    }

    private function resolveBidAmount(array $lineItems, mixed $fallbackAmount): ?float
    {
        if (! empty($lineItems)) {
            return (float) collect($lineItems)->sum(function ($item) {
                return ((float) data_get($item, 'quantity', 0)) * ((float) data_get($item, 'unit_price', 0));
            });
        }

        return $fallbackAmount !== null ? (float) $fallbackAmount : null;
    }
}
