<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_providers', function (Blueprint $table) {
            if (! Schema::hasColumn('service_providers', 'order_email')) {
                $table->string('order_email')->nullable()->after('contact_email');
            }

            if (! Schema::hasColumn('service_providers', 'domain_suffix')) {
                $table->string('domain_suffix')->nullable()->after('order_email');
            }

            if (! Schema::hasColumn('service_providers', 'trade_groups')) {
                $table->json('trade_groups')->nullable()->after('domain_suffix');
            }
        });
    }

    public function down(): void
    {
        $existingColumns = array_filter(
            ['order_email', 'domain_suffix', 'trade_groups'],
            fn (string $column): bool => Schema::hasColumn('service_providers', $column),
        );

        if ($existingColumns !== []) {
            Schema::table('service_providers', function (Blueprint $table) use ($existingColumns) {
                $table->dropColumn($existingColumns);
            });
        }
    }
};
