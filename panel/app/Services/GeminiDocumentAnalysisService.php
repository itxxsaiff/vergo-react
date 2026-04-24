<?php

namespace App\Services;

use App\Models\Document;
use Illuminate\Http\Client\Factory as HttpFactory;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class GeminiDocumentAnalysisService
{
    public function __construct(
        private readonly HttpFactory $http,
    ) {
    }

    public function analyze(Document $document): array
    {
        $apiKey = config('services.gemini.api_key');

        if (! $apiKey) {
            throw new RuntimeException('Gemini API key is not configured.');
        }

        $filePath = Storage::path($document->file_path);

        if (! is_file($filePath)) {
            throw new RuntimeException('Document file could not be found for analysis.');
        }

        $fileContent = file_get_contents($filePath);

        if ($fileContent === false) {
            throw new RuntimeException('Document file could not be read for analysis.');
        }

        $uploadStartResponse = $this->http
            ->withHeaders([
                'x-goog-api-key' => $apiKey,
                'X-Goog-Upload-Protocol' => 'resumable',
                'X-Goog-Upload-Command' => 'start',
                'X-Goog-Upload-Header-Content-Length' => (string) filesize($filePath),
                'X-Goog-Upload-Header-Content-Type' => $document->mime_type ?: 'application/octet-stream',
                'Content-Type' => 'application/json',
            ])
            ->post('https://generativelanguage.googleapis.com/upload/v1beta/files', [
                'file' => [
                    'display_name' => $document->title,
                ],
            ]);

        $uploadStartResponse->throw();

        $uploadUrl = $uploadStartResponse->header('x-goog-upload-url');

        if (! $uploadUrl) {
            throw new RuntimeException('Gemini file upload URL was not returned.');
        }

        $uploadFinalizeResponse = $this->http
            ->withHeaders([
                'Content-Length' => (string) strlen($fileContent),
                'X-Goog-Upload-Offset' => '0',
                'X-Goog-Upload-Command' => 'upload, finalize',
            ])
            ->withBody($fileContent, $document->mime_type ?: 'application/octet-stream')
            ->post($uploadUrl);

        $uploadFinalizeResponse->throw();

        $fileUri = data_get($uploadFinalizeResponse->json(), 'file.uri');

        if (! $fileUri) {
            throw new RuntimeException('Gemini file URI was not returned.');
        }

        $response = $this->http
            ->withHeaders([
                'x-goog-api-key' => $apiKey,
                'Content-Type' => 'application/json',
            ])
            ->post('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', [
                'contents' => [[
                    'role' => 'user',
                    'parts' => [
                        ['text' => $this->buildPrompt($document)],
                        [
                            'file_data' => [
                                'mime_type' => $document->mime_type ?: 'application/octet-stream',
                                'file_uri' => $fileUri,
                            ],
                        ],
                    ],
                ]],
                'generationConfig' => [
                    'responseMimeType' => 'application/json',
                    'responseSchema' => [
                        'type' => 'OBJECT',
                        'properties' => [
                            'summary' => ['type' => 'STRING'],
                            'document_type' => ['type' => 'STRING'],
                            'service_category' => ['type' => 'STRING'],
                            'service_interval' => ['type' => 'STRING'],
                            'property_size' => ['type' => 'STRING'],
                            'benchmark_hint' => ['type' => 'STRING'],
                            'location' => ['type' => 'STRING'],
                            'invoice_date' => ['type' => 'STRING'],
                            'pricing_signal' => [
                                'type' => 'STRING',
                                'enum' => ['too_low', 'fair', 'too_high', 'unknown'],
                            ],
                            'confidence_score' => ['type' => 'NUMBER'],
                            'estimated_amount' => ['type' => 'NUMBER'],
                            'unit_price' => ['type' => 'NUMBER'],
                            'price_unit' => ['type' => 'STRING'],
                            'currency' => ['type' => 'STRING'],
                            'key_points' => [
                                'type' => 'ARRAY',
                                'items' => ['type' => 'STRING'],
                            ],
                            'entities' => [
                                'type' => 'OBJECT',
                                'properties' => [
                                    'vendor_name' => ['type' => 'STRING'],
                                    'property_reference' => ['type' => 'STRING'],
                                    'contract_start_date' => ['type' => 'STRING'],
                                    'contract_end_date' => ['type' => 'STRING'],
                                ],
                            ],
                        ],
                        'required' => ['summary', 'document_type', 'pricing_signal', 'confidence_score', 'key_points'],
                    ],
                ],
            ]);

        $response->throw();

        $analysisText = data_get($response->json(), 'candidates.0.content.parts.0.text');

        if (! is_string($analysisText) || trim($analysisText) === '') {
            throw new RuntimeException('Gemini returned an empty analysis response.');
        }

        $analysisData = json_decode($analysisText, true);

        if (! is_array($analysisData)) {
            throw new RuntimeException('Gemini returned invalid JSON analysis data.');
        }

        return [
            'summary' => $analysisData['summary'] ?? 'Document analyzed successfully.',
            'score' => isset($analysisData['confidence_score']) ? round((float) $analysisData['confidence_score'], 2) : null,
            'comparison_data' => [
                'analysis_type' => 'document_analysis',
                'document_use_case' => $this->getDocumentUseCase($document),
                ...$analysisData,
            ],
        ];
    }

    private function buildPrompt(Document $document): string
    {
        $propertyContext = $document->property
            ? sprintf(
                'Property: %s - %s%s',
                $document->property->li_number,
                $document->property->title,
                $document->property->size ? sprintf(' (%s m²)', $document->property->size) : ''
            )
            : 'Property: not linked';

        $orderContext = $document->order
            ? sprintf('Order: %s', $document->order->title)
            : 'Order: not linked';

        $documentTask = $this->buildDocumentTask($document);

        return <<<PROMPT
You are Vergo's document analysis engine for real-estate and facility-management workflows.

Review the attached document and return structured JSON only.

Context:
- {$propertyContext}
- {$orderContext}
- Document title: {$document->title}
- Document type hint: {$document->type}

Tasks:
1. Summarize the document in business language.
2. Identify whether pricing appears too low, fair, too high, or unknown.
3. Estimate a confidence score from 0 to 100.
4. Extract useful entities like vendor name, property reference, and contract dates if present.
5. Identify service category, service interval, and any property size stated in the document.
6. Return a benchmark hint describing what this document is useful for inside Vergo.
7. List key commercial points relevant to comparison, pricing, scope, deadlines, or obligations.

Use-case specific focus:
{$documentTask}

Do not include markdown. Return JSON only.
PROMPT;
    }

    private function buildDocumentTask(Document $document): string
    {
        return match ($document->type) {
            'fm_contract' => 'Treat this as a facility management contract for owner benchmarking. Focus on recurring services, intervals, property size, and whether the owner may be overpaying.',
            'invoice' => 'Treat this as a historical invoice. Focus on work type, completed scope, unit pricing, prior contractor history, and benchmark value for future one-time jobs.',
            'proposal' => 'Treat this as a provider proposal. Focus on scope completeness, commercial terms, timing, and how useful it is for later bid comparison.',
            default => 'Treat this as a general property document and extract pricing, scope, dates, and benchmarking signals if present.',
        };
    }

    private function getDocumentUseCase(Document $document): string
    {
        return match ($document->type) {
            'fm_contract' => 'owner_contract_benchmark',
            'invoice' => 'historical_invoice_benchmark',
            'proposal' => 'proposal_supporting_document',
            default => 'general_document_analysis',
        };
    }
}
