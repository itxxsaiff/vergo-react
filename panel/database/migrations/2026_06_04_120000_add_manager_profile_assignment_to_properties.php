<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('properties', function (Blueprint $table) {
            if (! Schema::hasColumn('properties', 'property_manager_profile_id')) {
                $table->foreignId('property_manager_profile_id')
                    ->nullable()
                    ->after('management')
                    ->constrained('property_manager_profiles')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('properties', 'property_manager_profile_id')) {
            Schema::table('properties', function (Blueprint $table) {
                $table->dropConstrainedForeignId('property_manager_profile_id');
            });
        }
    }
};
