<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bids', function (Blueprint $table) {
            if (! Schema::hasColumn('bids', 'provider_reference')) {
                // The provider's own internal quote number. Private to them:
                // never exposed to managers, owners or other providers.
                $table->string('provider_reference', 64)->nullable()->after('service_provider_id');
            }
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('bids', 'provider_reference')) {
            Schema::table('bids', function (Blueprint $table) {
                $table->dropColumn('provider_reference');
            });
        }
    }
};
