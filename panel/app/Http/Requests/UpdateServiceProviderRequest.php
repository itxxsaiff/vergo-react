<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateServiceProviderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $providerId = $this->route('serviceProvider')->id;
        $linkedUserId = $this->route('serviceProvider')->user_id;

        return [
            'company_name' => ['sometimes', 'required', 'string', 'max:255'],
            'contact_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'contact_email' => ['sometimes', 'required', 'email', 'max:255', Rule::unique('service_providers', 'contact_email')->ignore($providerId), Rule::unique('users', 'email')->ignore($linkedUserId)],
            'order_email' => ['sometimes', 'required', 'email', 'max:255', Rule::unique('service_providers', 'order_email')->ignore($providerId), Rule::unique('users', 'email')->ignore($linkedUserId)],
            'address' => ['sometimes', 'required', 'string', 'max:255'],
            'postal_code' => ['sometimes', 'required', 'string', 'max:50'],
            'city' => ['sometimes', 'required', 'string', 'max:255'],
            'domain_suffix' => ['sometimes', 'required', 'string', 'max:255'],
            'trade_groups' => ['sometimes', 'required', 'array', 'min:1'],
            'trade_groups.*' => ['required', 'string', 'max:255'],
            'phone' => ['sometimes', 'required', 'string', 'max:50'],
            'status' => ['sometimes', 'nullable', Rule::in(['active', 'inactive', 'pending'])],
        ];
    }

    public function messages(): array
    {
        return [
            'company_name.required' => 'Company name is required.',
            'contact_email.required' => 'Contact email is required.',
            'contact_email.email' => 'Please enter a valid contact email address.',
            'contact_email.unique' => 'This contact email is already in use.',
            'order_email.required' => 'Order email is required.',
            'order_email.email' => 'Please enter a valid order email address.',
            'order_email.unique' => 'This order email is already in use.',
            'address.required' => 'Address is required.',
            'postal_code.required' => 'Postal code is required.',
            'city.required' => 'City is required.',
            'domain_suffix.required' => 'Domain suffix is required.',
            'trade_groups.required' => 'Please select at least one trade group.',
            'phone.required' => 'Phone number is required.',
            'status.in' => 'Please select a valid provider status.',
        ];
    }
}
