<!DOCTYPE html>
<html lang="de">

<head>
    <meta charset="UTF-8">
    <title>Dein Vergo Login Code</title>
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
                                Hallo {{ $ownerName }},
                            </p>

                            <p style="margin:0 0 14px;font-size:15px;line-height:1.7;">
                                Dein OTP-Code lautet:
                            </p>

                            <div style="display:inline-block;margin:0 0 24px;padding:16px 24px;background:#f7f0ec;border:1px solid #eaded7;border-radius:12px;font-size:30px;font-weight:700;letter-spacing:8px;color:#9f6d54;">
                                {{ $code }}
                            </div>

                            <p style="margin:0;font-size:14px;line-height:1.7;color:#5f6877;">
                                Dieser Code ist {{ $expiresInMinutes }} Minuten gültig. Sollten Sie den Code nicht angefordert haben, können Sie dieses Mail ignorieren.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>

</html>
