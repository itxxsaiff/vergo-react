<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            // Cancelling a published job always needs a reason; providers are
            // told why.
            if (! Schema::hasColumn('orders', 'cancelled_at')) {
                $table->timestamp('cancelled_at')->nullable()->after('completed_at');
            }
            if (! Schema::hasColumn('orders', 'cancellation_reason')) {
                $table->text('cancellation_reason')->nullable()->after('cancelled_at');
            }
            if (! Schema::hasColumn('orders', 'cancelled_by_type')) {
                $table->string('cancelled_by_type', 32)->nullable()->after('cancellation_reason');
            }
            if (! Schema::hasColumn('orders', 'cancelled_by_id')) {
                $table->unsignedBigInteger('cancelled_by_id')->nullable()->after('cancelled_by_type');
            }

            // Set when the system flags this order as a likely duplicate of an
            // earlier one, together with the manager's mandatory explanation.
            if (! Schema::hasColumn('orders', 'duplicate_of_order_id')) {
                $table->unsignedBigInteger('duplicate_of_order_id')->nullable()->after('cancelled_by_id');
                $table->index('duplicate_of_order_id');
            }
            if (! Schema::hasColumn('orders', 'duplicate_similarity')) {
                $table->decimal('duplicate_similarity', 5, 4)->nullable()->after('duplicate_of_order_id');
            }
            if (! Schema::hasColumn('orders', 'duplicate_reason')) {
                $table->string('duplicate_reason', 32)->nullable()->after('duplicate_similarity');
            }
            if (! Schema::hasColumn('orders', 'duplicate_explanation')) {
                $table->text('duplicate_explanation')->nullable()->after('duplicate_reason');
            }
            if (! Schema::hasColumn('orders', 'duplicate_acknowledged_at')) {
                $table->timestamp('duplicate_acknowledged_at')->nullable()->after('duplicate_explanation');
            }
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (Schema::hasColumn('orders', 'duplicate_of_order_id')) {
                $table->dropIndex(['duplicate_of_order_id']);
            }

            $columns = array_filter([
                'cancelled_at', 'cancellation_reason', 'cancelled_by_type', 'cancelled_by_id',
                'duplicate_of_order_id', 'duplicate_similarity', 'duplicate_reason',
                'duplicate_explanation', 'duplicate_acknowledged_at',
            ], fn (string $c): bool => Schema::hasColumn('orders', $c));

            if ($columns !== []) {
                $table->dropColumn($columns);
            }
        });
    }
};
