<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreOwnerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'owner_type' => ['required', Rule::in(['company', 'private_individual'])],
            'company_name' => ['required_if:owner_type,company', 'nullable', 'string', 'max:255'],
            'first_name' => ['required_if:owner_type,private_individual', 'nullable', 'string', 'max:255'],
            'last_name' => ['required_if:owner_type,private_individual', 'nullable', 'string', 'max:255'],
            'address' => ['required', 'string', 'max:255'],
            'postal_code' => ['required', 'string', 'max:30'],
            'city' => ['required', 'string', 'max:120'],
            'domain_suffix' => ['required_if:owner_type,company', 'nullable', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email', 'unique:users,login_email'],
            'phone' => ['required_if:owner_type,private_individual', 'nullable', 'string', 'max:50'],
            'status' => ['nullable', 'in:active,inactive'],
        ];
    }

    public function messages(): array
    {
        return [
            'owner_type.required' => 'Please select whether the owner is a company or a private individual.',
            'company_name.required_if' => 'Company name is required.',
            'first_name.required_if' => 'First name is required.',
            'last_name.required_if' => 'Last name is required.',
            'address.required' => 'Address is required.',
            'postal_code.required' => 'Postal code is required.',
            'city.required' => 'City is required.',
            'domain_suffix.required_if' => 'Domain suffix is required for company owners.',
            'email.required' => 'Email is required.',
            'email.email' => 'Please enter a valid owner email address.',
            'email.unique' => 'This owner email is already in use.',
            'phone.required_if' => 'Phone number is required for private individuals.',
            'status.in' => 'Please select a valid owner status.',
        ];
    }
}
