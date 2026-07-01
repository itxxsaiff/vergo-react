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
            'property_object_id' => ['nullable', 'integer', 'exists:property_objects,id'],
            'property_object_ids' => ['nullable', 'array'],
            'property_object_ids.*' => ['integer', 'exists:property_objects,id'],
            'order_id' => ['nullable', 'integer', 'exists:orders,id'],
            'service_provider_id' => ['nullable', 'integer', 'exists:service_providers,id'],
            'type' => ['required', Rule::in(['fm_contract', 'contract', 'invoice', 'facility', 'proposal', 'other'])],
            'service_type' => ['nullable', 'string', 'max:120'],
            'trade_object' => ['nullable', 'string', 'max:255'],
            'trade_activity' => ['nullable', 'string', 'max:255'],
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
