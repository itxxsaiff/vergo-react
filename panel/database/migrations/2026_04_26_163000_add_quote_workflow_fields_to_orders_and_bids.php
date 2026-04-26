<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('workflow_type', 40)->nullable()->after('status');
            $table->string('workflow_status', 40)->nullable()->after('workflow_type');
            $table->string('bid_priority', 40)->nullable()->after('workflow_status');
            $table->timestamp('bid_deadline_at')->nullable()->after('due_date');
            $table->json('quote_items')->nullable()->after('workflow_meta');
        });

        Schema::table('bids', function (Blueprint $table) {
            $table->json('line_items')->nullable()->after('currency');
            $table->json('workflow_meta')->nullable()->after('notes');
            $table->text('rejection_reason')->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('bids', function (Blueprint $table) {
            $table->dropColumn(['line_items', 'workflow_meta', 'rejection_reason']);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['workflow_type', 'workflow_status', 'bid_priority', 'bid_deadline_at', 'quote_items']);
        });
    }
};
