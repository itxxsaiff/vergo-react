<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('provider_reviews')) {
            return;
        }

        Schema::table('provider_reviews', function (Blueprint $table) {
            if (! Schema::hasColumn('provider_reviews', 'communication_rating')) {
                $table->unsignedTinyInteger('communication_rating')->nullable()->after('rating');
            }

            if (! Schema::hasColumn('provider_reviews', 'punctuality_rating')) {
                $table->unsignedTinyInteger('punctuality_rating')->nullable()->after('communication_rating');
            }

            if (! Schema::hasColumn('provider_reviews', 'quality_rating')) {
                $table->unsignedTinyInteger('quality_rating')->nullable()->after('punctuality_rating');
            }
        });

        DB::table('provider_reviews')
            ->whereNotNull('rating')
            ->update([
                'communication_rating' => DB::raw('COALESCE(communication_rating, rating)'),
                'punctuality_rating' => DB::raw('COALESCE(punctuality_rating, rating)'),
                'quality_rating' => DB::raw('COALESCE(quality_rating, rating)'),
            ]);
    }

    public function down(): void
    {
        if (! Schema::hasTable('provider_reviews')) {
            return;
        }

        Schema::table('provider_reviews', function (Blueprint $table) {
            foreach (['communication_rating', 'punctuality_rating', 'quality_rating'] as $column) {
                if (Schema::hasColumn('provider_reviews', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
