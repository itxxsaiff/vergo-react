<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            // The provider marks the job finished; the owner/manager rating
            // cycle is driven from that moment.
            if (! Schema::hasColumn('orders', 'provider_completed_at')) {
                $table->timestamp('provider_completed_at')->nullable()->after('completed_at');
            }
            if (! Schema::hasColumn('orders', 'review_token')) {
                $table->string('review_token', 64)->nullable()->unique()->after('provider_completed_at');
            }
            if (! Schema::hasColumn('orders', 'review_requested_at')) {
                $table->timestamp('review_requested_at')->nullable()->after('review_token');
            }
            if (! Schema::hasColumn('orders', 'review_last_reminded_at')) {
                $table->timestamp('review_last_reminded_at')->nullable()->after('review_requested_at');
            }
            if (! Schema::hasColumn('orders', 'review_reminder_count')) {
                $table->unsignedSmallInteger('review_reminder_count')->default(0)->after('review_last_reminded_at');
            }
            if (! Schema::hasColumn('orders', 'reviewed_at')) {
                $table->timestamp('reviewed_at')->nullable()->after('review_reminder_count');
            }
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (Schema::hasColumn('orders', 'review_token')) {
                $table->dropUnique('orders_review_token_unique');
            }

            $columns = array_filter([
                'provider_completed_at', 'review_token', 'review_requested_at',
                'review_last_reminded_at', 'review_reminder_count', 'reviewed_at',
            ], fn (string $c): bool => Schema::hasColumn('orders', $c));

            if ($columns !== []) {
                $table->dropColumn($columns);
            }
        });
    }
};
