<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PropertyManagerProfile;
use App\Models\SupportTicket;
use App\Models\User;
use App\Notifications\SystemNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\Rule;

class SupportTicketController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();
        $isInternal = $actor instanceof User && in_array($actor->role?->name, ['admin', 'employee'], true);

        $tickets = SupportTicket::query()
            ->when(! $isInternal, function ($query) use ($actor) {
                if ($actor instanceof PropertyManagerProfile) {
                    $query->where('property_manager_profile_id', $actor->id);
                    return;
                }

                if ($actor instanceof User) {
                    $query->where('user_id', $actor->id);
                    return;
                }

                $query->whereRaw('1 = 0');
            })
            ->latest()
            ->get()
            ->map(fn (SupportTicket $ticket) => $this->serializeTicket($ticket));

        return response()->json(['data' => $tickets]);
    }

    public function store(Request $request): JsonResponse
    {
        $actor = $request->user();

        $validated = $request->validate([
            'category' => ['nullable', 'string', Rule::in(['general', 'technical', 'order', 'billing'])],
            'priority' => ['nullable', 'string', Rule::in(['normal', 'urgent'])],
            'subject' => ['required', 'string', 'max:255'],
            'message' => ['required', 'string', 'max:5000'],
        ]);

        $ticket = SupportTicket::query()->create([
            'ticket_number' => $this->nextTicketNumber(),
            'user_id' => $actor instanceof User ? $actor->id : null,
            'property_manager_profile_id' => $actor instanceof PropertyManagerProfile ? $actor->id : null,
            'requester_role' => $this->requesterRole($actor),
            'requester_name' => $this->requesterName($actor),
            'requester_email' => $actor?->email,
            'category' => $validated['category'] ?? 'general',
            'priority' => $validated['priority'] ?? 'normal',
            'subject' => $validated['subject'],
            'message' => $validated['message'],
            'status' => 'open',
        ]);

        $recipients = User::query()
            ->whereHas('role', fn ($query) => $query->whereIn('name', ['admin', 'employee']))
            ->get();

        Notification::send($recipients, new SystemNotification(
            title: 'New Support Ticket',
            message: sprintf('%s submitted support ticket %s.', $ticket->requester_name ?: $ticket->requester_email, $ticket->ticket_number),
            type: 'primary',
            actionUrl: '/support-tickets',
        ));

        return response()->json([
            'message' => 'Support ticket submitted successfully.',
            'data' => $this->serializeTicket($ticket),
        ], 201);
    }

    public function update(Request $request, SupportTicket $supportTicket): JsonResponse
    {
        $actor = $request->user();

        abort_unless($actor instanceof User && in_array($actor->role?->name, ['admin', 'employee'], true), 403);

        $validated = $request->validate([
            'status' => ['required', 'string', Rule::in(['open', 'in_progress', 'resolved', 'closed'])],
            'admin_notes' => ['nullable', 'string', 'max:5000'],
        ]);

        $supportTicket->update([
            'status' => $validated['status'],
            'admin_notes' => $validated['admin_notes'] ?? null,
        ]);

        return response()->json([
            'message' => 'Support ticket updated successfully.',
            'data' => $this->serializeTicket($supportTicket->refresh()),
        ]);
    }

    private function nextTicketNumber(): string
    {
        $nextId = ((int) SupportTicket::query()->max('id')) + 1;

        return 'SUP-' . str_pad((string) $nextId, 5, '0', STR_PAD_LEFT);
    }

    private function requesterRole(mixed $actor): ?string
    {
        if ($actor instanceof PropertyManagerProfile) {
            return 'manager';
        }

        if ($actor instanceof User) {
            return $actor->role?->name;
        }

        return null;
    }

    private function requesterName(mixed $actor): ?string
    {
        if ($actor instanceof PropertyManagerProfile) {
            return $actor->name ?: $actor->email;
        }

        if ($actor instanceof User) {
            return $actor->display_name ?: $actor->name ?: $actor->email;
        }

        return null;
    }

    private function serializeTicket(SupportTicket $ticket): array
    {
        return [
            'id' => $ticket->id,
            'ticket_number' => $ticket->ticket_number,
            'requester_role' => $ticket->requester_role,
            'requester_name' => $ticket->requester_name,
            'requester_email' => $ticket->requester_email,
            'category' => $ticket->category,
            'priority' => $ticket->priority,
            'subject' => $ticket->subject,
            'message' => $ticket->message,
            'status' => $ticket->status,
            'admin_notes' => $ticket->admin_notes,
            'created_at' => $ticket->created_at?->toDateTimeString(),
            'updated_at' => $ticket->updated_at?->toDateTimeString(),
        ];
    }
}
