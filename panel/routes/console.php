<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('vergo:database-backup', function (\App\Services\DatabaseBackupService $backupService) {
    $backup = $backupService->create();

    $this->info('Database backup created: '.$backup['name']);
})->purpose('Create a SQL backup of the Vergo database');

Schedule::command('vergo:database-backup')->dailyAt('02:00');

Artisan::command('vergo:process-ai-analysis {--limit=5}', function () {
    $limit = max(1, min((int) $this->option('limit'), 10));
    $queuedResults = \App\Models\AiAnalysisResult::query()
        ->whereNotNull('document_id')
        ->where('status', 'queued')
        ->oldest()
        ->limit($limit)
        ->get();

    foreach ($queuedResults as $result) {
        $job = new \App\Jobs\AnalyzeDocumentWithGemini((int) $result->document_id, $result->id);
        app()->call([$job, 'handle']);
    }

    $this->info('Processed queued AI analysis jobs: '.$queuedResults->count());
})->purpose('Process queued document AI analyses');

Schedule::command('vergo:process-ai-analysis --limit=5')->everyFiveMinutes()->withoutOverlapping();
