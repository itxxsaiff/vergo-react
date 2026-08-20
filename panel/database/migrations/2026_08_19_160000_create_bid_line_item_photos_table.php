<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bid_line_item_photos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('bid_id')->constrained()->cascadeOnDelete();
            $table->foreignId('service_provider_id')->constrained()->cascadeOnDelete();
            // Which line item of the quote this photo documents.
            $table->unsignedInteger('line_item_index');
            $table->string('name');
            $table->string('path');
            $table->string('mime_type', 128)->nullable();
            $table->unsignedBigInteger('size')->nullable();
            // The manager decides per photo whether it becomes visible to the
            // other providers in the linked files section.
            $table->boolean('is_published')->default(false);
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->index(['order_id', 'line_item_index']);
            $table->index(['order_id', 'is_published']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bid_line_item_photos');
    }
};
