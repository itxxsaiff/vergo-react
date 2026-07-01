<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdatePropertyManagerProfileRequest extends FormRequest
{
    private const SWISS_CANTONS = [
        'AG', 'AI', 'AR', 'BE', 'BL', 'BS', 'FR', 'GE', 'GL', 'GR', 'JU', 'LU', 'NE',
        'NW', 'OW', 'SG', 'SH', 'SO', 'SZ', 'TG', 'TI', 'UR', 'VD', 'VS', 'ZG', 'ZH',
    ];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'property_id' => ['nullable', 'exists:properties,id'],
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'phone' => ['required', 'string', 'max:50'],
            'address' => ['required', 'string', 'max:255'],
            'postal_code' => ['required', 'string', 'max:50'],
            'city' => ['required', 'string', 'max:255'],
            'canton' => ['required', 'string', Rule::in(self::SWISS_CANTONS)],
            'domain_suffix' => ['required', 'string', 'max:255'],
        ];
    }
}
