<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Historically a new property_manager_profiles row was created for every
 * (property_id, email) pair, so a single manager email ended up duplicated once
 * per property they logged into. This merges those duplicates into one keeper
 * profile per email, re-points orders and property assignments at the keeper,
 * and replaces the (property_id, email) unique index with an email-only one so
 * the duplication cannot happen again.
 */
return new class extends Migration
{
    public function up(): void
    {
        // 1. Merge duplicate profiles that share the same (lowercased) email.
        $groups = DB::table('property_manager_profiles')
            ->selectRaw('LOWER(email) as email_key, COUNT(*) as total')
            ->groupBy('email_key')
            ->havingRaw('COUNT(*) > 1')
            ->pluck('total', 'email_key');

        foreach ($groups->keys() as $emailKey) {
            $profiles = DB::table('property_manager_profiles')
                ->whereRaw('LOWER(email) = ?', [$emailKey])
                ->orderBy('id')
                ->get();

            $keeper = $this->chooseKeeper($profiles);
            $duplicateIds = $profiles->pluck('id')->reject(fn ($id) => $id === $keeper->id)->values();

            if ($duplicateIds->isEmpty()) {
                continue;
            }

            DB::table('orders')
                ->whereIn('property_manager_profile_id', $duplicateIds)
                ->update(['property_manager_profile_id' => $keeper->id]);

            DB::table('properties')
                ->whereIn('property_manager_profile_id', $duplicateIds)
                ->update(['property_manager_profile_id' => $keeper->id]);

            DB::table('property_manager_profiles')
                ->whereIn('id', $duplicateIds)
                ->delete();
        }

        // 2. Swap the (property_id, email) unique index for an email-only one.
        try {
            Schema::table('property_manager_profiles', function (Blueprint $table): void {
                $table->index('property_id', 'property_manager_profiles_property_id_index');
            });
        } catch (\Throwable $e) {
            // Index already exists — safe to continue.
        }

        try {
            Schema::table('property_manager_profiles', function (Blueprint $table): void {
                $table->dropUnique('property_manager_profiles_property_id_email_unique');
            });
        } catch (\Throwable $e) {
            // Index name differs or already dropped — safe to continue.
        }

        try {
            Schema::table('property_manager_profiles', function (Blueprint $table): void {
                $table->unique('email');
            });
        } catch (\Throwable $e) {
            // Unique index already exists.
        }
    }

    public function down(): void
    {
        try {
            Schema::table('property_manager_profiles', function (Blueprint $table): void {
                $table->dropUnique('property_manager_profiles_email_unique');
            });
        } catch (\Throwable $e) {
            // no-op
        }

        try {
            Schema::table('property_manager_profiles', function (Blueprint $table): void {
                $table->unique(['property_id', 'email']);
            });
        } catch (\Throwable $e) {
            // no-op
        }

        try {
            Schema::table('property_manager_profiles', function (Blueprint $table): void {
                $table->dropIndex('property_manager_profiles_property_id_index');
            });
        } catch (\Throwable $e) {
            // no-op
        }
    }

    /**
     * Prefer the profile actually assigned to properties (that holds the real
     * data the client curated); otherwise fall back to the oldest row.
     */
    private function chooseKeeper($profiles): object
    {
        $assignedIds = DB::table('properties')
            ->whereIn('property_manager_profile_id', $profiles->pluck('id'))
            ->pluck('property_manager_profile_id')
            ->unique();

        $assigned = $profiles->first(fn ($p) => $assignedIds->contains($p->id));

        return $assigned ?? $profiles->first();
    }
};
