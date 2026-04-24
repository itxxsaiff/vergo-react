<?php

namespace App\Jobs;

use App\Models\AiAnalysisResult;
use App\Models\Document;
use App\Services\GeminiDocumentAnalysisService;
use App\Services\NotificationService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class AnalyzeDocumentWithGemini implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly int $documentId,
        public readonly int $analysisResultId,
    ) {
        $this->onQueue('ai-analysis');
    }

    public function handle(GeminiDocumentAnalysisService $gemini, NotificationService $notificationService): void
    {
        $document = Document::query()
            ->with(['property:id,li_number,title', 'order:id,title'])
            ->findOrFail($this->documentId);

        $result = AiAnalysisResult::query()->findOrFail($this->analysisResultId);

        $result->update([
            'status' => 'processing',
        ]);

        try {
            $analysis = $gemini->analyze($document);

            $result->update([
                'status' => 'analyzed',
                'score' => $analysis['score'],
                'summary' => $analysis['summary'],
                'comparison_data' => $analysis['comparison_data'],
            ]);

            $document->update([
                'status' => 'analyzed',
            ]);

            $notificationService->sendDocumentAnalysisFinished($document, 'analyzed');
        } catch (\Throwable $throwable) {
            $result->update([
                'status' => 'failed',
                'summary' => $throwable->getMessage(),
                'comparison_data' => [
                    'error' => $throwable->getMessage(),
                ],
            ]);

            $document->update([
                'status' => 'failed',
            ]);

            $notificationService->sendDocumentAnalysisFinished($document, 'failed');
        }
    }
}
