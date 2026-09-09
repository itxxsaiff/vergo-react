<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Photos were only ever attached by a service provider to their own quote. The
 * property manager now adds them to the items they enter themselves, and at
 * that point there is no bid and no provider - so both become optional.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bid_line_item_photos', function (Blueprint $table): void {
            $table->foreignId('bid_id')->nullable()->change();
            $table->foreignId('service_provider_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('bid_line_item_photos', function (Blueprint $table): void {
            $table->foreignId('bid_id')->nullable(false)->change();
            $table->foreignId('service_provider_id')->nullable(false)->change();
        });
    }
};
