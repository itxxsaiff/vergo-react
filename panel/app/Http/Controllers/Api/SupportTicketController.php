<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PropertyManagerProfile;
use App\Models\SupportTicket;
use App\Models\User;
use App\Notifications\SystemNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
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
            'first_name' => ['nullable', 'string', 'max:120'],
            'last_name' => ['nullable', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:80'],
            'requester_email' => ['required', 'email', 'max:255'],
            'subject' => ['required', 'string', 'max:255'],
            'message' => ['required', 'string', 'max:5000'],
        ]);

        $firstName = trim((string) ($validated['first_name'] ?? ''));
        $lastName = trim((string) ($validated['last_name'] ?? ''));
        $requesterEmail = strtolower(trim((string) ($validated['requester_email'] ?? $actor?->email ?? '')));
        $requesterName = trim(implode(' ', array_filter([$firstName, $lastName]))) ?: $this->requesterName($actor);

        $ticket = SupportTicket::query()->create([
            'ticket_number' => $this->nextTicketNumber(),
            'user_id' => $actor instanceof User ? $actor->id : null,
            'property_manager_profile_id' => $actor instanceof PropertyManagerProfile ? $actor->id : null,
            'requester_role' => $this->requesterRole($actor),
            'requester_name' => $requesterName ?: $requesterEmail,
            'requester_email' => $requesterEmail ?: null,
            'first_name' => $firstName ?: null,
            'last_name' => $lastName ?: null,
            'phone' => $validated['phone'] ?? null,
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
            'admin_comment' => ['nullable', 'string', 'max:5000'],
        ]);

        $previousStatus = $supportTicket->status;
        $previousComment = (string) ($supportTicket->admin_comment ?? '');
        $nextComment = (string) ($validated['admin_comment'] ?? '');

        $supportTicket->update([
            'status' => $validated['status'],
            'admin_notes' => $validated['admin_notes'] ?? null,
            'admin_comment' => $validated['admin_comment'] ?? null,
        ]);

        $supportTicket->refresh();

        if ($previousStatus !== $supportTicket->status) {
            $this->notifyRequester(
                $supportTicket,
                'Support Ticket Status Updated',
                sprintf(
                    'The status of your support ticket %s changed from %s to %s.',
                    $supportTicket->ticket_number,
                    $this->statusLabel($previousStatus),
                    $this->statusLabel($supportTicket->status),
                ),
                'status',
                $previousStatus,
            );
        }

        if (trim($nextComment) !== '' && trim($nextComment) !== trim($previousComment)) {
            $this->notifyRequester(
                $supportTicket,
                'New Support Ticket Message',
                sprintf('A new message was added to your support ticket %s.', $supportTicket->ticket_number),
                'comment',
            );
        }

        return response()->json([
            'message' => 'Support ticket updated successfully.',
            'data' => $this->serializeTicket($supportTicket),
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
            'first_name' => $ticket->first_name,
            'last_name' => $ticket->last_name,
            'phone' => $ticket->phone,
            'category' => $ticket->category,
            'priority' => $ticket->priority,
            'subject' => $ticket->subject,
            'message' => $ticket->message,
            'status' => $ticket->status,
            'admin_notes' => $ticket->admin_notes,
            'admin_comment' => $ticket->admin_comment,
            'created_at' => $ticket->created_at?->toDateTimeString(),
            'updated_at' => $ticket->updated_at?->toDateTimeString(),
        ];
    }

    private function notifyRequester(
        SupportTicket $ticket,
        string $title,
        string $message,
        string $eventType,
        ?string $previousStatus = null,
    ): void {
        $recipient = $ticket->user ?: $ticket->propertyManagerProfile;

        if ($recipient) {
            $recipient->notify(new SystemNotification(
                title: $title,
                message: $message,
                type: 'primary',
            ));
        }

        $this->sendRequesterEmail($ticket, $title, $message, $eventType, $previousStatus);
    }

    private function sendRequesterEmail(
        SupportTicket $ticket,
        string $title,
        string $message,
        string $eventType,
        ?string $previousStatus = null,
    ): void {
        if (! $ticket->requester_email) {
            return;
        }

        try {
            Mail::mailer('orders')->html(
                view('emails.support-ticket-updated', [
                    'ticket' => $ticket,
                    'title' => $title,
                    'messageText' => $message,
                    'eventType' => $eventType,
                    'previousStatus' => $previousStatus ? $this->statusLabel($previousStatus) : null,
                    'currentStatus' => $this->statusLabel($ticket->status),
                ])->render(),
                function ($mailMessage) use ($ticket, $title) {
                    $mailMessage
                        ->from(config('mail.orders_from.address'), config('mail.orders_from.name'))
                        ->to($ticket->requester_email, $ticket->requester_name ?: null)
                        ->subject(sprintf('%s - %s', $title, $ticket->ticket_number));
                }
            );
        } catch (\Throwable $exception) {
            Log::error('Vergo support ticket requester email failed', [
                'support_ticket_id' => $ticket->id,
                'ticket_number' => $ticket->ticket_number,
                'requester_email' => $ticket->requester_email,
                'event_type' => $eventType,
                'error' => $exception->getMessage(),
            ]);
        }
    }

    private function statusLabel(?string $status): string
    {
        return match ($status) {
            'open' => 'Open',
            'in_progress' => 'In Progress',
            'resolved' => 'Resolved',
            'closed' => 'Closed',
            default => $status ?: '-',
        };
    }
}
