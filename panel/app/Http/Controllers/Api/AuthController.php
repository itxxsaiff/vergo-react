<?php

namespace App\Http\Controllers\Api;

use App\Mail\OwnerOtpMail;
use App\Mail\UserOtpMail;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\ManagerLiLookupRequest;
use App\Http\Requests\Auth\ManagerOtpRequest;
use App\Http\Requests\Auth\ManagerOtpVerifyRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Mail\ManagerOtpMail;
use App\Models\ManagerLoginCode;
use App\Models\Property;
use App\Models\PropertyManagerProfile;
use App\Models\ServiceProvider;
use App\Models\User;
use App\Http\Requests\Auth\UserOtpRequest;
use App\Http\Requests\Auth\UserOtpVerifyRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Throwable;

class AuthController extends Controller
{
    public function requestUserOtp(UserOtpRequest $request): JsonResponse
    {
        $email = $request->string('email')->trim()->lower()->toString();
        $liNumber = $request->string('li_number')->trim()->toString();
        $customerNumber = $request->string('customer_number')->trim()->toString();
        $customerScope = $this->resolveCustomerNumberScope($customerNumber);

        if (! $customerNumber || ! $customerScope) {
            return response()->json([
                'message' => 'Please enter a valid customer number. Owners use ETM numbers and service providers use DLS numbers.',
            ], 422);
        }

        [$owner, $property, $message, $status] = $customerScope === 'provider'
            ? [null, null, null, 200]
            : $this->resolveOwnerForOtp($email, $liNumber, $customerNumber);
        [$provider, $providerMessage, $providerStatus] = $owner || $customerScope === 'owner'
            ? [null, null, 200]
            : $this->resolveProviderForOtp($email, $customerNumber);

        if (! $owner && ! $provider && ! $property) {
            return response()->json([
                'message' => $providerMessage ?: $message,
            ], $providerMessage ? $providerStatus : $status);
        }

        ManagerLoginCode::query()
            ->where('email', $email)
            ->where('purpose', $owner ? 'owner_login' : ($provider ? 'provider_login' : 'email_login'))
            ->whereNull('consumed_at')
            ->delete();

        $code = (string) random_int(100000, 999999);

        $loginCode = ManagerLoginCode::query()->create([
            'property_id' => $property?->id,
            'owner_id' => $owner?->id,
            'email' => $email,
            'code' => Hash::make($code),
            'purpose' => $owner ? 'owner_login' : ($provider ? 'provider_login' : 'email_login'),
            'expires_at' => now()->addMinutes(10),
            'ip_address' => $request->ip(),
        ]);

        try {
            if ($owner) {
                Mail::mailer('otp')->to($email)->send(new OwnerOtpMail(
                    code: $code,
                    ownerName: $owner->display_name,
                    liNumber: $property?->li_number,
                ));
            } elseif ($provider) {
                Mail::mailer('otp')->to($email)->send(new UserOtpMail(
                    code: $code,
                    userName: $provider->company_name,
                ));
            } else {
                Mail::mailer('otp')->to($email)->send(new ManagerOtpMail(
                    code: $code,
                    liNumber: $property->li_number,
                    propertyTitle: $property->title,
                    greetingName: $property->assignedManagerProfile?->name,
                ));
            }
        } catch (Throwable $exception) {
            $loginCode->delete();

            Log::error($owner ? 'Vergo owner OTP email failed' : ($provider ? 'Vergo provider OTP email failed' : 'Vergo email-only manager OTP email failed'), [
                'email' => $email,
                'property_id' => $property?->id,
                'owner_id' => $owner?->id,
                'provider_id' => $provider?->id,
                'error' => $exception->getMessage(),
            ]);

            return response()->json([
                'message' => 'OTP email could not be sent. Please check SMTP configuration and try again.',
            ], 500);
        }

        return response()->json([
            'message' => 'OTP sent successfully.',
            'data' => [
                'email' => $email,
                'li_number' => $property?->li_number,
                'property_title' => $property?->title,
                'owner_name' => $owner?->display_name,
                'customer_number' => $owner
                    ? $this->formatOwnerCustomerNumber($owner->id)
                    : ($provider ? $this->formatProviderCustomerNumber($provider->id) : null),
                'provider_name' => $provider?->company_name,
            ],
        ]);
    }

