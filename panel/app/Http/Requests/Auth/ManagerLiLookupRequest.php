<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class ManagerLiLookupRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'li_number' => ['required', 'string', 'exists:properties,li_number'],
        ];
    }

    public function messages(): array
    {
        return [
            'li_number.required' => 'Bitte geben Sie die LI-Nummer ein.',
            'li_number.exists' => 'Die LI-Nummer ist falsch.',
        ];
    }
}
