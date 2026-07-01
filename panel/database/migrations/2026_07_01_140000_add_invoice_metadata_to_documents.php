<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            if (! Schema::hasColumn('documents', 'property_object_id')) {
                $table->foreignId('property_object_id')->nullable()->after('property_id')->constrained('property_objects')->nullOnDelete();
            }

            if (! Schema::hasColumn('documents', 'property_object_ids')) {
                $table->json('property_object_ids')->nullable()->after('property_object_id');
            }

            if (! Schema::hasColumn('documents', 'service_provider_id')) {
                $table->foreignId('service_provider_id')->nullable()->after('order_id')->constrained('service_providers')->nullOnDelete();
            }

            if (! Schema::hasColumn('documents', 'service_type')) {
                $table->string('service_type', 120)->nullable()->after('type');
            }

            if (! Schema::hasColumn('documents', 'trade_object')) {
                $table->string('trade_object', 255)->nullable()->after('service_type');
            }

            if (! Schema::hasColumn('documents', 'trade_activity')) {
                $table->string('trade_activity', 255)->nullable()->after('trade_object');
            }
        });
    }

    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->dropConstrainedForeignId('property_object_id');
            $table->dropConstrainedForeignId('service_provider_id');
            $table->dropColumn(['property_object_ids', 'service_type', 'trade_object', 'trade_activity']);
        });
    }
};
