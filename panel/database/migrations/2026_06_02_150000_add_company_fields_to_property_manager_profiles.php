<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('property_manager_profiles', function (Blueprint $table) {
            $table->string('address')->nullable()->after('email');
            $table->string('postal_code', 50)->nullable()->after('address');
            $table->string('city')->nullable()->after('postal_code');
            $table->string('domain_suffix')->nullable()->after('city');
        });
    }

    public function down(): void
    {
        Schema::table('property_manager_profiles', function (Blueprint $table) {
            $table->dropColumn(['address', 'postal_code', 'city', 'domain_suffix']);
        });
    }
};
