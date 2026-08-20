<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BidLineItemPhoto;
use App\Models\Order;
use App\Models\PropertyManagerProfile;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class BidPhotoController extends Controller
{
    /**
     * Providers see their own photos. Managers/owners/admins see every photo so
     * they can decide what to publish. Other providers only see the published
     * ones, which is what makes them useful as shared reference material.
     */
    public function index(Request $request, Order $order): JsonResponse
    {
        $actor = $request->user();
        $query = $order->lineItemPhotos()->with('serviceProvider:id,company_name')->latest();

        if ($actor instanceof User && $actor->role?->name === 'provider') {
            $providerId = $actor->serviceProvider?->id;

            $query->where(function ($sub) use ($providerId): void {
                $sub->where('service_provider_id', $providerId)->orWhere('is_published', true);
            });
        }

        return response()->json(['data' => $query->get()->map(fn (BidLineItemPhoto $photo) => $this->present($photo))]);
    }

    public function store(Request $request, Order $order): JsonResponse
    {
        $actor = $request->user();
        abort_unless($actor instanceof User && $actor->role?->name === 'provider', 403);

        $provider = $actor->serviceProvider;
        abort_unless($provider, 403);

        $bid = $order->bids()->where('service_provider_id', $provider->id)->first();
        abort_unless($bid, 403, 'You have no quote on this order.');

        $validated = $request->validate([
            'line_item_index' => ['required', 'integer', 'min:0'],
            // Works for both "take a photo" (camera capture) and "upload a
            // photo" - the browser sends an image file either way.
            'photo' => ['required', 'image', 'mimes:jpeg,jpg,png,heic,webp', 'max:10240'],
        ]);

        $file = $request->file('photo');
        $path = $file->store('vergo-bid-photos');

        $photo = BidLineItemPhoto::query()->create([
            'order_id' => $order->id,
            'bid_id' => $bid->id,
            'service_provider_id' => $provider->id,
            'line_item_index' => (int) $validated['line_item_index'],
            'name' => $file->getClientOriginalName(),
            'path' => $path,
            'mime_type' => $file->getMimeType(),
            'size' => $file->getSize(),
            'is_published' => false,
        ]);

        return response()->json(['data' => $this->present($photo)], 201);
    }

    /**
     * The manager decides per photo whether it is published to the other
     * providers in the linked files section.
     */
    public function update(Request $request, Order $order, BidLineItemPhoto $photo): JsonResponse
    {
        $this->authorizeManager($request, $order);
        abort_unless($photo->order_id === $order->id, 404);

        $validated = $request->validate(['is_published' => ['required', 'boolean']]);

        $photo->update([
            'is_published' => $validated['is_published'],
            'published_at' => $validated['is_published'] ? now() : null,
        ]);

        return response()->json(['data' => $this->present($photo->fresh())]);
    }

    public function destroy(Request $request, Order $order, BidLineItemPhoto $photo): JsonResponse
    {
        $actor = $request->user();
        abort_unless($photo->order_id === $order->id, 404);

        $isOwningProvider = $actor instanceof User
            && $actor->role?->name === 'provider'
            && $actor->serviceProvider?->id === $photo->service_provider_id;

        if (! $isOwningProvider) {
            $this->authorizeManager($request, $order);
        }

        Storage::delete($photo->path);
        $photo->delete();

        return response()->json(['message' => 'Photo deleted.']);
    }

    public function download(Request $request, Order $order, BidLineItemPhoto $photo)
    {
        abort_unless($photo->order_id === $order->id, 404);

        $actor = $request->user();

        if ($actor instanceof User && $actor->role?->name === 'provider') {
            abort_unless(
                $photo->is_published || $actor->serviceProvider?->id === $photo->service_provider_id,
                403
            );
        }

        return Storage::download($photo->path, $photo->name);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(BidLineItemPhoto $photo): array
    {
        return [
            'id' => $photo->id,
            'order_id' => $photo->order_id,
            'line_item_index' => $photo->line_item_index,
            'name' => $photo->name,
            'mime_type' => $photo->mime_type,
            'size' => $photo->size,
            'is_published' => $photo->is_published,
            'published_at' => $photo->published_at?->toDateTimeString(),
            'company_name' => $photo->serviceProvider?->company_name,
            'download_url' => route('bid-photos.download', ['order' => $photo->order_id, 'photo' => $photo->id]),
            'created_at' => $photo->created_at?->toDateTimeString(),
        ];
    }

    private function authorizeManager(Request $request, Order $order): void
    {
        $actor = $request->user();

        if ($actor instanceof PropertyManagerProfile) {
            abort_unless($actor->canAccessProperty($order->property_id), 403);

            return;
        }

        abort_unless($actor instanceof User && in_array($actor->role?->name, ['admin', 'owner', 'employee'], true), 403);
    }
}
