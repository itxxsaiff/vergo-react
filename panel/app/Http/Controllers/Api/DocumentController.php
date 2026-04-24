<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreDocumentRequest;
use App\Http\Resources\DocumentResource;
use App\Models\Document;
use App\Models\Order;
use App\Models\Property;
use App\Models\PropertyManagerProfile;
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
            ->with(['property:id,li_number,title', 'order:id,title', 'analysisResults'])
            ->latest();

        if ($actor instanceof PropertyManagerProfile) {
            $query->where('property_id', $actor->property_id);
        } elseif ($actor instanceof User && $actor->role?->name === 'owner') {
            $query->whereHas('property.owners', fn ($ownerQuery) => $ownerQuery->where('users.id', $actor->id));
        } elseif (! ($actor instanceof User && $actor->role?->name === 'admin')) {
            abort(403);
        }

        return DocumentResource::collection($query->get());
    }

    public function store(StoreDocumentRequest $request): DocumentResource
    {
        $actor = $request->user();
        abort_unless(
            $actor instanceof PropertyManagerProfile || ($actor instanceof User && in_array($actor->role?->name, ['admin', 'owner'], true)),
            403
        );

        $propertyId = $request->integer('property_id') ?: null;
        $orderId = $request->integer('order_id') ?: null;

        if ($orderId) {
            $order = Order::query()->findOrFail($orderId);
            $propertyId = $propertyId ?: $order->property_id;
        }

        if ($propertyId) {
            $property = Property::query()->findOrFail($propertyId);

            if ($actor instanceof PropertyManagerProfile) {
                abort_unless($actor->property_id === $property->id, 403);
            } elseif ($actor instanceof User && $actor->role?->name === 'owner') {
                abort_unless($property->owners()->where('users.id', $actor->id)->exists(), 403);
            }
        }

        $file = $request->file('file');
        $storedPath = $file->store('vergo-documents');

        $document = Document::query()->create([
            'property_id' => $propertyId,
            'order_id' => $orderId,
            'uploaded_by' => $actor instanceof User ? $actor->id : null,
            'type' => $request->string('type')->toString(),
            'title' => $request->string('title')->toString(),
            'file_name' => $file->getClientOriginalName(),
            'file_path' => $storedPath,
            'mime_type' => $file->getMimeType(),
            'size' => $file->getSize(),
            'status' => 'uploaded',
        ]);

        return new DocumentResource($document->load(['property:id,li_number,title', 'order:id,title', 'analysisResults']));
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
        if ($actor instanceof User && $actor->role?->name === 'admin') {
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
