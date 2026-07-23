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
            'meta' => [
                'automatic_schedule' => '02:00',
                'restore_mode' => 'download_only',
                'note' => 'Backups are created automatically. Full database restore is disabled in the admin UI to protect newer data.',
            ],
        ]);
    }

    public function store(Request $request, DatabaseBackupService $backupService): JsonResponse
    {
        $this->authorizeAdmin($request);

        abort(422, 'Manual backup creation is disabled. Backups are created automatically by the scheduler at 02:00.');
    }

    public function upload(Request $request, DatabaseBackupService $backupService): JsonResponse
    {
        $this->authorizeAdmin($request);

        abort(422, 'Backup upload and full restore are disabled here. Use selective recovery so newer data is not overwritten.');
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

        abort(422, 'Full database restore is disabled here. Use selective recovery so newer data is not overwritten.');
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
