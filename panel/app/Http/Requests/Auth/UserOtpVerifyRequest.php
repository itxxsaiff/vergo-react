<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class UserOtpVerifyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'email' => ['required', 'email'],
            'li_number' => ['nullable', 'string', 'max:20'],
            'code' => ['required', 'string', 'size:6'],
        ];
    }
}
