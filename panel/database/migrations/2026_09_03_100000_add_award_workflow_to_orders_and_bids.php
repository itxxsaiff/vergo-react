<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bids', function (Blueprint $table) {
            // The manager accepted this offer; the provider still has to confirm.
            if (! Schema::hasColumn('bids', 'awarded_at')) {
                $table->timestamp('awarded_at')->nullable()->after('no_show_reported_by_id');
            }
            // The provider's answer to the award.
            if (! Schema::hasColumn('bids', 'provider_accepted_at')) {
                $table->timestamp('provider_accepted_at')->nullable()->after('awarded_at');
            }
            if (! Schema::hasColumn('bids', 'provider_declined_at')) {
                $table->timestamp('provider_declined_at')->nullable()->after('provider_accepted_at');
            }
            if (! Schema::hasColumn('bids', 'provider_decline_reason')) {
                $table->text('provider_decline_reason')->nullable()->after('provider_declined_at');
            }
            // Provider abandoned the job after it started.
            if (! Schema::hasColumn('bids', 'cancelled_at')) {
                $table->timestamp('cancelled_at')->nullable()->after('provider_decline_reason');
            }
            if (! Schema::hasColumn('bids', 'cancellation_reason')) {
                $table->text('cancellation_reason')->nullable()->after('cancelled_at');
            }
        });

        Schema::table('orders', function (Blueprint $table) {
            // Audit trail the owner can read: offers opened, and sessions closed
            // while an offer was open.
            if (! Schema::hasColumn('orders', 'award_audit')) {
                $table->json('award_audit')->nullable()->after('duplicate_acknowledged_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('bids', function (Blueprint $table) {
            $columns = array_filter([
                'awarded_at', 'provider_accepted_at', 'provider_declined_at',
                'provider_decline_reason', 'cancelled_at', 'cancellation_reason',
            ], fn (string $c): bool => Schema::hasColumn('bids', $c));

            if ($columns !== []) {
                $table->dropColumn($columns);
            }
        });

        Schema::table('orders', function (Blueprint $table) {
            if (Schema::hasColumn('orders', 'award_audit')) {
                $table->dropColumn('award_audit');
            }
        });
    }
};
