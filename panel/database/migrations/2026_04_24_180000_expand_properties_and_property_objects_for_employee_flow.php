<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('properties', function (Blueprint $table) {
            $table->string('management', 255)->nullable()->after('title');
            $table->string('usage', 30)->nullable()->after('postal_code');
            $table->decimal('lot_area', 12, 2)->nullable()->after('usage');
        });

        Schema::table('property_objects', function (Blueprint $table) {
            $table->string('address')->nullable()->after('name');
            $table->string('postal_code', 30)->nullable()->after('address');
            $table->string('city', 120)->nullable()->after('postal_code');
            $table->unsignedInteger('floors')->nullable()->after('city');
            $table->unsignedInteger('apartment_count')->nullable()->after('floors');
            $table->decimal('commercial_area', 12, 2)->nullable()->after('apartment_count');
        });

        DB::table('property_objects')
            ->whereNull('address')
            ->update([
                'address' => DB::raw('name'),
            ]);

        DB::table('properties')
            ->whereNull('usage')
            ->update([
                'usage' => 'mixed',
            ]);
    }

    public function down(): void
    {
        Schema::table('property_objects', function (Blueprint $table) {
            $table->dropColumn([
                'address',
                'postal_code',
                'city',
                'floors',
                'apartment_count',
                'commercial_area',
            ]);
        });

        Schema::table('properties', function (Blueprint $table) {
            $table->dropColumn(['management', 'usage', 'lot_area']);
        });
    }
};
