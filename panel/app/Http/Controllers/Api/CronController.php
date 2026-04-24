<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\AnalyzeDocumentWithGemini;
use App\Models\AiAnalysisResult;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CronController extends Controller
{
    public function runAiAnalysis(Request $request): JsonResponse
    {
        $limit = max(1, min((int) $request->integer('limit', 1), 10));

        $queuedResults = AiAnalysisResult::query()
            ->whereNotNull('document_id')
            ->where('status', 'queued')
            ->oldest()
            ->limit($limit)
            ->get();

        $processedIds = [];

        foreach ($queuedResults as $result) {
            $job = new AnalyzeDocumentWithGemini((int) $result->document_id, $result->id);
            app()->call([$job, 'handle']);
            $processedIds[] = $result->id;
        }

        return response()->json([
            'message' => $processedIds
                ? 'Queued AI analysis jobs processed successfully.'
                : 'No queued AI analysis jobs found.',
            'processed_count' => count($processedIds),
            'processed_ids' => $processedIds,
        ]);
    }
}
