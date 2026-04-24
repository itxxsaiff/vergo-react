<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('property_manager_domains', function (Blueprint $table) {
            $table->id();
            $table->foreignId('property_id')->constrained()->cascadeOnDelete();
            $table->string('domain');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['property_id', 'domain']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('property_manager_domains');
    }
};
