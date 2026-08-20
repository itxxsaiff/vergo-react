<!doctype html>
<html lang="de">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2a44;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e8edf4;border-radius:12px;padding:28px;">
        <h1 style="margin:0 0 16px;font-size:20px;">
            {{ $isReminder ? 'Erinnerung: Bewertung ausstehend' : 'Der Auftrag wurde abgeschlossen' }}
        </h1>

        <p style="margin:0 0 16px;line-height:1.5;">
            Der Auftrag <strong>{{ $order->order_number ?: '-' }} - {{ $order->title }}</strong>
            wurde von <strong>{{ $providerName }}</strong> als abgeschlossen gemeldet.
        </p>

        <p style="margin:0 0 16px;line-height:1.5;">
            Bitte bewerten Sie die Arbeit mit 1 bis 5 Sternen.
            Bei 1 oder 2 Sternen bitten wir Sie um eine kurze Begründung.
        </p>

        <p style="margin:24px 0;">
            <a href="{{ $ratingUrl }}"
               style="display:inline-block;background:#95725f;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold;">
                Jetzt bewerten
            </a>
        </p>

        <p style="margin:0;color:#64748b;font-size:13px;line-height:1.5;">
            Ihre Bewertung ist vertraulich. Weder der Dienstleister noch andere Auftraggeber sehen sie.
            Sie fliesst ausschliesslich in die interne Vergo-Bewertung ein.
        </p>
    </div>
</body>
</html>
