<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('property_manager_profiles', function (Blueprint $table) {
            if (! Schema::hasColumn('property_manager_profiles', 'canton')) {
                $table->string('canton', 120)->nullable()->after('city');
            }
        });
    }

    public function down(): void
    {
        Schema::table('property_manager_profiles', function (Blueprint $table) {
            if (Schema::hasColumn('property_manager_profiles', 'canton')) {
                $table->dropColumn('canton');
            }
        });
    }
};
