<?php

use App\Mail\ManagerOtpMail;
use App\Models\Property;
use App\Models\PropertyManagerDomain;
use App\Models\PropertyManagerProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;

uses(RefreshDatabase::class);

it('sends an otp when the email matches an existing property manager profile', function () {
    $property = Property::query()->create([
        'li_number' => 'An-20001',
        'title' => 'Test Property',
    ]);

    PropertyManagerProfile::query()->create([
        'property_id' => $property->id,
        'email' => 'manager@example.com',
    ]);

    Mail::fake();

    $response = $this->postJson('/api/auth/user/request-otp', [
        'email' => 'manager@example.com',
    ]);

    $response
        ->assertOk()
        ->assertJsonPath('data.email', 'manager@example.com')
        ->assertJsonPath('data.li_number', 'An-20001');

    Mail::assertSent(ManagerOtpMail::class, function (ManagerOtpMail $mail) {
        return $mail->hasTo('manager@example.com')
            && strlen($mail->code) === 6;
    });
});

it('sends an otp when the email domain matches exactly one property', function () {
    $property = Property::query()->create([
        'li_number' => 'An-20002',
        'title' => 'Domain Match Property',
    ]);

    PropertyManagerDomain::query()->create([
        'property_id' => $property->id,
        'domain' => 'example.com',
        'is_active' => true,
    ]);

    Mail::fake();

    $response = $this->postJson('/api/auth/user/request-otp', [
        'email' => 'fresh@example.com',
    ]);

    $response
        ->assertOk()
        ->assertJsonPath('data.email', 'fresh@example.com')
        ->assertJsonPath('data.li_number', 'An-20002');
});

it('logs a manager in after verifying a valid email-only otp', function () {
    $property = Property::query()->create([
        'li_number' => 'An-20003',
        'title' => 'OTP Login Property',
    ]);

    PropertyManagerDomain::query()->create([
        'property_id' => $property->id,
        'domain' => 'example.com',
        'is_active' => true,
    ]);

    Mail::fake();

    $this->postJson('/api/auth/user/request-otp', [
        'email' => 'manager@example.com',
    ])->assertOk();

    $sentMail = null;

    Mail::assertSent(ManagerOtpMail::class, function (ManagerOtpMail $mail) use (&$sentMail) {
        if (! $mail->hasTo('manager@example.com')) {
            return false;
        }

        $sentMail = $mail;

        return true;
    });

    $response = $this->postJson('/api/auth/user/verify-otp', [
        'email' => 'manager@example.com',
        'code' => $sentMail?->code,
    ]);

    $response
        ->assertOk()
        ->assertJsonPath('data.user.email', 'manager@example.com')
        ->assertJsonPath('data.user.role', 'manager')
        ->assertJsonPath('data.user.access_mode', 'orders_only')
        ->assertJsonPath('data.user.home_path', '/orders')
        ->assertJsonPath('data.user.property.li_number', 'An-20003');

    expect($response->json('data.token'))->not->toBeEmpty();
});

it('returns full manager access for li-number based otp login', function () {
    $property = Property::query()->create([
        'li_number' => 'An-20004',
        'title' => 'Full Access Property',
    ]);

    PropertyManagerDomain::query()->create([
        'property_id' => $property->id,
        'domain' => 'example.com',
        'is_active' => true,
    ]);

    Mail::fake();

    $this->postJson('/api/auth/manager/request-otp', [
        'li_number' => 'An-20004',
        'email' => 'manager@example.com',
    ])->assertOk();

    $sentMail = null;

    Mail::assertSent(ManagerOtpMail::class, function (ManagerOtpMail $mail) use (&$sentMail) {
        if (! $mail->hasTo('manager@example.com')) {
            return false;
        }

        $sentMail = $mail;

        return true;
    });

    $response = $this->postJson('/api/auth/manager/verify-otp', [
        'li_number' => 'An-20004',
        'email' => 'manager@example.com',
        'code' => $sentMail?->code,
    ]);

    $response
        ->assertOk()
        ->assertJsonPath('data.user.access_mode', 'full')
        ->assertJsonPath('data.user.home_path', '/dashboard')
        ->assertJsonPath('data.user.permissions.orders.create', false)
        ->assertJsonPath('data.user.permissions.orders.edit', true);
});
