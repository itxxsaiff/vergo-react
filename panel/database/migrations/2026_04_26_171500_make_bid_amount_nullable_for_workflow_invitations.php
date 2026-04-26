<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE bids MODIFY amount DECIMAL(12,2) NULL');
    }

    public function down(): void
    {
        DB::statement('UPDATE bids SET amount = 0.00 WHERE amount IS NULL');
        DB::statement('ALTER TABLE bids MODIFY amount DECIMAL(12,2) NOT NULL');
    }
};
