<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreDocumentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'property_id' => ['nullable', 'integer', 'exists:properties,id'],
            'order_id' => ['nullable', 'integer', 'exists:orders,id'],
            'type' => ['required', Rule::in(['fm_contract', 'contract', 'invoice', 'facility', 'proposal', 'other'])],
            'title' => ['required', 'string', 'max:255'],
            'file' => ['required', 'file', 'max:15360'],
        ];
    }

    public function messages(): array
    {
        return [
            'type.required' => 'Document type is required.',
            'title.required' => 'Document title is required.',
            'file.required' => 'Please select a document file.',
            'property_id.exists' => 'The selected property is invalid.',
            'order_id.exists' => 'The selected order is invalid.',
        ];
    }
}
