<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreDocumentRequest;
use App\Http\Resources\DocumentResource;
use App\Models\AiAnalysisResult;
use App\Models\Document;
use App\Models\Order;
use App\Models\Property;
use App\Models\PropertyObject;
use App\Models\PropertyManagerProfile;
use App\Models\ServiceProvider;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Storage;

class DocumentController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $actor = $request->user();

        $query = Document::query()
            ->with([
                'property:id,li_number,title',
                'propertyObject:id,property_id,name,address,postal_code,city',
                'order:id,title',
                'serviceProvider:id,company_name,contact_email',
                'analysisResults',
            ])
            ->latest();

        if ($actor instanceof PropertyManagerProfile) {
            $propertyIds = $actor->accessiblePropertyIds();
            $query->whereIn('property_id', $propertyIds ?: [0]);
        } elseif ($actor instanceof User && $actor->role?->name === 'owner') {
            $query->whereHas('property.owners', fn ($ownerQuery) => $ownerQuery->where('users.id', $actor->id));
        } elseif (! ($actor instanceof User && in_array($actor->role?->name, ['admin', 'employee'], true))) {
            abort(403);
        }

        return DocumentResource::collection($query->get());
    }

    public function store(StoreDocumentRequest $request): DocumentResource
    {
        $actor = $request->user();
        abort_unless(
            $actor instanceof PropertyManagerProfile || ($actor instanceof User && in_array($actor->role?->name, ['admin', 'owner', 'employee'], true)),
            403
        );

        $propertyId = $request->integer('property_id') ?: null;
        $propertyObjectId = $request->integer('property_object_id') ?: null;
        $propertyObjectIds = collect($request->input('property_object_ids', []))
            ->map(fn ($value) => (int) $value)
            ->filter()
            ->unique()
            ->values();
        $orderId = $request->integer('order_id') ?: null;
        $serviceProviderId = $request->integer('service_provider_id') ?: null;

        if ($orderId) {
            $order = Order::query()->findOrFail($orderId);
            $propertyId = $propertyId ?: $order->property_id;
        }

        if ($propertyObjectId) {
            $propertyObject = PropertyObject::query()->findOrFail($propertyObjectId);
            $propertyId = $propertyId ?: $propertyObject->property_id;
        }

        if ($propertyId) {
            $property = Property::query()->findOrFail($propertyId);

            if ($actor instanceof PropertyManagerProfile) {
                abort_unless($actor->canAccessProperty($property->id), 403);
            } elseif ($actor instanceof User && $actor->role?->name === 'owner') {
                abort_unless($property->owners()->where('users.id', $actor->id)->exists(), 403);
            }
        }

        if ($propertyObjectId) {
            abort_unless(
                PropertyObject::query()
                    ->whereKey($propertyObjectId)
                    ->where('property_id', $propertyId)
                    ->exists(),
                422,
                'The selected property object is invalid.'
            );
        }

        if ($propertyObjectIds->isNotEmpty()) {
            $matchingObjectCount = PropertyObject::query()
                ->whereIn('id', $propertyObjectIds)
                ->where('property_id', $propertyId)
                ->count();

            abort_unless($matchingObjectCount === $propertyObjectIds->count(), 422, 'One or more selected property objects are invalid.');
        }

        if ($serviceProviderId) {
            ServiceProvider::query()->findOrFail($serviceProviderId);
        }

        $file = $request->file('file');
        $storedPath = $file->store('vergo-documents');

        $document = Document::query()->create([
            'property_id' => $propertyId,
            'property_object_id' => $propertyObjectId,
            'property_object_ids' => $propertyObjectIds->values()->all(),
            'order_id' => $orderId,
            'service_provider_id' => $serviceProviderId,
            'uploaded_by' => $actor instanceof User ? $actor->id : null,
            'type' => $request->string('type')->toString(),
            'service_type' => $request->filled('service_type') ? $request->string('service_type')->toString() : null,
            'trade_object' => $request->filled('trade_object') ? $request->string('trade_object')->toString() : null,
            'trade_activity' => $request->filled('trade_activity') ? $request->string('trade_activity')->toString() : null,
            'title' => $request->string('title')->toString(),
            'file_name' => $file->getClientOriginalName(),
            'file_path' => $storedPath,
            'mime_type' => $file->getMimeType(),
            'size' => $file->getSize(),
            'status' => 'uploaded',
        ]);

        if ($document->type === 'invoice') {
            AiAnalysisResult::query()->create([
                'document_id' => $document->id,
                'order_id' => $document->order_id,
                'property_id' => $document->property_id,
                'status' => 'queued',
                'summary' => 'Rechnung wurde automatisch für die KI-Analyse vorgemerkt.',
                'comparison_data' => [
                    'analysis_type' => 'document_analysis',
                    'document_use_case' => 'historical_invoice_benchmark',
                    'queued_via' => 'invoice_upload',
                ],
            ]);
        }

        return new DocumentResource($document->load([
            'property:id,li_number,title',
            'propertyObject:id,property_id,name,address,postal_code,city',
            'order:id,title',
            'serviceProvider:id,company_name,contact_email',
            'analysisResults',
        ]));
    }

    public function destroy(Request $request, Document $document)
    {
        $this->authorizeDocumentAccess($request->user(), $document, true);

        Storage::delete($document->file_path);
        $document->delete();

        return response()->json([
            'message' => 'Document deleted successfully.',
        ]);
    }

    public function download(Request $request, Document $document)
    {
        $this->authorizeDocumentAccess($request->user(), $document, false);

        return Storage::download($document->file_path, $document->file_name);
    }

    private function authorizeDocumentAccess(mixed $actor, Document $document, bool $write): void
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
            abort_unless($actor->canAccessProperty($document->property_id), 403);
            return;
        }

        abort(403);
    }
}
