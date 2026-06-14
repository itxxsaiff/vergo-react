<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bids', function (Blueprint $table) {
            $table->string('assigned_provider_email')->nullable()->after('service_provider_id');
            $table->json('draft_payload')->nullable()->after('workflow_meta');
            $table->timestamp('draft_saved_at')->nullable()->after('draft_payload');
        });
    }

    public function down(): void
    {
        Schema::table('bids', function (Blueprint $table) {
            $table->dropColumn(['assigned_provider_email', 'draft_payload', 'draft_saved_at']);
        });
    }
};
