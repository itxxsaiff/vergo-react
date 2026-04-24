<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreProviderReviewRequest;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Models\PropertyManagerProfile;
use App\Models\ProviderReview;
use App\Models\User;

class ProviderReviewController extends Controller
{
    public function store(StoreProviderReviewRequest $request, Order $order): OrderResource
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
            abort(403, 'Only owners or property managers can review completed work.');
        }

        abort_unless($order->status === 'completed', 422, 'You can review a provider only after the work is completed.');

        $approvedBid = $order->approvedBid()->first();
        abort_unless($approvedBid && $approvedBid->service_provider_id, 422, 'No approved provider is linked to this completed order.');

        $reviewPayload = [
            'service_provider_id' => $approvedBid->service_provider_id,
            'order_id' => $order->id,
            'property_id' => $order->property_id,
            'rating' => $request->integer('rating'),
            'comment' => $request->input('comment'),
            'reviewer_user_id' => $actor instanceof User ? $actor->id : null,
            'reviewer_manager_profile_id' => $actor instanceof PropertyManagerProfile ? $actor->id : null,
        ];

        ProviderReview::query()->updateOrCreate(
            [
                'order_id' => $order->id,
                'reviewer_user_id' => $reviewPayload['reviewer_user_id'],
                'reviewer_manager_profile_id' => $reviewPayload['reviewer_manager_profile_id'],
            ],
            $reviewPayload
        );

        return new OrderResource($order->fresh()->load([
            'property:id,li_number,title,city,country',
            'propertyObject:id,name,type,reference',
            'propertyManager:id,name,email',
            'bids.serviceProvider:id,company_name,contact_email',
            'approvedBid.serviceProvider:id,company_name,contact_email',
            'providerReviews.reviewerUser:id,name',
            'providerReviews.reviewerManagerProfile:id,name,email',
            'documents',
            'analysisResults',
        ])->loadCount('bids'));
    }
}