    public function checkManagerLi(ManagerLiLookupRequest $request): JsonResponse
    {
        $property = Property::query()
            ->with('assignedManagerProfile')
            ->where('li_number', $request->string('li_number')->toString())
            ->first();

        if (! $property) {
            return response()->json([
                'message' => 'Die LI-Nummer ist falsch.',
            ], 422);
        }

        return response()->json([
            'message' => 'Li number verified.',
            'data' => [
                'li_number' => $property->li_number,
                'property_title' => $property->title,
            ],
        ]);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $email = $request->string('email')->trim()->lower()->toString();
        $password = $request->string('password')->toString();

        $user = User::query()
            ->with('role')
            ->whereRaw('LOWER(email) = ?', [$email])
            ->first();

        if (! $user || ! Hash::check($password, $user->password)) {
            return response()->json([
                'message' => 'Invalid credentials.',
            ], 422);
        }

        if ($user->status !== 'active') {
            return response()->json([
                'message' => 'This account is inactive.',
            ], 403);
        }

        $token = $user->createToken('vergo-user')->plainTextToken;

        return response()->json([
            'message' => 'Login successful.',
            'data' => [
                'token' => $token,
                'user' => $this->transformUserActor($user),
            ],
        ]);
    }

    public function resetPassword(ResetPasswordRequest $request): JsonResponse
    {
        $status = Password::broker()->reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password): void {
                $user->forceFill([
                    'password' => $password,
                    'remember_token' => Str::random(60),
                ])->save();
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            return response()->json([
                'message' => __($status),
            ], 422);
        }

