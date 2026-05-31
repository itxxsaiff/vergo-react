<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('owner_type', 30)->nullable()->after('access_level');
            $table->string('company_name')->nullable()->after('owner_type');
            $table->string('address')->nullable()->after('company_name');
            $table->string('postal_code', 30)->nullable()->after('address');
            $table->string('city')->nullable()->after('postal_code');
            $table->string('domain_suffix')->nullable()->after('city');
            $table->string('login_email')->nullable()->unique()->after('domain_suffix');
        });

        Schema::table('manager_login_codes', function (Blueprint $table) {
            $table->foreignId('owner_id')->nullable()->after('property_id')->constrained('users')->nullOnDelete();
        });

        DB::table('users')
            ->whereExists(function ($query) {
                $query
                    ->selectRaw('1')
                    ->from('roles')
                    ->whereColumn('roles.id', 'users.role_id')
                    ->where('roles.name', 'owner');
            })
            ->update([
                'owner_type' => 'company',
                'company_name' => DB::raw('COALESCE(company_name, name)'),
                'address' => DB::raw('COALESCE(address, location)'),
                'login_email' => DB::raw('COALESCE(login_email, email)'),
                'domain_suffix' => DB::raw("CASE WHEN email LIKE '%@%' THEN LOWER(SUBSTRING_INDEX(email, '@', -1)) ELSE domain_suffix END"),
            ]);
    }

    public function down(): void
    {
        Schema::table('manager_login_codes', function (Blueprint $table) {
            $table->dropConstrainedForeignId('owner_id');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['login_email']);
            $table->dropColumn([
                'owner_type',
                'company_name',
                'address',
                'postal_code',
                'city',
                'domain_suffix',
                'login_email',
            ]);
        });
    }
};
