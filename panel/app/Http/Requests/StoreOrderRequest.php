<?php

namespace App\Http\Requests;

use App\Models\PropertyManagerProfile;
use App\Models\Property;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        $actor = $this->user();

        return $actor instanceof PropertyManagerProfile;
    }

    public function rules(): array
    {
        return [
            'property_id' => ['required', 'integer', 'exists:properties,id'],
            'property_object_id' => ['nullable', 'integer', 'exists:property_objects,id'],
            'property_object_ids' => ['nullable', 'array'],
            'property_object_ids.*' => ['integer', 'exists:property_objects,id'],
            'requester_name' => ['nullable', 'string', 'max:255'],
            'requester_email' => ['nullable', 'email', 'max:255'],
            'title' => ['required', 'string', 'max:255'],
            'service_type' => ['required', 'string', 'max:255', 'in:' . implode(',', config('vergo.job_types', []))],
            'description' => ['nullable', 'string'],
            'status' => ['nullable', Rule::in(['draft', 'open', 'in_review', 'awaiting_owner_approval', 'approved', 'completed', 'closed'])],
            'workflow_type' => ['nullable', Rule::in(['inspection', 'direct_order'])],
            'workflow_status' => ['nullable', 'string', 'max:40'],
            'bid_priority' => ['nullable', Rule::in(['lowest_price', 'fastest_turnaround', 'high_quality_materials'])],
            'due_date' => ['nullable', 'date'],
            'bid_deadline_at' => ['nullable', 'date'],
            'workflow_meta' => ['nullable', 'array'],
            'quote_items' => ['nullable', 'array'],
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
            'bid_priority.in' => 'Please select a valid bid priority.',
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

            $hasPropertyObjectIds = collect($this->input('property_object_ids', []))
                ->filter(fn ($value) => filled($value))
                ->isNotEmpty();

            if ($propertyHasObjects && !$this->filled('property_object_id') && !$hasPropertyObjectIds) {
                $validator->errors()->add('property_object_id', 'Please select a property object for this order.');
            }
        });
    }
}
