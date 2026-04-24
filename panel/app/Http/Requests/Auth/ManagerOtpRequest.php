<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class ManagerOtpRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'li_number' => ['required', 'string', 'exists:properties,li_number'],
            'email' => ['required', 'email'],
        ];
    }
}
