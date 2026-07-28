<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('property_manager_profiles', function (Blueprint $table) {
            if (! Schema::hasColumn('property_manager_profiles', 'address')) {
                $table->string('address')->nullable()->after('email');
            }

            if (! Schema::hasColumn('property_manager_profiles', 'postal_code')) {
                $table->string('postal_code', 50)->nullable()->after('address');
            }

            if (! Schema::hasColumn('property_manager_profiles', 'city')) {
                $table->string('city')->nullable()->after('postal_code');
            }

            if (! Schema::hasColumn('property_manager_profiles', 'domain_suffix')) {
                $table->string('domain_suffix')->nullable()->after('city');
            }
        });
    }

    public function down(): void
    {
        $existingColumns = array_filter(
            ['address', 'postal_code', 'city', 'domain_suffix'],
            fn (string $column): bool => Schema::hasColumn('property_manager_profiles', $column),
        );

        if ($existingColumns !== []) {
            Schema::table('property_manager_profiles', function (Blueprint $table) use ($existingColumns) {
                $table->dropColumn($existingColumns);
            });
        }
    }
};
