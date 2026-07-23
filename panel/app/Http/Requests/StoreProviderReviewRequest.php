<?php

namespace App\Http\Requests;

use App\Models\PropertyManagerProfile;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreProviderReviewRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof User || $this->user() instanceof PropertyManagerProfile;
    }

    public function rules(): array
    {
        return [
            'rating' => ['nullable', 'integer', 'min:1', 'max:5'],
            'communication_rating' => ['nullable', 'integer', 'min:1', 'max:5'],
            'punctuality_rating' => ['nullable', 'integer', 'min:1', 'max:5'],
            'quality_rating' => ['nullable', 'integer', 'min:1', 'max:5'],
            'comment' => ['nullable', 'string', 'max:2000'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $categoryFields = ['communication_rating', 'punctuality_rating', 'quality_rating'];
            $filledCategoryCount = collect($categoryFields)
                ->filter(fn ($field) => $this->filled($field))
                ->count();

            if ($filledCategoryCount > 0 && $filledCategoryCount < count($categoryFields)) {
                $validator->errors()->add('rating', 'Please rate communication, punctuality, and quality of work.');
            }

            if ($filledCategoryCount === 0 && ! $this->filled('rating')) {
                $validator->errors()->add('rating', 'Please select a rating.');
            }
        });
    }

    public function messages(): array
    {
        return [
            'rating.required' => 'Please select a rating.',
            'rating.integer' => 'Rating must be a whole number.',
            'rating.min' => 'Rating must be at least 1.',
            'rating.max' => 'Rating must not exceed 5.',
            'communication_rating.integer' => 'Communication rating must be a whole number.',
            'punctuality_rating.integer' => 'Punctuality rating must be a whole number.',
            'quality_rating.integer' => 'Quality rating must be a whole number.',
            'comment.max' => 'Review comment must not exceed 2000 characters.',
        ];
    }
}
