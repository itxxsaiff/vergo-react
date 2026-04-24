<?php

namespace App\Http\Requests;

use App\Models\PropertyManagerProfile;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateBidRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof User || $this->user() instanceof PropertyManagerProfile;
    }

    public function rules(): array
    {
        return [
            'amount' => ['sometimes', 'required', 'numeric', 'min:0'],
            'currency' => ['sometimes', 'required', 'string', 'max:10'],
            'estimated_start_date' => ['nullable', 'date'],
            'estimated_completion_date' => ['nullable', 'date', 'after_or_equal:estimated_start_date'],
            'notes' => ['nullable', 'string'],
            'attachment' => ['nullable', 'file', 'mimes:pdf,doc,docx,xls,xlsx,png,jpg,jpeg', 'max:10240'],
            'status' => ['sometimes', 'nullable', Rule::in(['submitted', 'shortlisted', 'rejected', 'approved'])],
        ];
    }

    public function messages(): array
    {
        return [
            'amount.required' => 'Bid amount is required.',
            'currency.required' => 'Currency is required.',
            'estimated_completion_date.after_or_equal' => 'Completion date must be after the start date.',
            'attachment.max' => 'Attachment size must not exceed 10 MB.',
            'attachment.mimes' => 'Attachment must be a PDF, Office document, or image file.',
            'status.in' => 'Please select a valid bid status.',
        ];
    }
}
