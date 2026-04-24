<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bids', function (Blueprint $table) {
            $table->date('estimated_start_date')->nullable()->after('currency');
            $table->date('estimated_completion_date')->nullable()->after('estimated_start_date');
        });
    }

    public function down(): void
    {
        Schema::table('bids', function (Blueprint $table) {
            $table->dropColumn(['estimated_start_date', 'estimated_completion_date']);
        });
    }
};
