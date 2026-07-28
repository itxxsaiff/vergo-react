<!DOCTYPE html>
<html lang="de">

<head>
    <meta charset="UTF-8">
    <title>{{ $title }}</title>
</head>

<body style="margin:0;padding:24px;background:#f8f8fb;font-family:Arial,sans-serif;color:#2f3441;">
    <table width="100%" cellspacing="0" cellpadding="0">
        <tr>
            <td align="center">
                <table width="580" cellspacing="0" cellpadding="0"
                    style="max-width:580px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #eaded7;">
                    <tr>
                        <td style="background:#9f6d54;padding:22px 32px;">
                            <img src="{{ asset('VERGO.png') }}" alt="Vergo Logo" style="height:42px;display:block;">
                        </td>
                    </tr>

                    <tr>
                        <td style="padding:34px 40px;">
                            <p style="margin:0 0 18px;font-size:15px;line-height:1.7;">
                                Guten Tag{{ $ticket->requester_name ? ' ' . $ticket->requester_name : '' }},
                            </p>

                            <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#2f3441;font-weight:700;">
                                {{ $title }}
                            </p>

                            <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#2f3441;">
                                {{ $messageText }}
                            </p>

                            <table width="100%" cellspacing="0" cellpadding="0"
                                style="margin:0 0 24px;border-collapse:collapse;background:#fbf8f6;border:1px solid #eaded7;border-radius:12px;overflow:hidden;">
                                <tr>
                                    <td style="padding:14px 18px;width:150px;color:#6b7280;font-size:14px;border-bottom:1px solid #eaded7;">
                                        Ticket
                                    </td>
                                    <td style="padding:14px 18px;font-weight:700;font-size:14px;border-bottom:1px solid #eaded7;color:#2f3441;">
                                        {{ $ticket->ticket_number }}
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:14px 18px;width:150px;color:#6b7280;font-size:14px;">
                                        Anliegen
                                    </td>
                                    <td style="padding:14px 18px;font-weight:700;font-size:14px;color:#2f3441;">
                                        {{ $ticket->subject ?: '-' }}
                                    </td>
                                </tr>
                            </table>

                            @if ($eventType === 'status')
                                <table width="100%" cellspacing="0" cellpadding="0"
                                    style="margin:0 0 24px;border-collapse:collapse;">
                                    <tr>
                                        <td style="padding:0 8px 0 0;width:50%;">
                                            <div style="padding:16px;background:#f8f8fb;border:1px solid #eaded7;border-radius:12px;">
                                                <div style="margin:0 0 8px;color:#6b7280;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;">
                                                    Previous status
                                                </div>
                                                <div style="display:inline-block;padding:7px 12px;background:#ffffff;border:1px solid #eaded7;border-radius:999px;color:#2f3441;font-weight:700;font-size:14px;">
                                                    {{ $previousStatus ?: '-' }}
                                                </div>
                                            </div>
                                        </td>
                                        <td style="padding:0 0 0 8px;width:50%;">
                                            <div style="padding:16px;background:#f7f0ec;border:1px solid #d9b9a8;border-radius:12px;">
                                                <div style="margin:0 0 8px;color:#9f6d54;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;">
                                                    Current status
                                                </div>
                                                <div style="display:inline-block;padding:7px 12px;background:#9f6d54;border:1px solid #9f6d54;border-radius:999px;color:#ffffff;font-weight:700;font-size:14px;">
                                                    {{ $currentStatus }}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                </table>
                            @endif

                            @if ($eventType === 'comment' && $ticket->admin_comment)
                                <div style="margin:0 0 24px;padding:18px 20px;background:#f7f0ec;border:1px solid #eaded7;border-left:4px solid #9f6d54;border-radius:12px;">
                                    <div style="margin:0 0 10px;color:#9f6d54;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;">
                                        Message
                                    </div>
                                    <div style="white-space:pre-wrap;font-size:15px;line-height:1.7;color:#2f3441;">{{ $ticket->admin_comment }}</div>
                                </div>
                            @endif

                            <p style="margin:0 0 6px;font-size:14px;line-height:1.7;color:#5f6877;">
                                Freundliche Grusse
                            </p>
                            <p style="margin:0;font-size:14px;line-height:1.7;color:#2f3441;font-weight:700;">
                                Vergo Team
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>

</html>
