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
            'user_id' => $this->user_id,
            'company_name' => $this->company_name,
            'contact_name' => $this->contact_name,
            'contact_email' => $this->contact_email,
            'phone' => $this->phone,
            'rating' => $this->getAverageRatingValue(),
            'completed_jobs_count' => $this->getCompletedJobsCountValue(),
            'status' => $this->status,
            'bids_count' => $this->whenCounted('bids'),
            'created_at' => $this->created_at?->toDateTimeString(),
        ];
    }
}
