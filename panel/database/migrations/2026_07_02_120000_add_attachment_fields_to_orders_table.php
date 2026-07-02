<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (! Schema::hasColumn('orders', 'attachment_name')) {
                $table->string('attachment_name')->nullable()->after('quote_items');
            }

            if (! Schema::hasColumn('orders', 'attachment_path')) {
                $table->string('attachment_path')->nullable()->after('attachment_name');
            }

            if (! Schema::hasColumn('orders', 'attachment_mime_type')) {
                $table->string('attachment_mime_type')->nullable()->after('attachment_path');
            }

            if (! Schema::hasColumn('orders', 'attachment_size')) {
                $table->unsignedBigInteger('attachment_size')->nullable()->after('attachment_mime_type');
            }
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $columns = [
                'attachment_name',
                'attachment_path',
                'attachment_mime_type',
                'attachment_size',
            ];

            $existingColumns = array_values(array_filter($columns, fn (string $column) => Schema::hasColumn('orders', $column)));

            if ($existingColumns !== []) {
                $table->dropColumn($existingColumns);
            }
        });
    }
};
