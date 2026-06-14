<!DOCTYPE html>
<html lang="de">

<head>
    <meta charset="UTF-8">
    <title>Vergo Auftragsbenachrichtigung</title>
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
                            <p style="margin:0 0 22px;font-size:15px;">
                                Guten Tag {{ $provider->company_name }},
                            </p>

                            <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#2f3441;font-weight:700;">
                                {{ $noticeType === 'assigned'
                                    ? 'Eine Anfrage aus Ihrer Branche wurde Ihnen direkt zugewiesen.'
                                    : 'Eine Anfrage aus Ihrer Branche wurde veröffentlicht.' }}
                            </p>

                            <p style="margin:0 0 28px;font-size:15px;line-height:1.7;">
                                Bitte melden Sie sich zur Bearbeitung der Anfrage auf der Vergo-Plattform an.
                            </p>

                            <table width="100%" cellspacing="0" cellpadding="0"
                                style="margin:0 0 28px;border-collapse:collapse;">
                                <tr>
                                    <td style="padding:7px 0;width:120px;color:#555;font-size:14px;">Branche:</td>
                                    <td style="padding:7px 0;font-weight:700;font-size:14px;">
                                        {{ config('vergo.job_type_labels.' . $order->service_type, $order->service_type ?: '-') }}
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:7px 0;color:#555;font-size:14px;">PLZ:</td>
                                    <td style="padding:7px 0;font-weight:700;font-size:14px;">
                                        {{ $order->property?->postal_code ?: '-' }}</td>
                                </tr>
                                <tr>
                                    <td style="padding:7px 0;color:#555;font-size:14px;">Ort:</td>
                                    <td style="padding:7px 0;font-weight:700;font-size:14px;">
                                        {{ $order->property?->city ?: '-' }}</td>
                                </tr>
                            </table>

                            <p style="margin:0;">
                                <a href="{{ $loginUrl }}"
                                    style="display:inline-block;padding:13px 22px;background:#9f6d54;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;">
                                    Einloggen
                                </a>
                            </p>
                        </td>
                    </tr>

                </table>

            </td>
        </tr>
    </table>
</body>

</html>
