<?php

namespace App\Http\Resources;

use App\Models\User;
use App\Models\PropertyManagerProfile;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            // Running Vergo order number, e.g. VER-2608-00001.
            'order_number' => $this->order_number,
            'property_id' => $this->property_id,
            'property_object_id' => $this->property_object_id,
            'property_object_ids' => $this->property_object_ids ?? [],
            'requester_name' => $this->requester_name,
            'requester_email' => $this->requester_email,
            'title' => $this->title,
            'service_type' => $this->service_type,
            'job_type' => $this->service_type,
            'description' => $this->description,
            'status' => $this->status,
            'workflow_type' => $this->workflow_type,
            'workflow_status' => $this->workflow_status,
            'bid_priority' => $this->bid_priority,
            'due_date' => $this->due_date?->toDateString(),
            'bid_deadline_at' => $this->bid_deadline_at?->toDateTimeString(),
            'workflow_meta' => $this->workflow_meta ?? [],
            'preferred_inspection_appointment' => $this->preferredInspectionAppointment(),
            'inspection_quote_options' => $this->inspectionQuoteOptions($request),
            'attachment_name' => $this->attachment_name,
            'attachment_mime_type' => $this->attachment_mime_type,
            'attachment_size' => $this->attachment_size,
            'attachment_download_url' => $this->attachment_path ? route('orders.attachment.download', $this->id) : null,
            'quote_items' => collect($this->quote_items ?? [])
                ->map(fn ($item) => [
                    'category' => data_get($item, 'category') ?: data_get($item, 'code') ?: data_get($item, 'label'),
                    'label' => data_get($item, 'label'),
                    'code' => data_get($item, 'code'),
                    'unit' => data_get($item, 'unit'),
                    'quantity' => data_get($item, 'quantity'),
                    'is_custom' => (bool) data_get($item, 'is_custom', true),
                ])
                ->values()
                ->all(),
            'requested_at' => $this->requested_at?->toDateTimeString(),
            'completed_at' => $this->completed_at?->toDateTimeString(),
            'cancelled_at' => $this->cancelled_at?->toDateTimeString(),
            'cancellation_reason' => $this->cancellation_reason,
            'duplicate_of_order_id' => $this->duplicate_of_order_id,
            'duplicate_explanation' => $this->duplicate_explanation,
            'deleted_at' => $this->deleted_at?->toDateTimeString(),
            'is_approved' => $this->relationLoaded('approvedBid') ? $this->approvedBid !== null : null,
            'property' => $this->whenLoaded('property', fn () => [
                'id' => $this->property->id,
                'li_number' => $this->property->li_number,
                'title' => $this->property->title,
                'size' => $this->property->size !== null ? (float) $this->property->size : null,
                'postal_code' => $this->property->postal_code,
                'city' => $this->property->city,
                'country' => $this->property->country,
            ]),
            'property_object' => $this->whenLoaded('propertyObject', fn () => $this->propertyObject ? [
                'id' => $this->propertyObject->id,
                'name' => $this->propertyObject->name,
                'address' => $this->propertyObject->address,
                'postal_code' => $this->propertyObject->postal_code,
                'city' => $this->propertyObject->city,
                'type' => $this->propertyObject->type,
                'reference' => $this->propertyObject->reference,
            ] : null),
            'property_manager' => $this->whenLoaded('propertyManager', fn () => $this->propertyManager ? [
                'id' => $this->propertyManager->id,
                'name' => $this->propertyManager->name,
                'email' => $this->propertyManager->email,
            ] : null),
            'approved_bid' => $this->whenLoaded('approvedBid', fn () => $this->approvedBid ? [
                'id' => $this->approvedBid->id,
                'service_provider_id' => $this->approvedBid->service_provider_id,
                'service_provider' => $this->approvedBid->serviceProvider ? [
                    'id' => $this->approvedBid->serviceProvider->id,
                    'company_name' => $this->approvedBid->serviceProvider->company_name,
                    'contact_email' => $this->approvedBid->serviceProvider->contact_email,
                ] : null,
            ] : null),
            'bids_count' => $this->whenCounted('bids'),
            'bids' => $this->whenLoaded('bids', fn () => $this->bids->map(function ($bid) use ($request) {
                $hideScopeSeedPrices = $this->shouldHideScopeSeedPrices($request, $bid);

                return [
                    'id' => $bid->id,
                    'amount' => $hideScopeSeedPrices ? null : $bid->amount,
                    'currency' => $bid->currency,
                    'line_items' => $hideScopeSeedPrices ? $this->scopeOnlyLineItems($bid->line_items ?? []) : ($bid->line_items ?? []),
                    'prices_hidden' => $hideScopeSeedPrices,
                    'status' => $bid->status,
                    'estimated_start_date' => $bid->estimated_start_date?->toDateString(),
                    'estimated_completion_date' => $bid->estimated_completion_date?->toDateString(),
                    'notes' => $hideScopeSeedPrices ? null : $bid->notes,
                    'workflow_meta' => $hideScopeSeedPrices ? $this->scopeOnlyWorkflowMeta($bid->workflow_meta ?? []) : ($bid->workflow_meta ?? []),
                    'rejection_reason' => $bid->rejection_reason,
                    'attachment_name' => $hideScopeSeedPrices ? null : $bid->attachment_name,
                    'attachment_mime_type' => $hideScopeSeedPrices ? null : $bid->attachment_mime_type,
                    'attachment_size' => $hideScopeSeedPrices ? null : $bid->attachment_size,
                    'attachment_download_url' => ! $hideScopeSeedPrices && $bid->attachment_path ? route('bids.attachment.download', $bid->id) : null,
                    'submitted_at' => $bid->submitted_at?->toDateTimeString(),
                    'created_at' => $bid->created_at?->toDateTimeString(),
                    'service_provider' => ! $hideScopeSeedPrices && $bid->serviceProvider ? [
                        'id' => $bid->serviceProvider->id,
                        'company_name' => $bid->serviceProvider->company_name,
                        'contact_email' => $bid->serviceProvider->contact_email,
                    ] : null,
                ];
            })->values()),
            'documents' => $this->whenLoaded('documents', fn () => $this->documents->map(fn ($document) => [
                'id' => $document->id,
                'title' => $document->title,
                'type' => $document->type,
                'status' => $document->status,
                'file_name' => $document->file_name,
                'download_url' => route('documents.download', $document->id),
                'created_at' => $document->created_at?->toDateTimeString(),
            ])->values()),
            'analysis_results' => $this->whenLoaded('analysisResults', fn () => $this->analysisResults
                ->sortByDesc('created_at')
                ->values()
                ->map(fn ($result) => [
                'id' => $result->id,
                'status' => $result->status,
                'score' => $result->score,
                'summary' => $result->summary,
                'comparison_data' => $result->comparison_data,
                'created_at' => $result->created_at?->toDateTimeString(),
            ])),
            'provider_reviews' => $this->whenLoaded('providerReviews', fn () => $this->providerReviews
                ->sortByDesc('created_at')
                ->values()
                ->map(fn ($review) => [
                    'id' => $review->id,
                    'rating' => $review->rating,
                    'communication_rating' => $review->communication_rating,
                    'punctuality_rating' => $review->punctuality_rating,
                    'quality_rating' => $review->quality_rating,
                    'comment' => $review->comment,
                    'reviewer_role' => $review->reviewer_user_id ? 'owner' : 'manager',
                    'reviewer_name' => $review->reviewerUser?->name ?? $review->reviewerManagerProfile?->name ?? 'Reviewer',
                    'created_at' => $review->created_at?->toDateTimeString(),
                ])),
            'created_at' => $this->created_at?->toDateTimeString(),
        ];
    }

    private function shouldHideScopeSeedPrices(Request $request, mixed $bid): bool
    {
        if (! data_get($bid->workflow_meta ?? [], 'quote_scope_seed')) {
            return false;
        }

        $actor = $request->user();

        return ! (
            $actor instanceof User
            && $actor->role?->name === 'provider'
            && $actor->serviceProvider?->id === $bid->service_provider_id
        );
    }

    private function preferredInspectionAppointment(): ?array
    {
        $slots = data_get($this->workflow_meta ?? [], 'inspection.preferred_slots', []);

        if (! is_array($slots) || empty($slots)) {
            return null;
        }

        $confirmedBids = $this->relationLoaded('confirmedInspectionBids')
            ? $this->confirmedInspectionBids
            : $this->confirmedInspectionBids()
                ->get(['id', 'order_id', 'status', 'workflow_meta', 'submitted_at', 'created_at', 'updated_at']);

        $preferredBid = collect($confirmedBids)
            ->filter(function ($bid) use ($slots): bool {
                $slotIndex = data_get($bid->workflow_meta ?? [], 'selected_slot_index');

                return $slotIndex !== null
                    && $slotIndex !== ''
                    && array_key_exists((int) $slotIndex, $slots);
            })
            ->sortBy(fn ($bid) => $this->inspectionConfirmedAt($bid) ?? '9999-12-31 23:59:59')
            ->first();

        if (! $preferredBid) {
            return null;
        }

        $slotIndex = (int) data_get($preferredBid->workflow_meta ?? [], 'selected_slot_index');

        return [
            'slot_index' => $slotIndex,
            'slot' => $slots[$slotIndex] ?? null,
            'confirmed_at' => $this->inspectionConfirmedAt($preferredBid),
        ];
    }

    private function inspectionQuoteOptions(Request $request): array
    {
        if (! $this->canSeeAnonymousInspectionQuoteOptions($request)) {
            return [];
        }

        $bids = $this->relationLoaded('inspectionQuoteSeedBids')
            ? $this->inspectionQuoteSeedBids
            : $this->inspectionQuoteSeedBids()
                ->get(['id', 'order_id', 'status', 'line_items', 'workflow_meta', 'submitted_at', 'created_at', 'updated_at']);

        return collect($bids)
            ->filter(fn ($bid) => (bool) data_get($bid->workflow_meta ?? [], 'quote_scope_seed'))
            ->sortBy(fn ($bid) => $bid->submitted_at?->toDateTimeString() ?? $bid->created_at?->toDateTimeString() ?? '')
            ->map(function ($bid) {
                $lineItems = collect($this->scopeOnlyLineItems($bid->line_items ?? []))
                    ->filter(fn ($item) => filled(data_get($item, 'label')) && (float) data_get($item, 'quantity', 0) > 0)
                    ->map(fn ($item, $index) => [
                        ...$item,
                        'source' => 'provider',
                        'source_bid_id' => $bid->id,
                        'source_item_index' => $index,
                    ])
                    ->values()
                    ->all();

                return [
                    'option_id' => 'inspection-quote-'.$bid->id,
                    'source_bid_id' => $bid->id,
                    'submitted_at' => $bid->submitted_at?->toDateTimeString() ?? $bid->created_at?->toDateTimeString(),
                    'line_items' => $lineItems,
                ];
            })
            ->filter(fn ($option) => ! empty($option['line_items']))
            ->values()
            ->map(fn ($option, $index) => [
                ...$option,
                'option_label' => 'Option '.($index + 1),
            ])
            ->all();
    }

    private function canSeeAnonymousInspectionQuoteOptions(Request $request): bool
    {
        $actor = $request->user();

        return $actor instanceof PropertyManagerProfile
            || ($actor instanceof User && in_array($actor->role?->name, ['admin', 'employee'], true));
    }

    private function inspectionConfirmedAt(mixed $bid): ?string
    {
        $confirmedAt = data_get($bid->workflow_meta ?? [], 'provider_last_action_at');

        if ($confirmedAt) {
            return (string) $confirmedAt;
        }

        return $bid->updated_at?->toDateTimeString()
            ?? $bid->submitted_at?->toDateTimeString()
            ?? $bid->created_at?->toDateTimeString();
    }

    private function scopeOnlyLineItems(array $lineItems): array
    {
        return collect($lineItems)
            ->map(fn ($item) => [
                'category' => data_get($item, 'category') ?: data_get($item, 'code') ?: data_get($item, 'label'),
                'label' => data_get($item, 'label'),
                'code' => data_get($item, 'code'),
                'unit' => data_get($item, 'unit'),
                'quantity' => data_get($item, 'quantity'),
                'is_custom' => (bool) data_get($item, 'is_custom', true),
            ])
            ->values()
            ->all();
    }

    private function scopeOnlyWorkflowMeta(array $workflowMeta): array
    {
        data_forget($workflowMeta, 'pricing');
        data_forget($workflowMeta, 'benchmark_warning');

        return $workflowMeta;
    }
}
