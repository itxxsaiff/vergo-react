<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ServiceProviderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'customer_number' => 'DLS-'.str_pad((string) $this->id, 5, '0', STR_PAD_LEFT),
            'user_id' => $this->user_id,
            'company_name' => $this->company_name,
            'contact_name' => $this->contact_name,
            'contact_email' => $this->contact_email,
            'order_email' => $this->order_email,
            'address' => $this->address,
            'postal_code' => $this->postal_code,
            'city' => $this->city,
            'canton' => $this->canton,
            'domain_suffix' => $this->domain_suffix,
            'trade_groups' => $this->trade_groups ?? [],
            'phone' => $this->phone,
            'is_vat_subject' => (bool) $this->is_vat_subject,
            'rating' => $this->getAverageRatingValue(),
            'rating_breakdown' => $this->getAverageRatingBreakdownValue(),
            'completed_jobs_count' => $this->getCompletedJobsCountValue(),
            'status' => $this->status === 'pending' ? 'inactive' : $this->status,
            'bids_count' => $this->whenCounted('bids'),
            'created_at' => $this->created_at?->toDateTimeString(),
        ];
    }
}
