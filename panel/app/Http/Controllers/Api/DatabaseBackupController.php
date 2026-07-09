<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\DatabaseBackupService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class DatabaseBackupController extends Controller
{
    public function index(Request $request, DatabaseBackupService $backupService): JsonResponse
    {
        $this->authorizeAdmin($request);

        return response()->json([
            'data' => $backupService->list(),
        ]);
    }

    public function store(Request $request, DatabaseBackupService $backupService): JsonResponse
    {
        $this->authorizeAdmin($request);

        return response()->json([
            'message' => 'Database backup created successfully.',
            'data' => $backupService->create(),
        ], 201);
    }

    public function upload(Request $request, DatabaseBackupService $backupService): JsonResponse
    {
        $this->authorizeAdmin($request);

        $validated = $request->validate([
            'backup' => ['required', 'file', 'mimes:sql,txt', 'max:51200'],
        ]);

        return response()->json([
            'message' => 'Database backup uploaded successfully.',
            'data' => $backupService->storeUploadedBackup($validated['backup']),
        ], 201);
    }

    public function download(Request $request, string $fileName, DatabaseBackupService $backupService)
    {
        $this->authorizeAdmin($request);

        $path = $backupService->resolveBackupPath($fileName);

        return Storage::download($path, basename($path), [
            'Content-Type' => 'application/sql',
        ]);
    }

    public function restore(Request $request, string $fileName, DatabaseBackupService $backupService): JsonResponse
    {
        $this->authorizeAdmin($request);

        $backupService->restore($fileName);

        return response()->json([
            'message' => 'Database backup restored successfully.',
        ]);
    }

    public function destroy(Request $request, string $fileName, DatabaseBackupService $backupService): JsonResponse
    {
        $this->authorizeAdmin($request);

        $backupService->delete($fileName);

        return response()->json([
            'message' => 'Database backup deleted successfully.',
        ]);
    }

    private function authorizeAdmin(Request $request): void
    {
        $actor = $request->user();

        abort_unless($actor instanceof User && $actor->role?->name === 'admin', 403);
    }
}
