<?php

namespace App\Http\Requests;

use App\Models\User;
use App\Models\Order;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreBidRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof User;
    }

    public function rules(): array
    {
        return [
            'order_id' => ['required', 'integer', 'exists:orders,id'],
            'amount' => ['nullable', 'numeric', 'min:0'],
            'currency' => ['required', 'string', 'max:10'],
            'line_items' => ['nullable', 'array'],
            'line_items.*.label' => ['required_with:line_items', 'string', 'max:255'],
            'line_items.*.quantity' => ['nullable', 'numeric', 'min:0'],
            'line_items.*.unit_price' => ['required_with:line_items', 'numeric', 'min:0'],
            'line_items.*.code' => ['nullable', 'string', 'max:100'],
            'line_items.*.is_custom' => ['nullable', 'boolean'],
            'estimated_start_date' => ['nullable', 'date'],
            'estimated_completion_date' => ['nullable', 'date', 'after_or_equal:estimated_start_date'],
            'notes' => ['nullable', 'string'],
            'workflow_meta' => ['nullable', 'array'],
            'workflow_meta.vat_included' => ['nullable', 'boolean'],
            'attachment' => ['nullable', 'file', 'mimes:pdf,doc,docx,xls,xlsx,png,jpg,jpeg', 'max:10240'],
            'status' => ['nullable', Rule::in(['submitted', 'shortlisted', 'rejected', 'approved', 'accepted', 'completed'])],
        ];
    }

    public function messages(): array
    {
        return [
            'order_id.required' => 'Please select an order.',
            'order_id.exists' => 'The selected order is invalid.',
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
            $lineItems = collect($this->input('line_items', []))->filter(fn ($item) => is_array($item) && filled($item['label'] ?? null));
            $order = $this->filled('order_id')
                ? Order::query()->select('id', 'workflow_status')->find($this->integer('order_id'))
                : null;

            if ($order?->workflow_status === 'public_inspection_open') {
                return;
            }

            if ($this->filled('estimated_start_date') && ! $this->filled('estimated_completion_date')) {
                $validator->errors()->add('estimated_completion_date', 'Please enter an estimated completion date.');
            }

            if (! $lineItems->isNotEmpty() && ! $this->filled('amount')) {
                $validator->errors()->add('amount', 'Bid amount is required when no line items are provided.');
            }
        });
    }
}
