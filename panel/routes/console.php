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
