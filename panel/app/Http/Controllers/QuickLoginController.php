<?php

namespace App\Http\Controllers;

use App\Models\Property;
use App\Models\PropertyManagerProfile;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class QuickLoginController extends Controller
{
    public function index(Request $request): View
    {
        $frontendUrl = $this->normalizeFrontendUrl(
            $request->query('frontend_url', $this->defaultFrontendUrl())
        );

        return view('quick-login.index', [
            'frontendUrl' => $frontendUrl,
            'properties' => $this->propertyRows(),
            'users' => $this->userRows(),
        ]);
    }

    public function login(Request $request): RedirectResponse
    {
        $frontendUrl = $this->normalizeFrontendUrl(
            $request->input('frontend_url', $this->defaultFrontendUrl())
        );
        $loginType = $request->input('login_type', 'user');

        if ($loginType === 'property') {
            $property = Property::query()
                ->with(['assignedManagerProfile', 'managerProfiles'])
                ->find((int) $request->input('property_id'));

            if (! $property) {
                return back()->withErrors(['login' => 'Property not found.'])->withInput();
            }

            $manager = $this->ensureManagerProfile($property);
            $manager->forceFill(['last_login_at' => now()])->save();

            $token = $manager->createToken(
                'vergo-manager',
                $this->managerAbilitiesForProperty($property)
            )->plainTextToken;

            return redirect()->away(
                $this->frontendBridgeUrl($frontendUrl, $token, $this->frontendTargetUrl($frontendUrl, '/dashboard'))
            );
        }

        $user = User::query()
            ->with(['role', 'serviceProvider'])
            ->find((int) $request->input('user_id'));

        if (! $user) {
            return back()->withErrors(['login' => 'User not found.'])->withInput();
        }

        $token = $user->createToken('vergo-user')->plainTextToken;

        return redirect()->away(
            $this->frontendBridgeUrl($frontendUrl, $token, $this->frontendTargetUrl($frontendUrl, $this->userHomePath($user)))
        );
    }

    private function propertyRows(): array
    {
        return Property::query()
            ->with(['assignedManagerProfile', 'managerProfiles'])
            ->orderBy('id')
            ->get()
            ->map(function (Property $property): array {
                $manager = $this->propertyManager($property);

                return [
                    'id' => $property->id,
                    'li_number' => $property->li_number,
                    'title' => $property->title,
                    'management' => $property->management,
                    'address_line_1' => $property->address_line_1,
                    'address_line_2' => $property->address_line_2,
                    'postal_code' => $property->postal_code,
                    'city' => $property->city,
                    'status' => $property->status,
                    'manager_profile_id' => $manager?->id,
                    'manager_name' => $manager?->name,
                    'manager_email' => $manager?->email,
                    'manager_phone' => $manager?->phone,
                ];
            })
            ->all();
    }

    private function userRows(): array
    {
        return User::query()
            ->with('role')
            ->orderBy('id')
            ->get()
            ->map(fn (User $user): array => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'company_name' => $user->company_name,
                'status' => $user->status,
                'role_name' => $this->userRole($user),
            ])
            ->all();
    }

    private function propertyManager(Property $property): ?PropertyManagerProfile
    {
        return $property->assignedManagerProfile ?: $property->managerProfiles->first();
    }

    private function ensureManagerProfile(Property $property): PropertyManagerProfile
    {
        $manager = $this->propertyManager($property);

        if ($manager) {
            if (! $property->property_manager_profile_id) {
                $property->forceFill(['property_manager_profile_id' => $manager->id])->save();
            }

            return $manager;
        }

        $manager = PropertyManagerProfile::query()->create([
            'property_id' => $property->id,
            'name' => $property->management ?: (($property->title ?: $property->li_number).' Manager'),
            'email' => 'li-'.$property->id.'@vergo.local',
            'last_login_at' => now(),
        ]);

        $property->forceFill(['property_manager_profile_id' => $manager->id])->save();

        return $manager;
    }

    private function managerAbilitiesForProperty(Property $property): array
    {
        return [
            'manager:full',
            'orders:view_all',
            'orders:create',
            'orders:update',
            'orders:delete',
            'property:'.$property->id,
        ];
    }

    private function userRole(User $user): string
    {
        return $user->role?->name ?? 'user';
    }

    private function userHomePath(User $user): string
    {
        return $this->userRole($user) === 'owner' ? '/properties' : '/dashboard';
    }

    private function normalizeFrontendUrl(?string $url): string
    {
        $url = trim((string) $url);

        if ($url === '') {
            $url = $this->defaultFrontendUrl();
        }

        if (! preg_match('/^https?:\/\//i', $url)) {
            $url = 'http://'.$url;
        }

        $parts = parse_url($url);
        $scheme = $parts['scheme'] ?? 'http';
        $host = $parts['host'] ?? 'localhost';
        $port = isset($parts['port']) ? ':'.$parts['port'] : '';
        $path = rtrim($parts['path'] ?? '', '/');

        if (in_array($path, ['/dashboard', '/type', '/login', '/properties'], true)) {
            $path = '';
        }

        return rtrim($scheme.'://'.$host.$port.$path, '/');
    }

    private function defaultFrontendUrl(): string
    {
        return rtrim((string) config('app.frontend_url', 'https://work.vergo.ch'), '/');
    }

    private function frontendTargetUrl(string $frontendUrl, string $path): string
    {
        return rtrim($frontendUrl, '/').'/'.ltrim($path, '/');
    }

    private function frontendBridgeUrl(string $frontendUrl, string $token, string $targetUrl): string
    {
        return $this->frontendTargetUrl($frontendUrl, '/login-bridge.html')
            .'#token='.rawurlencode($token)
            .'&next='.rawurlencode($targetUrl);
    }
}
