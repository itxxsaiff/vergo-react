<?php

namespace App\Http\Requests;

use App\Services\LiNumberService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePropertyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (! $this->filled('li_number')) {
            $this->merge([
                'li_number' => app(LiNumberService::class)->generate(),
            ]);
        }
    }

    public function rules(): array
    {
        return [
            'li_number' => ['required', 'string', 'max:20', 'regex:/^Li-\d{5}$/', 'unique:properties,li_number'],
            'title' => ['required', 'string', 'max:255'],
            'management' => ['nullable', 'string', 'max:255'],
            'size' => ['nullable', 'numeric', 'min:0'],
            'address_line_1' => ['nullable', 'string', 'max:255'],
            'address_line_2' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:120'],
            'state' => ['nullable', 'string', 'max:120'],
            'country' => ['nullable', 'string', 'max:120'],
            'postal_code' => ['nullable', 'string', 'max:30'],
            'usage' => ['nullable', Rule::in(config('vergo.property_usage_types', []))],
            'lot_area' => ['nullable', 'numeric', 'min:0'],
            'description' => ['nullable', 'string'],
            'status' => ['nullable', Rule::in(['draft', 'active', 'archived'])],
            'created_by' => ['nullable', 'exists:users,id'],
            'owner_id' => ['nullable', 'exists:users,id'],
            'manager_domains' => ['nullable', 'array'],
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
