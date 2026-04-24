<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bids', function (Blueprint $table) {
            $table->string('attachment_name')->nullable()->after('notes');
            $table->string('attachment_path')->nullable()->after('attachment_name');
            $table->string('attachment_mime_type')->nullable()->after('attachment_path');
            $table->unsignedBigInteger('attachment_size')->nullable()->after('attachment_mime_type');
        });
    }

    public function down(): void
    {
        Schema::table('bids', function (Blueprint $table) {
            $table->dropColumn([
                'attachment_name',
                'attachment_path',
                'attachment_mime_type',
                'attachment_size',
            ]);
        });
    }
};
