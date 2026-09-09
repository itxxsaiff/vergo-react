<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bids', function (Blueprint $table): void {
            if (! Schema::hasColumn('bids', 'completion_reminded_at')) {
                $table->timestamp('completion_reminded_at')->nullable()->after('submitted_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('bids', function (Blueprint $table): void {
            if (Schema::hasColumn('bids', 'completion_reminded_at')) {
                $table->dropColumn('completion_reminded_at');
            }
        });
    }
};
