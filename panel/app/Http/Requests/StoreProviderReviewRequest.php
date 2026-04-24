<?php

namespace App\Http\Requests;

use App\Models\PropertyManagerProfile;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;

class StoreProviderReviewRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof User || $this->user() instanceof PropertyManagerProfile;
    }

    public function rules(): array
    {
        return [
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'comment' => ['nullable', 'string', 'max:2000'],
        ];
    }

    public function messages(): array
    {
        return [
            'rating.required' => 'Please select a rating.',
            'rating.integer' => 'Rating must be a whole number.',
            'rating.min' => 'Rating must be at least 1.',
            'rating.max' => 'Rating must not exceed 5.',
            'comment.max' => 'Review comment must not exceed 2000 characters.',
        ];
    }
}
