<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bids', function (Blueprint $table) {
            if (! Schema::hasColumn('bids', 'assigned_provider_email')) {
                $table->string('assigned_provider_email')->nullable()->after('service_provider_id');
            }

            if (! Schema::hasColumn('bids', 'draft_payload')) {
                $table->json('draft_payload')->nullable()->after('workflow_meta');
            }

            if (! Schema::hasColumn('bids', 'draft_saved_at')) {
                $table->timestamp('draft_saved_at')->nullable()->after('draft_payload');
            }
        });
    }

    public function down(): void
    {
        $existingColumns = array_filter(
            ['assigned_provider_email', 'draft_payload', 'draft_saved_at'],
            fn (string $column): bool => Schema::hasColumn('bids', $column),
        );

        if ($existingColumns !== []) {
            Schema::table('bids', function (Blueprint $table) use ($existingColumns) {
                $table->dropColumn($existingColumns);
            });
        }
    }
};
