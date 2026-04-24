<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class StoreOwnerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', Password::min(8)],
            'phone' => ['nullable', 'string', 'max:50'],
            'status' => ['nullable', 'in:active,inactive'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Owner name is required.',
            'email.required' => 'Owner email is required.',
            'email.email' => 'Please enter a valid owner email address.',
            'email.unique' => 'This owner email is already in use.',
            'password.required' => 'Password is required for a new owner.',
            'status.in' => 'Please select a valid owner status.',
        ];
    }
}
