<!doctype html>
<html lang="de">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2a44;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e8edf4;border-radius:12px;padding:28px;">
        <h1 style="margin:0 0 16px;font-size:20px;">Der Auftrag wurde abgesagt</h1>

        <p style="margin:0 0 16px;line-height:1.5;">Guten Tag {{ $provider->company_name }},</p>

        <p style="margin:0 0 16px;line-height:1.5;">
            der Auftrag <strong>{{ $order->order_number ?: '-' }} - {{ $order->title }}</strong>
            wurde von der Bewirtschaftung abgesagt. Ihre eingereichte Offerte wird nicht weiter berücksichtigt.
        </p>

        <div style="margin:0 0 16px;padding:14px 16px;background:#fbf7f4;border:1px solid #eae2dd;border-radius:8px;">
            <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#8a94a8;margin-bottom:6px;">Begründung</div>
            <div style="line-height:1.5;">{{ $reason }}</div>
        </div>

        <p style="margin:0;color:#64748b;font-size:13px;line-height:1.5;">
            Vielen Dank für Ihren Aufwand. Weitere Ausschreibungen finden Sie jederzeit in Ihrem Vergo-Konto.
        </p>
    </div>
</body>
</html>
