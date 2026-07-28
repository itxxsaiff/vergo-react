<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (! Schema::hasColumn('orders', 'property_object_ids')) {
                $table->json('property_object_ids')->nullable()->after('property_object_id');
            }

            if (! Schema::hasColumn('orders', 'workflow_meta')) {
                $table->json('workflow_meta')->nullable()->after('due_date');
            }
        });
    }

    public function down(): void
    {
        $existingColumns = array_filter(
            ['property_object_ids', 'workflow_meta'],
            fn (string $column): bool => Schema::hasColumn('orders', $column),
        );

        if ($existingColumns !== []) {
            Schema::table('orders', function (Blueprint $table) use ($existingColumns) {
                $table->dropColumn($existingColumns);
            });
        }
    }
};
