<!DOCTYPE html>
<html lang="de">

<head>
    <meta charset="UTF-8">
    <title>Vergo Passwort festlegen</title>
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
                                Hallo {{ $employeeName }},
                            </p>

                            <p style="margin:0 0 24px;font-size:15px;line-height:1.7;">
                                Ihr Vergo-Konto ist bereit. Klicken Sie auf die Schaltfläche unten, um Ihr Passwort festzulegen oder zurückzusetzen.
                            </p>

                            <p style="margin:0 0 24px;">
                                <a href="{{ $resetUrl }}"
                                    style="display:inline-block;padding:14px 24px;background:#9f6d54;color:#ffffff;text-decoration:none;border-radius:12px;font-weight:700;font-size:15px;">
                                    Passwort festlegen
                                </a>
                            </p>

                            <p style="margin:0 0 24px;font-size:13px;line-height:1.7;color:#5f6877;">
                                Falls die Schaltfläche nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:<br>
                                <span style="color:#9f6d54;word-break:break-all;">{{ $resetUrl }}</span>
                            </p>

                            <p style="margin:0;font-size:14px;line-height:1.7;color:#5f6877;">
                                Sollten Sie dieses Mail nicht erwartet haben, können Sie es ignorieren.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>

</html>
