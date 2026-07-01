<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('property_manager_profiles', function (Blueprint $table) {
            if (! Schema::hasColumn('property_manager_profiles', 'invoice_delivery_method')) {
                $table->string('invoice_delivery_method', 20)->default('email')->after('canton');
            }

            if (! Schema::hasColumn('property_manager_profiles', 'invoice_email')) {
                $table->string('invoice_email')->nullable()->after('invoice_delivery_method');
            }

            if (! Schema::hasColumn('property_manager_profiles', 'invoice_company_name')) {
                $table->string('invoice_company_name')->nullable()->after('invoice_email');
            }

            if (! Schema::hasColumn('property_manager_profiles', 'invoice_company_extra')) {
                $table->string('invoice_company_extra')->nullable()->after('invoice_company_name');
            }

            if (! Schema::hasColumn('property_manager_profiles', 'invoice_address')) {
                $table->string('invoice_address')->nullable()->after('invoice_company_extra');
            }

            if (! Schema::hasColumn('property_manager_profiles', 'invoice_postal_code')) {
                $table->string('invoice_postal_code', 50)->nullable()->after('invoice_address');
            }

            if (! Schema::hasColumn('property_manager_profiles', 'invoice_city')) {
                $table->string('invoice_city')->nullable()->after('invoice_postal_code');
            }
        });
    }

    public function down(): void
    {
        Schema::table('property_manager_profiles', function (Blueprint $table) {
            $table->dropColumn([
                'invoice_delivery_method',
                'invoice_email',
                'invoice_company_name',
                'invoice_company_extra',
                'invoice_address',
                'invoice_postal_code',
                'invoice_city',
            ]);
        });
    }
};
