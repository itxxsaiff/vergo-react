<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <title>Firmenanfrage bearbeitet</title>
</head>
<body style="margin:0;padding:24px;background:#f8f8fb;font-family:Arial,sans-serif;color:#2f3441;">
    <table width="100%" cellspacing="0" cellpadding="0">
        <tr>
            <td align="center">
                <table width="580" cellspacing="0" cellpadding="0" style="max-width:580px;background:#ffffff;border-radius:14px;border:1px solid #eaded7;">
                    <tr>
                        <td style="background:#9f6d54;padding:22px 32px;border-radius:14px 14px 0 0;">
                            <img src="{{ asset('VERGO.png') }}" alt="Vergo Logo" style="height:42px;display:block;">
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:32px 40px;">
                            <p style="margin:0 0 18px;font-size:15px;">Guten Tag {{ $manager?->name ?: '' }},</p>
                            <h1 style="margin:0 0 18px;font-size:20px;">Ihre Firmenanfrage wurde bearbeitet</h1>
                            <p style="margin:0 0 18px;font-size:15px;line-height:1.7;">
                                Die Anfrage für <strong>{{ $companyRequest->company_name }}</strong> wurde durch das Vergo-Team bearbeitet.
                            </p>
                            <p style="margin:0;font-size:15px;line-height:1.7;color:#555;">
                                Status: <strong>{{ $companyRequest->status === 'completed' ? 'Firma wurde angelegt' : 'Anfrage wurde geprüft' }}</strong>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
