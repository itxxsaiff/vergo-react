<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'order_number' => 'AUF-'.str_pad((string) $this->id, 5, '0', STR_PAD_LEFT),
            'property_id' => $this->property_id,
            'property_object_id' => $this->property_object_id,
            'requester_name' => $this->requester_name,
            'requester_email' => $this->requester_email,
            'title' => $this->title,
            'service_type' => $this->service_type,
            'job_type' => $this->service_type,
            'description' => $this->description,
            'status' => $this->status,
            'due_date' => $this->due_date?->toDateString(),
            'requested_at' => $this->requested_at?->toDateTimeString(),
            'completed_at' => $this->completed_at?->toDateTimeString(),
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
            'bids' => $this->whenLoaded('bids', fn () => $this->bids->map(fn ($bid) => [
                'id' => $bid->id,
                'amount' => $bid->amount,
                'currency' => $bid->currency,
                'status' => $bid->status,
                'estimated_start_date' => $bid->estimated_start_date?->toDateString(),
                'estimated_completion_date' => $bid->estimated_completion_date?->toDateString(),
                'notes' => $bid->notes,
                'attachment_name' => $bid->attachment_name,
                'attachment_mime_type' => $bid->attachment_mime_type,
                'attachment_size' => $bid->attachment_size,
                'attachment_download_url' => $bid->attachment_path ? route('bids.attachment.download', $bid->id) : null,
                'submitted_at' => $bid->submitted_at?->toDateTimeString(),
                'created_at' => $bid->created_at?->toDateTimeString(),
                'service_provider' => $bid->serviceProvider ? [
                    'id' => $bid->serviceProvider->id,
                    'company_name' => $bid->serviceProvider->company_name,
                    'contact_email' => $bid->serviceProvider->contact_email,
                ] : null,
            ])->values()),
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
                    'comment' => $review->comment,
                    'reviewer_role' => $review->reviewer_user_id ? 'owner' : 'manager',
                    'reviewer_name' => $review->reviewerUser?->name ?? $review->reviewerManagerProfile?->name ?? 'Reviewer',
                    'created_at' => $review->created_at?->toDateTimeString(),
                ])),
            'created_at' => $this->created_at?->toDateTimeString(),
        ];
    }
}
