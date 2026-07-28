<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bids', function (Blueprint $table): void {
            $table->decimal('amount', 12, 2)->nullable()->change();
        });
    }

    public function down(): void
    {
        DB::statement('UPDATE bids SET amount = 0.00 WHERE amount IS NULL');

        Schema::table('bids', function (Blueprint $table): void {
            $table->decimal('amount', 12, 2)->nullable(false)->change();
        });
    }
};
