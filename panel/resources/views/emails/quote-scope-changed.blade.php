<!doctype html>
<html lang="de">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2a44;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e8edf4;border-radius:12px;padding:28px;">
        <h1 style="margin:0 0 16px;font-size:20px;">Das Auftragsvolumen hat sich geändert</h1>

        <p style="margin:0 0 16px;line-height:1.5;">
            Guten Tag {{ $provider->company_name }},
        </p>

        <p style="margin:0 0 16px;line-height:1.5;">
            für den Auftrag <strong>{{ $order->order_number ?: '-' }} - {{ $order->title }}</strong>
            wurde der Leistungsumfang durch die Bewirtschaftung angepasst.
            Bitte reichen Sie eine neue Offerte für den aktuellen Umfang ein.
        </p>

        <p style="margin:0 0 16px;line-height:1.5;">
            Der neue Umfang umfasst <strong>{{ $itemCount }}</strong>
            {{ $itemCount === 1 ? 'Position' : 'Positionen' }}.
            Mengen und Einheiten sind bereits hinterlegt - Sie müssen nur noch Ihre Preise eintragen.
        </p>

        <p style="margin:24px 0;">
            <a href="{{ $loginUrl }}"
               style="display:inline-block;background:#95725f;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold;">
                Neue Offerte erstellen
            </a>
        </p>

        <p style="margin:0;color:#64748b;font-size:13px;line-height:1.5;">
            Ihre bisherige Offerte wird erst wieder angezeigt, sobald Sie die neuen Preise eingereicht haben.
        </p>
    </div>
</body>
</html>
