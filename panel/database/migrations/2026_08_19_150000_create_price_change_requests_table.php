<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('price_change_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('bid_id')->constrained()->cascadeOnDelete();
            $table->foreignId('service_provider_id')->constrained()->cascadeOnDelete();
            // Every changed price and every added item carries its own
            // mandatory reason; stored together with the before/after values.
            $table->json('items');
            $table->decimal('original_amount', 12, 2)->nullable();
            $table->decimal('requested_amount', 12, 2)->nullable();
            $table->string('status', 32)->default('pending');
            $table->text('decision_note')->nullable();
            $table->timestamp('decided_at')->nullable();
            $table->string('decided_by_type', 32)->nullable();
            $table->unsignedBigInteger('decided_by_id')->nullable();
            $table->timestamps();

            $table->index(['order_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('price_change_requests');
    }
};
