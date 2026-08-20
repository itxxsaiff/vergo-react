<?php

use App\Models\Order;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (! Schema::hasColumn('orders', 'order_sequence')) {
                $table->unsignedInteger('order_sequence')->nullable()->unique()->after('id');
            }

            if (! Schema::hasColumn('orders', 'order_number')) {
                $table->string('order_number', 32)->nullable()->unique()->after('order_sequence');
            }
        });

        // Backfill oldest first so the running number matches creation order.
        $sequence = 0;

        Order::withTrashed()
            ->orderBy('id')
            ->get(['id', 'created_at'])
            ->each(function (Order $order) use (&$sequence): void {
                $sequence++;

                $order->newQuery()->withTrashed()->whereKey($order->getKey())->update([
                    'order_sequence' => $sequence,
                    'order_number' => Order::formatOrderNumber($sequence, $order->created_at),
                ]);
            });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $existing = array_filter(
                ['order_sequence', 'order_number'],
                fn (string $column): bool => Schema::hasColumn('orders', $column),
            );

            foreach ($existing as $column) {
                $table->dropUnique('orders_'.$column.'_unique');
            }

            if ($existing !== []) {
                $table->dropColumn($existing);
            }
        });
    }
};
