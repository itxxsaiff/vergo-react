<?php

namespace App\Http\Requests;

use App\Models\PropertyManagerProfile;
use App\Models\Property;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreOrderRequest extends FormRequest
{
    private function isDraftRequest(): bool
    {
        return $this->input('status') === 'draft';
    }

    protected function prepareForValidation(): void
    {
        $merge = [];

        foreach (['property_object_ids', 'workflow_meta', 'quote_items'] as $field) {
            $value = $this->input($field);

            if (is_string($value) && $value !== '') {
                $decoded = json_decode($value, true);

                if (json_last_error() === JSON_ERROR_NONE) {
                    $merge[$field] = $decoded;
                }
            }
        }

        if ($merge !== []) {
            $this->merge($merge);
        }
    }

    public function authorize(): bool
    {
        $actor = $this->user();

        return $actor instanceof PropertyManagerProfile;
    }

    public function rules(): array
    {
        $isDraft = $this->isDraftRequest();

        return [
            'property_id' => ['required', 'integer', 'exists:properties,id'],
            'property_object_id' => ['nullable', 'integer', 'exists:property_objects,id'],
            'property_object_ids' => ['nullable', 'array'],
            'property_object_ids.*' => ['integer', 'exists:property_objects,id'],
            'requester_name' => ['nullable', 'string', 'max:255'],
            'requester_email' => ['nullable', 'email', 'max:255'],
            'title' => [$isDraft ? 'nullable' : 'required', 'string', 'max:255'],
            'service_type' => [$isDraft ? 'nullable' : 'required', 'string', 'max:255', Rule::in(config('vergo.job_types', []))],
            'description' => ['nullable', 'string'],
            'status' => ['nullable', Rule::in(['draft', 'open', 'in_review', 'awaiting_owner_approval', 'approved', 'completed', 'closed'])],
            'workflow_type' => ['nullable', Rule::in(['inspection', 'direct_order'])],
            'workflow_status' => ['nullable', 'string', 'max:40'],
            'bid_priority' => ['nullable', Rule::in(['lowest_price', 'fastest_turnaround', 'high_quality_materials'])],
            'due_date' => ['nullable', 'date', 'after_or_equal:today'],
            'bid_deadline_at' => ['nullable', 'date', 'after_or_equal:today'],
            'workflow_meta' => ['nullable', 'array'],
            'attachment' => ['nullable', 'file', 'mimes:pdf,png,jpg,jpeg', 'max:10240'],
            'quote_items' => ['nullable', 'array'],
            'quote_items.*.category' => ['required_with:quote_items', 'string', 'max:255'],
            'quote_items.*.label' => ['required_with:quote_items', 'string', 'max:255'],
            'quote_items.*.code' => ['nullable', 'string', 'max:100'],
            'quote_items.*.unit' => ['nullable', 'string', 'max:50'],
            'quote_items.*.quantity' => ['nullable', 'numeric', 'min:0'],
            'quote_items.*.source' => ['nullable', 'string', 'max:100'],
            'quote_items.*.is_custom' => ['nullable', 'boolean'],
            'requested_at' => ['nullable', 'date'],
        ];
    }

    public function messages(): array
    {
        return [
            'property_id.required' => 'Please select a property.',
            'property_id.exists' => 'The selected property is invalid.',
            'property_object_id.exists' => 'The selected property object is invalid.',
            'property_object_ids.array' => 'Property objects must be provided as a list.',
            'property_object_ids.*.exists' => 'One of the selected property objects is invalid.',
            'requester_email.email' => 'Please enter a valid requester email address.',
            'title.required' => 'Order title is required.',
            'service_type.required' => 'Please select a job type.',
            'service_type.in' => 'Please select a valid job type.',
            'status.in' => 'Please select a valid order status.',
            'due_date.date' => 'Please enter a valid due date.',
            'due_date.after_or_equal' => 'Please do not select a date in the past.',
            'bid_deadline_at.after_or_equal' => 'Please do not select a date in the past.',
            'bid_priority.in' => 'Please select a valid bid priority.',
            'attachment.max' => 'Attachment size must not exceed 10 MB.',
            'attachment.mimes' => 'Attachment must be a PDF or image file.',
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $propertyId = $this->integer('property_id');

            if (!$propertyId) {
                return;
            }

            $propertyHasObjects = Property::query()
                ->whereKey($propertyId)
                ->whereHas('objects')
                ->exists();

            if ($this->isDraftRequest()) {
                return;
            }

            $hasPropertyObjectIds = collect($this->input('property_object_ids', []))
                ->filter(fn ($value) => filled($value))
                ->isNotEmpty();

            if ($propertyHasObjects && !$this->filled('property_object_id') && !$hasPropertyObjectIds) {
                $validator->errors()->add('property_object_id', 'Please select a property object for this order.');
            }

            $today = now()->toDateString();
            $inspectionSlots = data_get($this->input('workflow_meta', []), 'inspection.preferred_slots', []);

            foreach ($inspectionSlots as $slot) {
                $date = data_get($slot, 'date');
                $time = data_get($slot, 'time');

                if ($date && $date < $today) {
                    $validator->errors()->add('workflow_meta.inspection.preferred_slots', 'Please do not select a date in the past.');
                    break;
                }

                // Today is allowed, but only at a time that has not passed yet.
                if ($date && $time && $date === $today) {
                    try {
                        $slotAt = Carbon::parse($date.' '.$time);
                    } catch (\Throwable) {
                        continue;
                    }

                    if ($slotAt->isPast()) {
                        $validator->errors()->add('workflow_meta.inspection.preferred_slots', 'Please do not select a time in the past.');
                        break;
                    }
                }
            }

            $workflowType = $this->input('workflow_type');
            $bidDeadlineAt = $this->input('bid_deadline_at');
            if ($workflowType === 'direct_order' && $bidDeadlineAt) {
                $deadlineDate = Carbon::parse($bidDeadlineAt);

                if ($deadlineDate->toDateString() <= now()->toDateString()) {
                    $validator->errors()->add('bid_deadline_at', 'Please select a bid deadline after today.');
                }

                if ($deadlineDate->isWeekend()) {
                    $validator->errors()->add('bid_deadline_at', 'Please do not select Saturday or Sunday as the bid deadline.');
                }
            }

            $invoiceRecipientType = data_get($this->input('workflow_meta', []), 'assignment.invoice_recipient.recipient_type');
            $invoiceDeliveryMethod = data_get($this->input('workflow_meta', []), 'assignment.invoice_recipient.delivery_method');

            if ($this->input('workflow_type') === 'direct_order' && $invoiceRecipientType === 'third_party') {
                if (! data_get($this->input('workflow_meta', []), 'assignment.invoice_recipient.first_name')) {
                    $validator->errors()->add('workflow_meta.assignment.invoice_recipient.first_name', 'Please enter the invoice recipient first name.');
                }

                if (! data_get($this->input('workflow_meta', []), 'assignment.invoice_recipient.last_name')) {
                    $validator->errors()->add('workflow_meta.assignment.invoice_recipient.last_name', 'Please enter the invoice recipient last name.');
                }

                if (! data_get($this->input('workflow_meta', []), 'assignment.invoice_recipient.address')) {
                    $validator->errors()->add('workflow_meta.assignment.invoice_recipient.address', 'Please enter the invoice recipient address.');
                }

                if (! data_get($this->input('workflow_meta', []), 'assignment.invoice_recipient.postal_code')) {
                    $validator->errors()->add('workflow_meta.assignment.invoice_recipient.postal_code', 'Please enter the invoice recipient ZIP code.');
                }

                if (! data_get($this->input('workflow_meta', []), 'assignment.invoice_recipient.city')) {
                    $validator->errors()->add('workflow_meta.assignment.invoice_recipient.city', 'Please enter the invoice recipient city.');
                }

                if (! in_array($invoiceDeliveryMethod, ['email', 'mail'], true)) {
                    $validator->errors()->add('workflow_meta.assignment.invoice_recipient.delivery_method', 'Please select whether the invoice should be sent by email or mail.');
                }

                if ($invoiceDeliveryMethod === 'email' && ! data_get($this->input('workflow_meta', []), 'assignment.invoice_recipient.email')) {
                    $validator->errors()->add('workflow_meta.assignment.invoice_recipient.email', 'Please enter the invoice email address.');
                }
            }
        });
    }
}
