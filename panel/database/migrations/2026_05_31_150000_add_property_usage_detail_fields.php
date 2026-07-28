<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('properties', function (Blueprint $table) {
            if (! Schema::hasColumn('properties', 'apartment_count')) {
                $table->unsignedInteger('apartment_count')->nullable()->after('lot_area');
            }

            if (! Schema::hasColumn('properties', 'commercial_area')) {
                $table->decimal('commercial_area', 12, 2)->nullable()->after('apartment_count');
            }
        });
    }

    public function down(): void
    {
        $existingColumns = array_filter(
            ['apartment_count', 'commercial_area'],
            fn (string $column): bool => Schema::hasColumn('properties', $column),
        );

        if ($existingColumns !== []) {
            Schema::table('properties', function (Blueprint $table) use ($existingColumns) {
                $table->dropColumn($existingColumns);
            });
        }
    }
};
