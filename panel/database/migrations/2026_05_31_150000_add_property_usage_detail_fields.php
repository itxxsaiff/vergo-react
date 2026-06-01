<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('properties', function (Blueprint $table) {
            $table->unsignedInteger('apartment_count')->nullable()->after('lot_area');
            $table->decimal('commercial_area', 12, 2)->nullable()->after('apartment_count');
        });
    }

    public function down(): void
    {
        Schema::table('properties', function (Blueprint $table) {
            $table->dropColumn(['apartment_count', 'commercial_area']);
        });
    }
};
