<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdatePropertyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $propertyId = $this->route('property')->id;

        return [
            'li_number' => ['sometimes', 'required', 'string', 'max:20', 'regex:/^Li-\d{5}$/', Rule::unique('properties', 'li_number')->ignore($propertyId)],
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'management' => ['sometimes', 'nullable', 'string', 'max:255'],
            'size' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'address_line_1' => ['sometimes', 'nullable', 'string', 'max:255'],
            'address_line_2' => ['sometimes', 'nullable', 'string', 'max:255'],
            'city' => ['sometimes', 'nullable', 'string', 'max:120'],
            'state' => ['sometimes', 'nullable', 'string', 'max:120'],
            'country' => ['sometimes', 'nullable', 'string', 'max:120'],
            'postal_code' => ['sometimes', 'nullable', 'string', 'max:30'],
            'usage' => ['sometimes', 'nullable', Rule::in(config('vergo.property_usage_types', []))],
            'lot_area' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'description' => ['sometimes', 'nullable', 'string'],
            'status' => ['sometimes', 'nullable', Rule::in(['draft', 'active', 'archived'])],
            'created_by' => ['sometimes', 'nullable', 'exists:users,id'],
            'owner_id' => ['sometimes', 'nullable', 'exists:users,id'],
            'manager_domains' => ['sometimes', 'nullable', 'array'],
            'manager_domains.*' => ['string', 'max:255'],
        ];
    }

    public function messages(): array
    {
        return [
            'title.required' => 'Property title is required.',
            'size.numeric' => 'Property size must be a valid number.',
            'size.min' => 'Property size cannot be negative.',
            'usage.in' => 'Please select a valid usage type.',
            'lot_area.numeric' => 'Lot area must be a valid number.',
            'lot_area.min' => 'Lot area cannot be negative.',
            'status.in' => 'Please select a valid property status.',
            'owner_id.exists' => 'The selected owner is invalid.',
            'manager_domains.array' => 'Allowed manager domains must be a valid list.',
        ];
    }
}