        return response()->json([
            'message' => 'Password reset successful.',
        ]);
    }

    public function requestManagerOtp(ManagerOtpRequest $request): JsonResponse
    {
        $property = Property::query()
            ->with('assignedManagerProfile')
            ->where('li_number', $request->string('li_number')->toString())
            ->firstOrFail();

        $email = $request->string('email')->toString();
        $domain = strtolower((string) str($email)->after('@'));

        $isAllowed = $this->propertyAllowsManagerEmail($property, $email, $domain);

        if (! $isAllowed) {
            return response()->json([
                'message' => 'This email domain is not allowed for the selected property.',
            ], 403);
        }

        ManagerLoginCode::query()
            ->where('property_id', $property->id)
            ->where('email', $email)
            ->where('purpose', 'login')
            ->whereNull('consumed_at')
            ->delete();

        $code = (string) random_int(100000, 999999);

        $loginCode = ManagerLoginCode::query()->create([
            'property_id' => $property->id,
            'email' => $email,
            'code' => Hash::make($code),
            'purpose' => 'login',
            'expires_at' => now()->addMinutes(10),
            'ip_address' => $request->ip(),
        ]);

        try {
            Mail::mailer('otp')->to($email)->send(new ManagerOtpMail(
                code: $code,
                liNumber: $property->li_number,
                propertyTitle: $property->title,
                greetingName: $property->assignedManagerProfile?->name,
            ));
        } catch (Throwable $exception) {
            $loginCode->delete();

            Log::error('Vergo manager OTP email failed', [
                'li_number' => $property->li_number,
                'email' => $email,
                'error' => $exception->getMessage(),
            ]);

            return response()->json([
                'message' => 'OTP email could not be sent. Please check SMTP configuration and try again.',
            ], 500);
        }

        return response()->json([
            'message' => 'OTP sent successfully.',
            'data' => [
                'li_number' => $property->li_number,
                'email' => $email,
                'property_title' => $property->title,
            ],
        ]);
    }

    public function verifyManagerOtp(ManagerOtpVerifyRequest $request): JsonResponse
    {
        $property = Property::query()
            ->where('li_number', $request->string('li_number')->toString())
            ->firstOrFail();

        $email = $request->string('email')->toString();
        $domain = strtolower((string) str($email)->after('@'));
        $plainCode = $request->string('code')->toString();

        $loginCode = ManagerLoginCode::query()
            ->where('property_id', $property->id)
            ->where('email', $email)
            ->whereNull('consumed_at')
            ->where('expires_at', '>', now())
            ->latest()
            ->first();

        if (! $loginCode || ! Hash::check($plainCode, $loginCode->code)) {
            return response()->json([
                'message' => 'Invalid or expired OTP code.',
            ], 422);
        }

        $manager = $this->resolveManagerProfileForEmail($property, $email, $domain);

        if (! $manager) {
            $manager = PropertyManagerProfile::query()->updateOrCreate(
                [
                    'property_id' => $property->id,
                    'email' => $email,
                ],
                [
                    'last_login_at' => now(),
                ],
            );
        } else {
            $manager->update([
                'last_login_at' => now(),
            ]);
        }

        $loginCode->update([
            'consumed_at' => now(),
        ]);

        $abilities = ['manager:full', 'orders:view_all', 'orders:create', 'orders:update', 'orders:delete'];
        $token = $manager->createToken('vergo-manager', $abilities)->plainTextToken;

        return response()->json([
            'message' => 'Manager login successful.',
            'data' => [
                'token' => $token,
                'user' => $this->transformManagerActor($manager->load('property'), $abilities),
            ],
        ]);
    }

    public function verifyUserOtp(UserOtpVerifyRequest $request): JsonResponse
    {
        $email = $request->string('email')->trim()->lower()->toString();
        $liNumber = $request->string('li_number')->trim()->toString();
        $customerNumber = $request->string('customer_number')->trim()->toString();
        $plainCode = $request->string('code')->toString();

        $loginCode = ManagerLoginCode::query()
            ->with(['property', 'owner.role'])
            ->where('email', $email)
            ->whereIn('purpose', ['email_login', 'owner_login', 'provider_login'])
            ->whereNull('consumed_at')
            ->where('expires_at', '>', now())
            ->latest()
            ->first();

        if (! $loginCode || ! Hash::check($plainCode, $loginCode->code)) {
            return response()->json([
                'message' => 'Invalid or expired OTP code.',
            ], 422);
        }

        if ($loginCode->purpose === 'owner_login') {
            $owner = $loginCode->owner;

            if (! $owner || $owner->status !== 'active') {
                return response()->json([
                    'message' => 'This owner account is inactive.',
                ], 403);
            }

            if ($liNumber !== '' && ! $owner->ownedProperties()->where('properties.li_number', $liNumber)->exists()) {
                return response()->json([
                    'message' => 'The selected LI number is not linked to this owner.',
                ], 422);
            }

            $loginCode->update([
                'consumed_at' => now(),
            ]);

            $token = $owner->createToken('vergo-owner')->plainTextToken;

            return response()->json([
                'message' => 'Login successful.',
                'data' => [
                    'token' => $token,
                    'user' => $this->transformUserActor($owner),
                ],
            ]);
        }

        if ($loginCode->purpose === 'provider_login') {
            [$provider] = $this->resolveProviderForOtp($email, $customerNumber);

            if (! $provider || ! $provider->user || $provider->user->status !== 'active') {
                return response()->json([
                    'message' => 'This service provider account is inactive.',
                ], 403);
            }

            $loginCode->update([
                'consumed_at' => now(),
            ]);

            $token = $provider->user->createToken('vergo-provider:'.$email)->plainTextToken;

            return response()->json([
                'message' => 'Login successful.',
                'data' => [
                    'token' => $token,
                    'user' => $this->transformUserActor($provider->user->load('role'), $email),
                ],
            ]);
        }

        $property = $loginCode->property;

        if (! $property) {
            return response()->json([
                'message' => 'No matching property was found for this email address.',
            ], 422);
        }

        $manager = PropertyManagerProfile::query()->updateOrCreate(
            [
                'property_id' => $property->id,
                'email' => $email,
            ],
            [
                'last_login_at' => now(),
            ],
        );

        $loginCode->update([
            'consumed_at' => now(),
        ]);

        $abilities = ['manager:full', 'orders:view_all', 'orders:create', 'orders:update', 'orders:delete'];
        $token = $manager->createToken('vergo-manager', $abilities)->plainTextToken;

        return response()->json([
            'message' => 'Login successful.',
            'data' => [
                'token' => $token,
                'user' => $this->transformManagerActor($manager->load('property'), $abilities),
            ],
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $actor = $request->user();

        if ($actor instanceof PropertyManagerProfile) {
            return response()->json([
                'data' => $this->transformManagerActor(
                    $actor->load('property'),
                    $request->user()->currentAccessToken()?->abilities ?? ['manager:full']
                ),
            ]);
        }

        $providerLoginEmail = null;
        $tokenName = (string) $actor->currentAccessToken()?->name;

        if ($actor instanceof User && $actor->role?->name === 'provider' && str_starts_with($tokenName, 'vergo-provider:')) {
            $providerLoginEmail = substr($tokenName, strlen('vergo-provider:'));
        }

        return response()->json([
            'data' => $this->transformUserActor($actor->load('role'), $providerLoginEmail),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json([
            'message' => 'Logged out successfully.',
        ]);
    }

    private function resolvePropertyForEmailLogin(string $email, ?string $liNumber = null): array
    {
        if ($liNumber) {
            $property = Property::query()
                ->where('li_number', $liNumber)
                ->first();

            if (! $property) {
                return [null, 'No property was found for the provided LI number.', 422];
            }

            $profileMatch = $property->managerProfiles()
                ->where(function ($query) use ($email) {
                    $query->whereRaw('LOWER(email) = ?', [$email]);
                })
                ->exists();

            if ($profileMatch) {
                return [$property, null, 200];
            }

            $domain = strtolower((string) str($email)->after('@'));
            $domainMatch = $this->propertyAllowsManagerEmail($property, $email, $domain);

            if (! $domainMatch) {
                return [null, 'This email is not linked to the selected LI number.', 422];
            }

            return [$property, null, 200];
        }

        $profileMatches = Property::query()
            ->select('properties.*')
            ->join('property_manager_profiles', 'property_manager_profiles.property_id', '=', 'properties.id')
            ->whereRaw('LOWER(property_manager_profiles.email) = ?', [$email])
            ->distinct()
            ->get();

        if ($profileMatches->count() > 1) {
            return [null, 'This email is linked to multiple properties. Please use the Li number login.', 409];
        }

        if ($profileMatches->count() === 1) {
            return [$profileMatches->first(), null, 200];
        }

        $domain = strtolower((string) str($email)->after('@'));

        $profileDomainMatches = Property::query()
            ->select('properties.*')
            ->join('property_manager_profiles', 'property_manager_profiles.property_id', '=', 'properties.id')
            ->where('property_manager_profiles.domain_suffix', $domain)
            ->distinct()
            ->get();

        if ($profileDomainMatches->count() > 1) {
            return [null, 'This email domain is linked to multiple properties. Please use the Li number login.', 409];
        }

        if ($profileDomainMatches->count() === 1) {
            return [$profileDomainMatches->first(), null, 200];
        }

        $domainMatches = Property::query()
            ->select('properties.*')
            ->join('property_manager_domains', 'property_manager_domains.property_id', '=', 'properties.id')
            ->where('property_manager_domains.domain', $domain)
            ->where('property_manager_domains.is_active', true)
            ->distinct()
            ->get();

        if ($domainMatches->count() > 1) {
            return [null, 'This email domain is linked to multiple properties. Please use the Li number login.', 409];
        }

        if ($domainMatches->isEmpty()) {
            return [null, 'No matching property was found for this email address.', 422];
        }

        return [$domainMatches->first(), null, 200];
    }

    private function resolveOwnerForOtp(string $email, ?string $liNumber = null, ?string $customerNumber = null): array
    {
        $property = null;

        if ($liNumber) {
            $property = Property::query()
                ->where('li_number', $liNumber)
                ->first();

            if (! $property) {
                return [null, null, 'No property was found for the provided LI number.', 422];
            }
        }

        $ownerIdFromCustomer = $this->parseCustomerNumber($customerNumber, 'ETM');

        $privateOwner = User::query()
            ->with('role')
            ->whereHas('role', fn ($query) => $query->where('name', 'owner'))
            ->where('owner_type', 'private_individual')
            ->when($ownerIdFromCustomer, fn ($query) => $query->where('id', $ownerIdFromCustomer))
            ->whereRaw('LOWER(login_email) = ?', [$email])
            ->first();

        if ($privateOwner) {
            if ($property && ! $privateOwner->ownedProperties()->where('properties.id', $property->id)->exists()) {
                return [null, null, 'This email is not linked to the selected LI number.', 422];
            }

            return [$privateOwner, $property, null, 200];
        }

        $domain = strtolower((string) str($email)->after('@'));
        $companyOwners = User::query()
            ->with('role')
            ->whereHas('role', fn ($query) => $query->where('name', 'owner'))
            ->where('owner_type', 'company')
            ->when($ownerIdFromCustomer, fn ($query) => $query->where('id', $ownerIdFromCustomer))
            ->where('domain_suffix', $domain)
            ->get();

        if ($property) {
            $matchingOwner = $companyOwners->first(function (User $owner) use ($property) {
                return $owner->ownedProperties()->where('properties.id', $property->id)->exists();
            });

            return $matchingOwner
                ? [$matchingOwner, $property, null, 200]
                : [null, null, 'This email domain is not linked to the selected LI number.', 422];
        }

        if ($companyOwners->count() > 1) {
            return [null, null, 'This email domain is linked to multiple owners. Please enter the LI number as well.', 409];
        }

        if ($companyOwners->count() === 1) {
            $matchingOwner = $companyOwners->first();

            return [$matchingOwner, $matchingOwner->ownedProperties()->select('properties.id', 'li_number', 'title')->first(), null, 200];
        }

        return [null, null, $customerNumber ? 'This customer number and email domain do not match an owner account.' : null, $customerNumber ? 422 : 422];
    }

    private function resolveProviderForOtp(string $email, ?string $customerNumber = null): array
    {
        $providerId = $this->parseCustomerNumber($customerNumber, 'DLS');
        $domain = strtolower((string) str($email)->after('@'));

        $query = ServiceProvider::query()
            ->with('user.role')
            ->where('domain_suffix', $domain);

        if ($providerId) {
            $query->where('id', $providerId);
        }

        $providers = $query->get();

        if ($providers->count() > 1) {
            return [null, 'This email domain is linked to multiple service providers. Please enter the customer number as well.', 409];
        }

        if ($providers->count() === 1) {
            return [$providers->first(), null, 200];
        }

        if ($customerNumber) {
            return [null, 'This customer number and email domain do not match a service provider account.', 422];
        }

        return [null, null, 422];
    }

    private function parseCustomerNumber(?string $value, string $prefix): ?int
    {
        if (! $value) {
            return null;
        }

        $normalized = strtoupper(trim($value));

        if (! str_starts_with($normalized, $prefix.'-')) {
            return null;
        }

        $digits = substr($normalized, strlen($prefix) + 1);

        return ctype_digit($digits) ? (int) $digits : null;
    }

    private function resolveCustomerNumberScope(?string $value): ?string
    {
        if (! $value) {
            return null;
        }

        $normalized = strtoupper(trim($value));

        if (str_starts_with($normalized, 'ETM-')) {
            return 'owner';
        }

        if (str_starts_with($normalized, 'DLS-')) {
            return 'provider';
        }

        return null;
    }

    private function propertyAllowsManagerEmail(Property $property, string $email, string $domain): bool
    {
        return (bool) $this->resolveManagerProfileForEmail($property, $email, $domain);
    }

    private function resolveManagerProfileForEmail(Property $property, string $email, string $domain): ?PropertyManagerProfile
    {
        $email = strtolower($email);
        $assignedManager = $property->assignedManagerProfile;

        if (! $assignedManager) {
            return null;
        }

        $assignedDomain = strtolower((string) $assignedManager->domain_suffix);
        $assignedEmail = strtolower((string) $assignedManager->email);

        if ($assignedEmail !== $email && $assignedDomain !== $domain) {
            return null;
        }

        return PropertyManagerProfile::query()->firstOrCreate(
            [
                'property_id' => $property->id,
                'email' => $email,
            ],
            [
                'name' => $assignedManager->name,
                'phone' => $assignedManager->phone,
                'address' => $assignedManager->address,
                'postal_code' => $assignedManager->postal_code,
                'city' => $assignedManager->city,
                'canton' => $assignedManager->canton,
                'domain_suffix' => $assignedManager->domain_suffix,
            ],
        );
    }

    private function formatOwnerCustomerNumber(int $id): string
    {
        return 'ETM-'.str_pad((string) $id, 5, '0', STR_PAD_LEFT);
    }

    private function formatProviderCustomerNumber(int $id): string
    {
        return 'DLS-'.str_pad((string) $id, 5, '0', STR_PAD_LEFT);
    }

    private function transformUserActor(User $user, ?string $providerLoginEmail = null): array
    {
        $user->loadMissing('serviceProvider');

        $role = $user->role?->name ?? 'user';
        $accessLevel = $user->access_level ?: 'admin';
        $navigationRole = $role === 'employee'
            ? ($accessLevel === 'power_user' ? 'employee_power_user' : 'employee_admin')
            : $role;
        $homePath = $role === 'owner' ? '/properties' : '/dashboard';

        return [
            'id' => $user->id,
            'type' => 'user',
            'name' => $user->name,
            'email' => $user->email,
            'provider_login_email' => $providerLoginEmail,
            'image' => $user->image,
            'role' => $role,
            'access_level' => $accessLevel,
            'navigation_role' => $navigationRole,
            'status' => $user->status,
            'home_path' => $homePath,
            'service_provider' => $user->serviceProvider ? [
                'id' => $user->serviceProvider->id,
                'company_name' => $user->serviceProvider->company_name,
                'is_vat_subject' => (bool) $user->serviceProvider->is_vat_subject,
            ] : null,
        ];
    }

    private function transformManagerActor(PropertyManagerProfile $manager, array $abilities = ['manager:full']): array
    {
        $managerAccess = $this->resolveManagerAccess($abilities);

        return [
            'id' => $manager->id,
            'type' => 'manager',
            'name' => $manager->name ?: 'Property Manager',
            'email' => $manager->email,
            'role' => 'manager',
            'role_label' => 'manager',
            'access_mode' => $managerAccess['mode'],
            'navigation_role' => $managerAccess['navigation_role'],
            'home_path' => $managerAccess['home_path'],
            'permissions' => $managerAccess['permissions'],
            'status' => 'active',
            'property' => [
                'id' => $manager->property?->id,
                'li_number' => $manager->property?->li_number,
                'title' => $manager->property?->title,
            ],
        ];
    }

    private function resolveManagerAccess(array $abilities): array
    {
        return [
            'mode' => 'full',
            'navigation_role' => 'manager',
            'home_path' => '/dashboard',
            'permissions' => [
                'orders' => [
                    'view_all' => true,
                    'create' => true,
                    'edit' => true,
                    'delete' => true,
                ],
            ],
        ];
    }
}
