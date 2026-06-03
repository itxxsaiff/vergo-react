<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Vergo order notice</title>
</head>
<body style="margin:0;padding:24px;background:#f8f8fb;font-family:Arial,sans-serif;color:#2f3441;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
            <td align="center">
                <table role="presentation" width="580" cellspacing="0" cellpadding="0" style="max-width:580px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #eaded7;">
                    <tr>
                        <td style="background:#9f6d54;padding:24px 32px;color:#ffffff;">
                            <h1 style="margin:0;font-size:22px;font-weight:700;">Vergo</h1>
                            <p style="margin:8px 0 0;font-size:14px;opacity:0.94;">
                                {{ $noticeType === 'assigned' ? 'A request has been assigned to your company.' : 'A public request has been published.' }}
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:32px;">
                            <p style="margin:0 0 12px;font-size:15px;">Hello {{ $provider->company_name }},</p>

                            <p style="margin:0 0 18px;font-size:15px;line-height:1.6;">
                                {{ $noticeType === 'assigned'
                                    ? 'A property manager selected your company for this request. Please log in to accept or decline it.'
                                    : 'A property manager published a public request. Please log in to review the details.' }}
                            </p>

                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 22px;border-collapse:collapse;">
                                <tr>
                                    <td style="padding:8px 0;color:#7f8596;font-size:13px;">Trade</td>
                                    <td style="padding:8px 0;font-weight:700;font-size:14px;">{{ $order->service_type }}</td>
                                </tr>
                                <tr>
                                    <td style="padding:8px 0;color:#7f8596;font-size:13px;">ZIP code</td>
                                    <td style="padding:8px 0;font-weight:700;font-size:14px;">{{ $order->property?->postal_code ?: '-' }}</td>
                                </tr>
                                <tr>
                                    <td style="padding:8px 0;color:#7f8596;font-size:13px;">City</td>
                                    <td style="padding:8px 0;font-weight:700;font-size:14px;">{{ $order->property?->city ?: '-' }}</td>
                                </tr>
                            </table>

                            <p style="margin:0 0 22px;">
                                <a href="{{ $loginUrl }}" style="display:inline-block;padding:13px 20px;background:#9f6d54;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;">
                                    Open Vergo login
                                </a>
                            </p>

                            <p style="margin:0;font-size:13px;line-height:1.6;color:#7f8596;">
                                Enter an email address with your approved domain, request the OTP code, and then open the request details.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
