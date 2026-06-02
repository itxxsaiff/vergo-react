<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_providers', function (Blueprint $table) {
            $table->string('order_email')->nullable()->after('contact_email');
            $table->string('domain_suffix')->nullable()->after('order_email');
            $table->json('trade_groups')->nullable()->after('domain_suffix');
        });
    }

    public function down(): void
    {
        Schema::table('service_providers', function (Blueprint $table) {
            $table->dropColumn(['order_email', 'domain_suffix', 'trade_groups']);
        });
    }
};
