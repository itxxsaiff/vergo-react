<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (! Schema::hasColumn('orders', 'workflow_type')) {
                $table->string('workflow_type', 40)->nullable()->after('status');
            }

            if (! Schema::hasColumn('orders', 'workflow_status')) {
                $table->string('workflow_status', 40)->nullable()->after('workflow_type');
            }

            if (! Schema::hasColumn('orders', 'bid_priority')) {
                $table->string('bid_priority', 40)->nullable()->after('workflow_status');
            }

            if (! Schema::hasColumn('orders', 'bid_deadline_at')) {
                $table->timestamp('bid_deadline_at')->nullable()->after('due_date');
            }

            if (! Schema::hasColumn('orders', 'quote_items')) {
                $table->json('quote_items')->nullable()->after('workflow_meta');
            }
        });

        Schema::table('bids', function (Blueprint $table) {
            if (! Schema::hasColumn('bids', 'line_items')) {
                $table->json('line_items')->nullable()->after('currency');
            }

            if (! Schema::hasColumn('bids', 'workflow_meta')) {
                $table->json('workflow_meta')->nullable()->after('notes');
            }

            if (! Schema::hasColumn('bids', 'rejection_reason')) {
                $table->text('rejection_reason')->nullable()->after('status');
            }
        });
    }

    public function down(): void
    {
        $existingBidColumns = array_filter(
            ['line_items', 'workflow_meta', 'rejection_reason'],
            fn (string $column): bool => Schema::hasColumn('bids', $column),
        );

        if ($existingBidColumns !== []) {
            Schema::table('bids', function (Blueprint $table) use ($existingBidColumns) {
                $table->dropColumn($existingBidColumns);
            });
        }

        $existingOrderColumns = array_filter(
            ['workflow_type', 'workflow_status', 'bid_priority', 'bid_deadline_at', 'quote_items'],
            fn (string $column): bool => Schema::hasColumn('orders', $column),
        );

        if ($existingOrderColumns !== []) {
            Schema::table('orders', function (Blueprint $table) use ($existingOrderColumns) {
                $table->dropColumn($existingOrderColumns);
            });
        }
    }
};
