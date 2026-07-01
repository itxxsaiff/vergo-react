<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_providers', function (Blueprint $table) {
            if (! Schema::hasColumn('service_providers', 'canton')) {
                $table->string('canton', 120)->nullable()->after('city');
            }
        });
    }

    public function down(): void
    {
        Schema::table('service_providers', function (Blueprint $table) {
            if (Schema::hasColumn('service_providers', 'canton')) {
                $table->dropColumn('canton');
            }
        });
    }
};
