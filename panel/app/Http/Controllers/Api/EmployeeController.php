<?php

namespace App\Http\Controllers\Api;

use App\Mail\EmployeePasswordResetMail;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreEmployeeRequest;
use App\Http\Requests\UpdateEmployeeRequest;
use App\Http\Resources\EmployeeResource;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;

class EmployeeController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorizeEmployeeAdminManagement($request);

        $employees = User::query()
            ->with('role')
            ->whereHas('role', fn ($query) => $query->where('name', 'employee'))
            ->latest()
            ->get();

        return EmployeeResource::collection($employees);
    }

    public function store(StoreEmployeeRequest $request): EmployeeResource
    {
        $this->authorizeEmployeeAdminManagement($request);

        $employee = DB::transaction(function () use ($request) {
            $employeeRole = Role::query()->firstOrCreate(
                ['name' => 'employee'],
                ['label' => 'Employee'],
            );

            return User::query()->create([
                'role_id' => $employeeRole->id,
                'name' => $request->string('name')->toString(),
                'email' => $request->string('email')->toString(),
                'password' => bin2hex(random_bytes(16)),
                'phone' => $request->input('phone'),
                'status' => $request->input('status', 'active'),
                'access_level' => $request->input('access_level', 'admin'),
            ]);
        });

        $employee->load('role');
        $this->sendPasswordResetEmail($employee);

        return new EmployeeResource($employee);
    }

    public function update(UpdateEmployeeRequest $request, User $employee): EmployeeResource
    {
        $this->authorizeEmployeeAdminManagement($request);
        abort_unless($employee->role?->name === 'employee', 404);

        $payload = $request->safe()->toArray();

        $employee->update($payload);
        $employee->load('role');

        return new EmployeeResource($employee);
    }

    public function destroy(Request $request, User $employee): JsonResponse
    {
        $this->authorizeEmployeeAdminManagement($request);
        abort_unless($employee->role?->name === 'employee', 404);

        $employee->delete();

        return response()->json([
            'message' => 'Employee deleted successfully.',
        ]);
    }

    public function sendPasswordReset(Request $request, User $employee): JsonResponse
    {
        $this->authorizeEmployeeAdminManagement($request);
        abort_unless($employee->role?->name === 'employee', 404);

        $this->sendPasswordResetEmail($employee);

        return response()->json([
            'message' => 'Password reset email sent successfully.',
        ]);
    }

    private function authorizeEmployeeAdminManagement(Request $request): void
    {
        $user = $request->user();

        abort_unless($user instanceof User, 403);

        // Superusers are either a real admin account or an employee promoted to
        // power user. Both may manage the admin/employee directory.
        abort_unless(
            $user->role?->name === 'admin'
            || ($user->role?->name === 'employee' && $user->access_level === 'power_user'),
            403
        );
    }

    private function sendPasswordResetEmail(User $employee): void
    {
        $token = Password::broker()->createToken($employee);
        $frontendBase = rtrim(config('app.frontend_url', env('FRONTEND_URL', 'http://localhost:5173')), '/');
        $resetUrl = sprintf(
            '%s/reset-password?token=%s&email=%s',
            $frontendBase,
            urlencode($token),
            urlencode($employee->email)
        );

        Mail::mailer('otp')->to($employee->email)->send(new EmployeePasswordResetMail(
            employeeName: $employee->name,
            resetUrl: $resetUrl,
        ));
    }
}
