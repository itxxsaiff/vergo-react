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
        abort_unless($request->user() instanceof User && $request->user()->role?->name === 'admin', 403);

        $employees = User::query()
            ->with('role')
            ->whereHas('role', fn ($query) => $query->where('name', 'employee'))
            ->latest()
            ->get();

        return EmployeeResource::collection($employees);
    }

    public function store(StoreEmployeeRequest $request): EmployeeResource
    {
        abort_unless($request->user() instanceof User && $request->user()->role?->name === 'admin', 403);

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
            ]);
        });

        $employee->load('role');

        return new EmployeeResource($employee);
    }

    public function update(UpdateEmployeeRequest $request, User $employee): EmployeeResource
    {
        abort_unless($request->user() instanceof User && $request->user()->role?->name === 'admin', 403);
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
        abort_unless($request->user() instanceof User && $request->user()->role?->name === 'admin', 403);
        abort_unless($employee->role?->name === 'employee', 404);

        $employee->delete();

        return response()->json([
            'message' => 'Employee deleted successfully.',
        ]);
    }
}
