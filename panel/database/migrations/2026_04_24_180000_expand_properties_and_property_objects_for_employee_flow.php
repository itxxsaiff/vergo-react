<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $missingPropertyColumns = array_filter(
            ['management', 'usage', 'lot_area'],
            fn (string $column): bool => ! Schema::hasColumn('properties', $column),
        );

        if ($missingPropertyColumns !== []) {
            Schema::table('properties', function (Blueprint $table) use ($missingPropertyColumns) {
                if (in_array('management', $missingPropertyColumns, true)) {
                    $table->string('management', 255)->nullable()->after('title');
                }

                if (in_array('usage', $missingPropertyColumns, true)) {
                    $table->string('usage', 30)->nullable()->after('postal_code');
                }

                if (in_array('lot_area', $missingPropertyColumns, true)) {
                    $table->decimal('lot_area', 12, 2)->nullable()->after('usage');
                }
            });
        }

        $missingObjectColumns = array_filter(
            ['address', 'postal_code', 'city', 'floors', 'apartment_count', 'commercial_area'],
            fn (string $column): bool => ! Schema::hasColumn('property_objects', $column),
        );

        if ($missingObjectColumns !== []) {
            Schema::table('property_objects', function (Blueprint $table) use ($missingObjectColumns) {
                if (in_array('address', $missingObjectColumns, true)) {
                    $table->string('address')->nullable()->after('name');
                }

                if (in_array('postal_code', $missingObjectColumns, true)) {
                    $table->string('postal_code', 30)->nullable()->after('address');
                }

                if (in_array('city', $missingObjectColumns, true)) {
                    $table->string('city', 120)->nullable()->after('postal_code');
                }

                if (in_array('floors', $missingObjectColumns, true)) {
                    $table->unsignedInteger('floors')->nullable()->after('city');
                }

                if (in_array('apartment_count', $missingObjectColumns, true)) {
                    $table->unsignedInteger('apartment_count')->nullable()->after('floors');
                }

                if (in_array('commercial_area', $missingObjectColumns, true)) {
                    $table->decimal('commercial_area', 12, 2)->nullable()->after('apartment_count');
                }
            });
        }

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
        $existingObjectColumns = array_filter(
            ['address', 'postal_code', 'city', 'floors', 'apartment_count', 'commercial_area'],
            fn (string $column): bool => Schema::hasColumn('property_objects', $column),
        );

        if ($existingObjectColumns !== []) {
            Schema::table('property_objects', function (Blueprint $table) use ($existingObjectColumns) {
                $table->dropColumn($existingObjectColumns);
            });
        }

        $existingPropertyColumns = array_filter(
            ['management', 'usage', 'lot_area'],
            fn (string $column): bool => Schema::hasColumn('properties', $column),
        );

        if ($existingPropertyColumns !== []) {
            Schema::table('properties', function (Blueprint $table) use ($existingPropertyColumns) {
                $table->dropColumn($existingPropertyColumns);
            });
        }
    }
};
