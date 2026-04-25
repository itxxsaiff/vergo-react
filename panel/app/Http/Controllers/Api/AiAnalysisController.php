<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\AiAnalysisResultResource;
use App\Models\AiAnalysisResult;
use App\Models\Document;
use App\Models\PropertyManagerProfile;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class AiAnalysisController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $actor = $request->user();

        $query = AiAnalysisResult::query()
            ->whereNotNull('document_id')
            ->with([
                'document.property:id,li_number,title',
                'document.order:id,title',
            ])
            ->latest();

        if ($actor instanceof PropertyManagerProfile) {
            $query->whereHas('document', fn ($documentQuery) => $documentQuery->where('property_id', $actor->property_id));
        } elseif ($actor instanceof User && $actor->role?->name === 'owner') {
            $query->whereHas('document.property.owners', fn ($ownerQuery) => $ownerQuery->where('users.id', $actor->id));
        } elseif (! ($actor instanceof User && in_array($actor->role?->name, ['admin', 'employee'], true))) {
            abort(403);
        }

        return AiAnalysisResultResource::collection($query->get());
    }

    public function analyzeDocument(Request $request, Document $document): AiAnalysisResultResource
    {
        $this->authorizeDocumentAnalysis($request->user(), $document);

        $document->loadMissing(['property:id,li_number,title', 'order:id,title']);
        $document->update(['status' => 'processing']);

        $result = AiAnalysisResult::query()->create([
            'document_id' => $document->id,
            'order_id' => $document->order_id,
            'property_id' => $document->property_id,
            'status' => 'queued',
            'summary' => 'Document queued for Gemini analysis.',
            'comparison_data' => [
                'analysis_type' => 'document_analysis',
                'queued_via' => 'background_job',
            ],
        ]);

        return new AiAnalysisResultResource($result->load([
            'document.property:id,li_number,title',
            'document.order:id,title',
        ]));
    }

    private function authorizeDocumentAnalysis(mixed $actor, Document $document): void
    {
        if ($actor instanceof User && in_array($actor->role?->name, ['admin', 'employee'], true)) {
            return;
        }

        if ($actor instanceof User && $actor->role?->name === 'owner') {
            abort_unless(
                $document->property && $document->property->owners()->where('users.id', $actor->id)->exists(),
                403
            );
            return;
        }

        if ($actor instanceof PropertyManagerProfile) {
            abort_unless($document->property_id === $actor->property_id, 403);
            return;
        }

        abort(403);
    }
}
