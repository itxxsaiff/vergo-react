<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\ManagerLiLookupRequest;
use App\Http\Requests\Auth\ManagerOtpRequest;
use App\Http\Requests\Auth\ManagerOtpVerifyRequest;
use App\Mail\ManagerOtpMail;
use App\Models\ManagerLoginCode;
use App\Models\Property;
use App\Models\PropertyManagerProfile;
use App\Models\User;
use App\Http\Requests\Auth\UserOtpRequest;
use App\Http\Requests\Auth\UserOtpVerifyRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

class AuthController extends Controller
{
    public function requestUserOtp(UserOtpRequest $request): JsonResponse
    {
        $email = $request->string('email')->trim()->lower()->toString();
        [$property, $message, $status] = $this->resolvePropertyForEmailLogin($email);

        if (! $property) {
            return response()->json([
                'message' => $message,
            ], $status);
        }

        ManagerLoginCode::query()
            ->where('email', $email)
            ->where('purpose', 'email_login')
            ->whereNull('consumed_at')
            ->delete();

        $code = (string) random_int(100000, 999999);

        $loginCode = ManagerLoginCode::query()->create([
            'property_id' => $property->id,
            'email' => $email,
            'code' => Hash::make($code),
            'purpose' => 'email_login',
            'expires_at' => now()->addMinutes(10),
            'ip_address' => $request->ip(),
        ]);

        try {
            Mail::to($email)->send(new ManagerOtpMail(
                code: $code,
                liNumber: $property->li_number,
                propertyTitle: $property->title,
            ));
        } catch (Throwable $exception) {
            $loginCode->delete();

            Log::error('Vergo email-only manager OTP email failed', [
                'email' => $email,
                'property_id' => $property->id,
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
                'li_number' => $property->li_number,
                'property_title' => $property->title,
            ],
        ]);
    }

    public function checkManagerLi(ManagerLiLookupRequest $request): JsonResponse
    {
        $property = Property::query()
            ->where('li_number', $request->string('li_number')->toString())
            ->firstOrFail();

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

    public function requestManagerOtp(ManagerOtpRequest $request): JsonResponse
    {
        $property = Property::query()
            ->where('li_number', $request->string('li_number')->toString())
            ->firstOrFail();

        $email = $request->string('email')->toString();
        $domain = strtolower((string) str($email)->after('@'));

        $isAllowed = $property->managerDomains()
            ->where('domain', $domain)
            ->where('is_active', true)
            ->exists();

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
            Mail::to($email)->send(new ManagerOtpMail(
                code: $code,
                liNumber: $property->li_number,
                propertyTitle: $property->title,
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

        $abilities = ['manager:full', 'orders:view_all', 'orders:update', 'orders:delete'];
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
        $plainCode = $request->string('code')->toString();

        $loginCode = ManagerLoginCode::query()
            ->with('property')
            ->where('email', $email)
            ->where('purpose', 'email_login')
            ->whereNull('consumed_at')
            ->where('expires_at', '>', now())
            ->latest()
            ->first();

        if (! $loginCode || ! Hash::check($plainCode, $loginCode->code)) {
            return response()->json([
                'message' => 'Invalid or expired OTP code.',
            ], 422);
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

        $abilities = ['manager:orders_only', 'orders:view_all', 'orders:create'];
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

        return response()->json([
            'data' => $this->transformUserActor($actor->load('role')),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json([
            'message' => 'Logged out successfully.',
        ]);
    }

    private function resolvePropertyForEmailLogin(string $email): array
    {
        $profileMatches = Property::query()
            ->select('properties.*')
            ->join('property_manager_profiles', 'property_manager_profiles.property_id', '=', 'properties.id')
            ->where('property_manager_profiles.email', $email)
            ->distinct()
            ->get();

        if ($profileMatches->count() > 1) {
            return [null, 'This email is linked to multiple properties. Please use the Li number login.', 409];
        }

        if ($profileMatches->count() === 1) {
            return [$profileMatches->first(), null, 200];
        }

        $domain = strtolower((string) str($email)->after('@'));

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

    private function transformUserActor(User $user): array
    {
        $role = $user->role?->name ?? 'user';

        return [
            'id' => $user->id,
            'type' => 'user',
            'name' => $user->name,
            'email' => $user->email,
            'role' => $role,
            'status' => $user->status,
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
        $mode = in_array('manager:orders_only', $abilities, true) ? 'orders_only' : 'full';

        return [
            'mode' => $mode,
            'navigation_role' => $mode === 'orders_only' ? 'manager_orders_only' : 'manager',
            'home_path' => $mode === 'orders_only' ? '/orders' : '/dashboard',
            'permissions' => [
                'orders' => [
                    'view_all' => true,
                    'create' => $mode === 'orders_only',
                    'edit' => $mode === 'full',
                    'delete' => $mode === 'full',
                ],
            ],
        ];
    }
}
