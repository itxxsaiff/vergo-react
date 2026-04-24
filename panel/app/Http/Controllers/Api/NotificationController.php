<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();

        $notifications = $actor->notifications()
            ->latest()
            ->take(15)
            ->get()
            ->map(fn ($notification) => [
                'id' => $notification->id,
                'title' => data_get($notification->data, 'title'),
                'message' => data_get($notification->data, 'message'),
                'type' => data_get($notification->data, 'type', 'info'),
                'action_url' => data_get($notification->data, 'action_url'),
                'read_at' => $notification->read_at?->toDateTimeString(),
                'created_at' => $notification->created_at?->toDateTimeString(),
            ])
            ->values();

        return response()->json([
            'data' => [
                'items' => $notifications,
                'unread_count' => $actor->unreadNotifications()->count(),
            ],
        ]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $request->user()->unreadNotifications->markAsRead();

        return response()->json([
            'message' => 'Notifications marked as read.',
        ]);
    }
}
