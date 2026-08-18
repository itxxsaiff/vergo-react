<?php

namespace App\Console\Commands;

use App\Mail\EmployeePasswordResetMail;
use App\Models\Role;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;

class CreateSuperuser extends Command
{
    protected $signature = 'vergo:superuser
                            {email : Email address the superuser signs in with}
                            {--name= : Display name (defaults to the email local part)}
                            {--password= : Set this password directly instead of e-mailing a set-password link}
                            {--no-mail : Create the account without sending the password e-mail}';

    protected $description = 'Create or promote a Vergo superuser (admin role) and e-mail them a link to set their own password.';

    public function handle(): int
    {
        $email = strtolower(trim($this->argument('email')));

        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->error("'{$email}' is not a valid email address.");

            return self::FAILURE;
        }

        $adminRole = Role::query()->firstOrCreate(
            ['name' => 'admin'],
            ['label' => 'Administrator'],
        );

        $name = $this->option('name') ?: str($email)->before('@')->toString();
        $existing = User::query()->whereRaw('LOWER(email) = ?', [$email])->first();
        $password = $this->option('password');

        if ($password !== null && strlen($password) < 8) {
            $this->error('The password must be at least 8 characters.');

            return self::FAILURE;
        }

        $user = User::query()->updateOrCreate(
            ['email' => $email],
            [
                'role_id' => $adminRole->id,
                'name' => $existing?->name ?: $name,
                // Without --password this is never a known value: the account is
                // only usable once the recipient sets their own password via the
                // emailed link.
                'password' => $password ?: bin2hex(random_bytes(32)),
                'status' => 'active',
                'access_level' => 'power_user',
            ],
        );

        $this->info(($existing ? 'Promoted' : 'Created').": #{$user->id} {$user->name} <{$user->email}> (admin / power_user)");

        if ($password) {
            $this->info('Password set directly. No email sent.');

            return self::SUCCESS;
        }

        if ($this->option('no-mail')) {
            $this->warn('No email sent. Re-run without --no-mail to send the set-password link.');

            return self::SUCCESS;
        }

        $token = Password::broker()->createToken($user);
        $resetUrl = sprintf(
            '%s/reset-password?token=%s&email=%s',
            rtrim(config('app.frontend_url', env('FRONTEND_URL', 'http://localhost:5173')), '/'),
            urlencode($token),
            urlencode($user->email),
        );

        Mail::to($user->email)->send(new EmployeePasswordResetMail($user->name, $resetUrl));
        $this->info('Password setup email sent to '.$user->email);

        return self::SUCCESS;
    }
}
