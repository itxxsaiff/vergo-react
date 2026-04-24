<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\AiAnalysisResultResource;
use App\Models\AiAnalysisResult;
use App\Models\PropertyManagerProfile;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class BackgroundJobController extends Controller
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
        } elseif (! ($actor instanceof User && $actor->role?->name === 'admin')) {
            abort(403);
        }

        return AiAnalysisResultResource::collection($query->get());
    }
}
