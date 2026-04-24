<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        collect([
            ['name' => 'admin', 'label' => 'Administrator'],
            ['name' => 'owner', 'label' => 'Owner'],
            ['name' => 'provider', 'label' => 'Service Provider'],
            ['name' => 'employee', 'label' => 'Employee'],
        ])->each(fn (array $role) => Role::query()->firstOrCreate(
            ['name' => $role['name']],
            ['label' => $role['label']],
        ));

        $adminRole = Role::query()->where('name', 'admin')->first();

        User::query()->updateOrCreate(
            ['email' => 'admin@vergo.test'],
            [
                'role_id' => $adminRole?->id,
                'name' => 'Vergo Admin',
                'first_name' => 'Vergo Admin',
                'last_name' => null,
                'location' => null,
                'image' => null,
                'password' => 'password123',
                'status' => 'active',
            ],
        );
    }
}
