<?php

namespace App\Http\Controllers\Api;

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
                'password' => $request->string('password')->toString(),
                'phone' => $request->input('phone'),
                'status' => $request->input('status', 'active'),
                'access_level' => $request->input('access_level', 'admin'),
            ]);
        });

        $employee->load('role');

        return new EmployeeResource($employee);
    }

    public function update(UpdateEmployeeRequest $request, User $employee): EmployeeResource
    {
        $this->authorizeEmployeeAdminManagement($request);
        abort_unless($employee->role?->name === 'employee', 404);

        $payload = $request->safe()->toArray();

        if (empty($payload['password'])) {
            unset($payload['password']);
        }

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

    private function authorizeEmployeeAdminManagement(Request $request): void
    {
        abort_unless($request->user() instanceof User, 403);

        abort_unless(
            $request->user()->role?->name === 'employee'
            && $request->user()->access_level === 'power_user',
            403
        );
    }
}
