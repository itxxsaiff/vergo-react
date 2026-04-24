<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('property_object_id')
                ->nullable()
                ->after('property_manager_profile_id')
                ->constrained('property_objects')
                ->nullOnDelete();
            $table->string('service_type')->nullable()->after('title');
            $table->date('due_date')->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('property_object_id');
            $table->dropColumn(['service_type', 'due_date']);
        });
    }
};
