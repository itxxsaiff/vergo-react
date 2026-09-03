<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bids', function (Blueprint $table) {
            // The provider confirmed an inspection appointment but did not turn
            // up. Recorded by the manager and counted against the VERGO ranking.
            if (! Schema::hasColumn('bids', 'no_show_at')) {
                $table->timestamp('no_show_at')->nullable()->after('rejection_reason');
            }
            if (! Schema::hasColumn('bids', 'no_show_reported_by_type')) {
                $table->string('no_show_reported_by_type', 32)->nullable()->after('no_show_at');
            }
            if (! Schema::hasColumn('bids', 'no_show_reported_by_id')) {
                $table->unsignedBigInteger('no_show_reported_by_id')->nullable()->after('no_show_reported_by_type');
            }
        });
    }

    public function down(): void
    {
        Schema::table('bids', function (Blueprint $table) {
            $columns = array_filter(
                ['no_show_at', 'no_show_reported_by_type', 'no_show_reported_by_id'],
                fn (string $c): bool => Schema::hasColumn('bids', $c),
            );

            if ($columns !== []) {
                $table->dropColumn($columns);
            }
        });
    }
};
