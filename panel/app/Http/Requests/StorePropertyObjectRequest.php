<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StorePropertyObjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'property_id' => ['required', 'integer', 'exists:properties,id'],
            'name' => ['nullable', 'string', 'max:255'],
            'address' => ['required', 'string', 'max:255'],
            'postal_code' => ['nullable', 'string', 'max:30'],
            'city' => ['nullable', 'string', 'max:120'],
            'type' => ['required', 'string', 'max:120', 'in:' . implode(',', config('vergo.property_usage_types', []))],
            'reference' => ['nullable', 'string', 'max:120'],
            'location' => ['nullable', 'string', 'max:255'],
            'floors' => ['nullable', 'integer', 'min:0'],
            'apartment_count' => ['nullable', 'integer', 'min:0'],
            'commercial_area' => ['nullable', 'numeric', 'min:0'],
            'status' => ['nullable', 'in:active,inactive,archived'],
        ];
    }

    public function messages(): array
    {
        return [
            'property_id.required' => 'Please select a property.',
            'property_id.exists' => 'The selected property is invalid.',
            'address.required' => 'Address is required.',
            'type.required' => 'Please select an object type.',
            'type.in' => 'Please select a valid object type.',
            'status.in' => 'Please select a valid object status.',
        ];
    }
}
