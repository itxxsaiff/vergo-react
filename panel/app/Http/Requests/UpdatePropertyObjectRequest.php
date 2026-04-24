<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdatePropertyObjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'property_id' => ['sometimes', 'required', 'integer', 'exists:properties,id'],
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'type' => ['sometimes', 'required', 'string', 'max:120', 'in:' . implode(',', config('vergo.property_object_types', []))],
            'reference' => ['nullable', 'string', 'max:120'],
            'location' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'in:active,inactive,archived'],
        ];
    }

    public function messages(): array
    {
        return [
            'property_id.required' => 'Please select a property.',
            'property_id.exists' => 'The selected property is invalid.',
            'name.required' => 'Object name is required.',
            'type.required' => 'Please select an object type.',
            'type.in' => 'Please select a valid object type.',
            'status.in' => 'Please select a valid object status.',
        ];
    }
}
