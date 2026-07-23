<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $columns = ['first_name', 'last_name', 'location', 'image'];
        $missingColumns = array_filter($columns, fn (string $column): bool => ! Schema::hasColumn('users', $column));

        if ($missingColumns !== []) {
            Schema::table('users', function (Blueprint $table) use ($missingColumns) {
                foreach ($missingColumns as $column) {
                    $table->string($column)->nullable();
                }
            });
        }

        DB::table('users')
            ->whereNull('first_name')
            ->update([
                'first_name' => DB::raw('name'),
            ]);
    }

    public function down(): void
    {
        $existingColumns = array_filter(
            ['first_name', 'last_name', 'location', 'image'],
            fn (string $column): bool => Schema::hasColumn('users', $column),
        );

        if ($existingColumns !== []) {
            Schema::table('users', function (Blueprint $table) use ($existingColumns) {
                $table->dropColumn($existingColumns);
            });
        }
    }
};
