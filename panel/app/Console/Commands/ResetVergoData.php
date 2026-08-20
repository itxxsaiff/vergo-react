<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Wipes all operational data so the system can be demonstrated from a clean
 * slate. Roles and the nominated admin account survive; everything else goes.
 *
 * Destructive and irreversible - take a backup first
 * (php artisan vergo:database-backup).
 */
class ResetVergoData extends Command
{
    protected $signature = 'vergo:reset
                            {--keep-admin=admin@gmail.com : Email of the single account to preserve}
                            {--force : Required to actually delete anything}
                            {--allow-production : Additionally required outside the local environment}';

    protected $description = 'Delete all properties, orders, quotes, providers, managers and users except one admin.';

    /** Emptied completely. */
    private const WIPE_TABLES = [
        'bid_line_item_photos',
        'price_change_requests',
        'provider_reviews',
        'ai_analysis_results',
        'bids',
        'orders',
        'documents',
        'property_owner_assignments',
        'property_objects',
        'property_manager_domains',
        'properties',
        'property_manager_profiles',
        'service_providers',
        'company_addition_requests',
        'support_tickets',
        'manager_login_codes',
        'notifications',
        'personal_access_tokens',
        'password_reset_tokens',
        'sessions',
        'jobs',
        'failed_jobs',
        'job_batches',
        'cache',
        'cache_locks',
    ];

    public function handle(): int
    {
        $keepEmail = strtolower(trim((string) $this->option('keep-admin')));

        if (! $this->option('force')) {
            $this->error('This deletes ALL operational data. Re-run with --force if that is what you want.');
            $this->line('Take a backup first: php artisan vergo:database-backup');

            return self::FAILURE;
        }

        if (! app()->environment('local') && ! $this->option('allow-production')) {
            $this->error('Refusing to wipe a non-local environment. Pass --allow-production if you really mean it.');

            return self::FAILURE;
        }

        $admin = User::query()->whereRaw('LOWER(email) = ?', [$keepEmail])->first();

        if (! $admin) {
            $this->error("No user found with email '{$keepEmail}'. Aborting so you are not left without a login.");

            return self::FAILURE;
        }

        $this->warn('Wiping operational data, keeping only: '.$admin->email);

        DB::statement('SET FOREIGN_KEY_CHECKS=0');

        try {
            foreach (self::WIPE_TABLES as $table) {
                if (! Schema::hasTable($table)) {
                    continue;
                }

                $count = DB::table($table)->count();
                DB::table($table)->truncate();
                $this->line(sprintf('  %-32s %d row(s) removed', $table, $count));
            }

            $removedUsers = User::query()->where('id', '!=', $admin->id)->delete();
            $this->line(sprintf('  %-32s %d row(s) removed', 'users (except admin)', $removedUsers));
        } finally {
            DB::statement('SET FOREIGN_KEY_CHECKS=1');
        }

        $this->newLine();
        $this->info('Reset complete. Roles kept, '.$admin->email.' kept.');
        $this->line('Now create the demo scenario with: php artisan vergo:demo-data');

        return self::SUCCESS;
    }
}
