<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('property_manager_profiles', function (Blueprint $table) {
            if (! Schema::hasColumn('property_manager_profiles', 'phone')) {
                $table->string('phone', 50)->nullable()->after('email');
            }
        });

        Schema::table('service_providers', function (Blueprint $table) {
            if (! Schema::hasColumn('service_providers', 'address')) {
                $table->string('address')->nullable()->after('order_email');
            }

            if (! Schema::hasColumn('service_providers', 'postal_code')) {
                $table->string('postal_code', 50)->nullable()->after('address');
            }

            if (! Schema::hasColumn('service_providers', 'city')) {
                $table->string('city')->nullable()->after('postal_code');
            }
        });
    }

    public function down(): void
    {
        Schema::table('service_providers', function (Blueprint $table) {
            $table->dropColumn(['address', 'postal_code', 'city']);
        });

        Schema::table('property_manager_profiles', function (Blueprint $table) {
            $table->dropColumn('phone');
        });
    }
};
