<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\PriceChangeRequest;
use App\Models\PropertyManagerProfile;
use App\Models\User;
use App\Services\VergoRankingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PriceChangeRequestController extends Controller
{
    public function index(Request $request, Order $order): JsonResponse
    {
        $this->authorizeViewer($request, $order);

        return response()->json([
            'data' => $order->priceChangeRequests()->with('serviceProvider:id,company_name')->latest()->get(),
        ]);
    }

    /**
     * The awarded provider asks for approval to change prices and/or add items
     * that the manager dropped after the inspection.
     *
     * Every changed price and every added item must carry its own reason.
     */
    public function store(Request $request, Order $order, VergoRankingService $rankingService): JsonResponse
    {
        $actor = $request->user();
        abort_unless($actor instanceof User && $actor->role?->name === 'provider', 403);

        $provider = $actor->serviceProvider;
        abort_unless($provider, 403);

        $bid = $order->bids()
            ->where('service_provider_id', $provider->id)
            ->whereIn('status', ['approved', 'accepted'])
            ->first();

        abort_unless($bid, 403, 'This order is not awarded to your company.');
        abort_unless(
            $order->priceChangeRequests()->where('status', 'pending')->doesntExist(),
            422,
            'A price change request is already awaiting a decision.'
        );

        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.change_type' => ['required', 'in:changed,added'],
            'items.*.label' => ['required', 'string', 'max:255'],
            'items.*.unit' => ['nullable', 'string', 'max:64'],
            'items.*.quantity' => ['nullable', 'numeric', 'min:0'],
            'items.*.original_unit_price' => ['nullable', 'numeric', 'min:0'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
            // Mandatory for both a changed price and an added item.
            'items.*.reason' => ['required', 'string', 'min:3', 'max:1000'],
            'requested_amount' => ['required', 'numeric', 'min:0'],
        ], [
            'items.*.reason.required' => 'Please give a reason for every changed price and every added item.',
        ]);

        $changeRequest = PriceChangeRequest::query()->create([
            'order_id' => $order->id,
            'bid_id' => $bid->id,
            'service_provider_id' => $provider->id,
            'items' => $validated['items'],
            'original_amount' => $bid->amount,
            'requested_amount' => $validated['requested_amount'],
            'status' => 'pending',
        ]);

        $rankingService->recalculate($provider);

        return response()->json([
            'message' => 'Price change request submitted for approval.',
            'data' => $changeRequest,
        ], 201);
    }

    /**
     * The manager or owner approves or rejects the request.
     */
    public function update(
        Request $request,
        Order $order,
        PriceChangeRequest $priceChangeRequest,
        VergoRankingService $rankingService,
    ): JsonResponse {
        $actor = $this->authorizeDecider($request, $order);

        abort_unless($priceChangeRequest->order_id === $order->id, 404);
        abort_unless($priceChangeRequest->status === 'pending', 422, 'This request has already been decided.');

        $validated = $request->validate([
            'status' => ['required', 'in:approved,rejected'],
            'decision_note' => ['nullable', 'string', 'max:1000'],
        ]);

        $priceChangeRequest->update([
            'status' => $validated['status'],
            'decision_note' => $validated['decision_note'] ?? null,
            'decided_at' => now(),
            'decided_by_type' => $actor instanceof PropertyManagerProfile ? 'manager' : 'user',
            'decided_by_id' => $actor->id,
        ]);

        if ($validated['status'] === 'approved') {
            $bid = $priceChangeRequest->bid;

            if ($bid) {
                $lineItems = collect($bid->line_items ?? []);

                foreach ($priceChangeRequest->items as $item) {
                    if (data_get($item, 'change_type') === 'added') {
                        $lineItems->push([
                            'label' => data_get($item, 'label'),
                            'unit' => data_get($item, 'unit'),
                            'quantity' => data_get($item, 'quantity'),
                            'unit_price' => data_get($item, 'unit_price'),
                            'is_custom' => true,
                            'added_by_price_change_request_id' => $priceChangeRequest->id,
                        ]);
                    }
                }

                $bid->forceFill([
                    'amount' => $priceChangeRequest->requested_amount,
                    'line_items' => $lineItems->values()->all(),
                ])->save();
            }
        }

        // Self-initiated changes affect the provider's VERGO ranking.
        $rankingService->recalculate($priceChangeRequest->serviceProvider);

        return response()->json([
            'message' => 'Price change request updated.',
            'data' => $priceChangeRequest->fresh(),
        ]);
    }

    private function authorizeViewer(Request $request, Order $order): void
    {
        $actor = $request->user();

        if ($actor instanceof PropertyManagerProfile && $actor->canAccessProperty($order->property_id)) {
            return;
        }

        if ($actor instanceof User && in_array($actor->role?->name, ['admin', 'owner', 'employee'], true)) {
            return;
        }

        if ($actor instanceof User && $actor->role?->name === 'provider'
            && $order->bids()->where('service_provider_id', $actor->serviceProvider?->id)->exists()) {
            return;
        }

        abort(403);
    }

    private function authorizeDecider(Request $request, Order $order)
    {
        $actor = $request->user();

        if ($actor instanceof PropertyManagerProfile) {
            abort_unless($actor->canAccessProperty($order->property_id), 403);

            return $actor;
        }

        abort_unless($actor instanceof User && in_array($actor->role?->name, ['admin', 'owner'], true), 403);

        return $actor;
    }
}
