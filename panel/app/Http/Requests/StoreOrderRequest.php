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
            'requester_name' => ['nullable', 'string', 'max:255'],
            'requester_email' => ['nullable', 'email', 'max:255'],
            'title' => ['required', 'string', 'max:255'],
            'service_type' => ['required', 'string', 'max:255', 'in:' . implode(',', config('vergo.job_types', []))],
            'description' => ['nullable', 'string'],
            'status' => ['nullable', Rule::in(['draft', 'open', 'in_review', 'awaiting_owner_approval', 'approved', 'completed', 'closed'])],
            'due_date' => ['nullable', 'date'],
            'requested_at' => ['nullable', 'date'],
        ];
    }

    public function messages(): array
    {
        return [
            'property_id.required' => 'Please select a property.',
            'property_id.exists' => 'The selected property is invalid.',
            'property_object_id.exists' => 'The selected property object is invalid.',
            'requester_email.email' => 'Please enter a valid requester email address.',
            'title.required' => 'Order title is required.',
            'service_type.required' => 'Please select a job type.',
            'service_type.in' => 'Please select a valid job type.',
            'status.in' => 'Please select a valid order status.',
            'due_date.date' => 'Please enter a valid due date.',
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

            if ($propertyHasObjects && !$this->filled('property_object_id')) {
                $validator->errors()->add('property_object_id', 'Please select a property object for this order.');
            }
        });
    }
}
