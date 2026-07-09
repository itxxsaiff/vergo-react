<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('support_tickets', function (Blueprint $table) {
            $table->id();
            $table->string('ticket_number')->unique();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('property_manager_profile_id')->nullable()->constrained()->nullOnDelete();
            $table->string('requester_role', 50)->nullable();
            $table->string('requester_name')->nullable();
            $table->string('requester_email')->nullable();
            $table->string('category', 50)->default('general');
            $table->string('priority', 30)->default('normal');
            $table->string('subject');
            $table->text('message');
            $table->string('status', 30)->default('open');
            $table->text('admin_notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('support_tickets');
    }
};
