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
            'line_items' => ['nullable', 'array'],
            'line_items.*.category' => ['required_with:line_items', 'string', 'max:255'],
            'line_items.*.label' => ['required_with:line_items', 'string', 'max:255'],
            'line_items.*.quantity' => ['nullable', 'numeric', 'min:0'],
            'line_items.*.unit_price' => ['required_with:line_items', 'numeric', 'min:0'],
            'line_items.*.code' => ['nullable', 'string', 'max:100'],
            'line_items.*.unit' => ['required_with:line_items', 'string', 'max:50'],
            'line_items.*.is_custom' => ['nullable', 'boolean'],
            'estimated_start_date' => ['nullable', 'date'],
            'estimated_completion_date' => ['nullable', 'date', 'after_or_equal:estimated_start_date'],
            'provider_reference' => ['nullable', 'string', 'max:64'],
            'notes' => ['nullable', 'string'],
            'workflow_meta' => ['nullable', 'array'],
            'workflow_meta.vat_included' => ['nullable', 'boolean'],
            'attachment' => ['nullable', 'file', 'mimes:pdf,doc,docx,xls,xlsx,png,jpg,jpeg', 'max:10240'],
            'status' => ['sometimes', 'nullable', Rule::in(['submitted', 'shortlisted', 'rejected', 'approved', 'accepted', 'completed', 'inspection_confirmed'])],
            'rejection_reason' => ['nullable', 'string'],
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

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            if ($this->filled('estimated_start_date') && ! $this->filled('estimated_completion_date')) {
                $validator->errors()->add('estimated_completion_date', 'Please enter an estimated completion date.');
            }
        });
    }
}
