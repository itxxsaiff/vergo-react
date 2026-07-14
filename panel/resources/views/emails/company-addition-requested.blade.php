<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <title>Neue Firmenanfrage</title>
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
                            <h1 style="margin:0 0 18px;font-size:20px;">Neue Firmenanfrage</h1>
                            <p style="margin:0 0 18px;font-size:15px;line-height:1.7;">
                                {{ $manager?->name ?: $manager?->email ?: 'Ein Immobilienverwalter' }} hat eine Firma zur Anlage angefragt.
                            </p>
                            <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:14px;">
                                <tr><td style="padding:7px 0;color:#555;width:150px;">Firma:</td><td style="padding:7px 0;font-weight:700;">{{ $companyRequest->company_name }}</td></tr>
                                <tr><td style="padding:7px 0;color:#555;">Kontakt:</td><td style="padding:7px 0;font-weight:700;">{{ $companyRequest->contact_name ?: '-' }}</td></tr>
                                <tr><td style="padding:7px 0;color:#555;">E-Mail:</td><td style="padding:7px 0;font-weight:700;">{{ $companyRequest->email ?: '-' }}</td></tr>
                                <tr><td style="padding:7px 0;color:#555;">Telefon:</td><td style="padding:7px 0;font-weight:700;">{{ $companyRequest->phone ?: '-' }}</td></tr>
                                <tr><td style="padding:7px 0;color:#555;">Ort/Kanton:</td><td style="padding:7px 0;font-weight:700;">{{ trim(($companyRequest->city ?: '-') . ' ' . ($companyRequest->canton ?: '')) }}</td></tr>
                                <tr><td style="padding:7px 0;color:#555;">Liegenschaft:</td><td style="padding:7px 0;font-weight:700;">{{ $property?->li_number ?: '-' }} {{ $property?->title ?: '' }}</td></tr>
                                <tr><td style="padding:7px 0;color:#555;">Notizen:</td><td style="padding:7px 0;font-weight:700;">{{ $companyRequest->notes ?: '-' }}</td></tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
