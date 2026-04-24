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
        abort_unless(in_array($order->status, ['open', 'in_review'], true), 422, 'This order is not open for bidding.');
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

        $bid = Bid::query()->create([
            'order_id' => $order->id,
            'service_provider_id' => $serviceProvider->id,
            'amount' => $request->input('amount'),
            'currency' => $request->string('currency')->toString(),
            'estimated_start_date' => $request->input('estimated_start_date'),
            'estimated_completion_date' => $request->input('estimated_completion_date'),
            'notes' => $request->input('notes'),
            'attachment_name' => $attachment?->getClientOriginalName(),
            'attachment_path' => $attachmentPath,
            'attachment_mime_type' => $attachment?->getMimeType(),
            'attachment_size' => $attachment?->getSize(),
            'status' => 'submitted',
            'submitted_at' => now(),
        ]);

        $notificationService->sendBidSubmitted(
            $order->load('property.owners', 'property.managerProfiles'),
            $serviceProvider->company_name ?: $serviceProvider->contact_name ?: 'A provider',
            $actor
        );

        return new BidResource($bid->load([
            'order.property:id,li_number,title',
            'serviceProvider:id,company_name,contact_name,contact_email',
        ]));
    }

    public function update(UpdateBidRequest $request, Bid $bid): BidResource
    {
        $actor = $request->user();

        if ($actor instanceof User && $actor->role?->name === 'provider') {
            abort(403, 'Submitted bids cannot be updated by providers.');
        } elseif ($actor instanceof PropertyManagerProfile) {
            abort_unless($bid->order()->where('property_id', $actor->property_id)->exists(), 403);

            $status = $request->input('status', $bid->status);
            abort_unless($status === 'shortlisted', 422, 'Property managers can only shortlist bids.');
            abort_unless($bid->status === 'submitted', 422, 'Only newly submitted bids can be shortlisted.');

            $bid->update([
                'status' => 'shortlisted',
            ]);
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

            $approvedBidExists = $order->bids()->where('status', 'approved')->exists();
            $hasBids = $order->bids()->exists();
            $shortlistedBidExists = $order->bids()->where('status', 'shortlisted')->exists();

            if ($approvedBidExists) {
                $approvedBidId = $order->bids()
                    ->where('status', 'approved')
                    ->latest('updated_at')
                    ->value('id');

                $order->bids()
                    ->where('id', '!=', $approvedBidId)
                    ->where('status', '!=', 'rejected')
                    ->update(['status' => 'rejected']);

                $order->update(['status' => 'approved']);
                return;
            }

            $order->update([
                'status' => $shortlistedBidExists ? 'awaiting_owner_approval' : ($hasBids ? 'in_review' : 'open'),
            ]);
        });
    }
}
