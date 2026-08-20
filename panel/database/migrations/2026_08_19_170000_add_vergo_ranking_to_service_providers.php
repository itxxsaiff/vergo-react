<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_providers', function (Blueprint $table) {
            if (! Schema::hasColumn('service_providers', 'vergo_ranking_score')) {
                $table->decimal('vergo_ranking_score', 5, 2)->nullable();
            }
            if (! Schema::hasColumn('service_providers', 'vergo_ranking_breakdown')) {
                $table->json('vergo_ranking_breakdown')->nullable();
            }
            if (! Schema::hasColumn('service_providers', 'vergo_ranking_updated_at')) {
                $table->timestamp('vergo_ranking_updated_at')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('service_providers', function (Blueprint $table) {
            $columns = array_filter(
                ['vergo_ranking_score', 'vergo_ranking_breakdown', 'vergo_ranking_updated_at'],
                fn (string $c): bool => Schema::hasColumn('service_providers', $c),
            );

            if ($columns !== []) {
                $table->dropColumn($columns);
            }
        });
    }
};
