<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $missingUserColumns = array_filter(
            ['owner_type', 'company_name', 'address', 'postal_code', 'city', 'domain_suffix', 'login_email'],
            fn (string $column): bool => ! Schema::hasColumn('users', $column),
        );

        if ($missingUserColumns !== []) {
            Schema::table('users', function (Blueprint $table) use ($missingUserColumns) {
                if (in_array('owner_type', $missingUserColumns, true)) {
                    $table->string('owner_type', 30)->nullable()->after('access_level');
                }

                if (in_array('company_name', $missingUserColumns, true)) {
                    $table->string('company_name')->nullable()->after('owner_type');
                }

                if (in_array('address', $missingUserColumns, true)) {
                    $table->string('address')->nullable()->after('company_name');
                }

                if (in_array('postal_code', $missingUserColumns, true)) {
                    $table->string('postal_code', 30)->nullable()->after('address');
                }

                if (in_array('city', $missingUserColumns, true)) {
                    $table->string('city')->nullable()->after('postal_code');
                }

                if (in_array('domain_suffix', $missingUserColumns, true)) {
                    $table->string('domain_suffix')->nullable()->after('city');
                }

                if (in_array('login_email', $missingUserColumns, true)) {
                    $table->string('login_email')->nullable()->unique()->after('domain_suffix');
                }
            });
        }

        if (! Schema::hasColumn('manager_login_codes', 'owner_id')) {
            Schema::table('manager_login_codes', function (Blueprint $table) {
                $table->foreignId('owner_id')->nullable()->after('property_id')->constrained('users')->nullOnDelete();
            });
        }

        DB::table('users')
            ->join('roles', 'roles.id', '=', 'users.role_id')
            ->where('roles.name', 'owner')
            ->select([
                'users.id',
                'users.name',
                'users.email',
                'users.location',
                'users.company_name',
                'users.address',
                'users.login_email',
                'users.domain_suffix',
            ])
            ->orderBy('users.id')
            ->get()
            ->each(function (object $user): void {
                $domainSuffix = $user->domain_suffix;

                if (is_string($user->email) && str_contains($user->email, '@')) {
                    $domainSuffix = strtolower(substr(strrchr($user->email, '@'), 1));
                }

                DB::table('users')
                    ->where('id', $user->id)
                    ->update([
                        'owner_type' => 'company',
                        'company_name' => $user->company_name ?? $user->name,
                        'address' => $user->address ?? $user->location,
                        'login_email' => $user->login_email ?? $user->email,
                        'domain_suffix' => $domainSuffix,
                    ]);
            });
    }

    public function down(): void
    {
        if (Schema::hasColumn('manager_login_codes', 'owner_id')) {
            Schema::table('manager_login_codes', function (Blueprint $table) {
                $table->dropConstrainedForeignId('owner_id');
            });
        }

        $existingUserColumns = array_filter(
            ['owner_type', 'company_name', 'address', 'postal_code', 'city', 'domain_suffix', 'login_email'],
            fn (string $column): bool => Schema::hasColumn('users', $column),
        );

        if ($existingUserColumns !== []) {
            Schema::table('users', function (Blueprint $table) use ($existingUserColumns) {
                if (in_array('login_email', $existingUserColumns, true)) {
                    $table->dropUnique(['login_email']);
                }

                $table->dropColumn($existingUserColumns);
            });
        }
    }
};
