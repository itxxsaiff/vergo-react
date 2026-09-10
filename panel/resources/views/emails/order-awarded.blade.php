<!doctype html>
<html lang="de">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2a44;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e8edf4;border-radius:12px;padding:28px;">
        <h1 style="margin:0 0 16px;font-size:20px;">Ihre Offerte wurde angenommen</h1>

        <p style="margin:0 0 16px;line-height:1.5;">Guten Tag {{ $provider->company_name }},</p>

        <p style="margin:0 0 16px;line-height:1.5;">
            Die Bewirtschaftung hat Ihre Offerte angenommen. Bitte melden Sie sich an und bestätigen Sie den Auftrag
            mit einem Klick - danach können Sie mit der Arbeit starten.
        </p>

        <p style="margin:0 0 16px;line-height:1.5;">
            Auftrag: <strong>{{ $order->order_number ?: '-' }} - {{ $order->title }}</strong>
        </p>

        <p style="margin:24px 0;">
            <a href="{{ $loginUrl }}"
               style="display:inline-block;background:#4a5563;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold;">
                Auftrag annehmen und starten
            </a>
        </p>

        <table style="width:100%;margin-top:24px;padding-top:14px;border-top:1px solid #e8edf4;font-size:13px;color:#64748b;">
            @if($tradeLabel)
                <tr><td style="padding:3px 0;width:180px;">Gewerk</td><td style="padding:3px 0;color:#1f2a44;">{{ $tradeLabel }}</td></tr>
            @endif
            @if($propertyAddress)
                <tr><td style="padding:3px 0;">Adresse</td><td style="padding:3px 0;color:#1f2a44;">{{ $propertyAddress }}</td></tr>
            @endif
            @if($amount)
                <tr><td style="padding:3px 0;">Offertsumme</td><td style="padding:3px 0;color:#1f2a44;">{{ $amount }}</td></tr>
            @endif
            @if($startDate)
                <tr><td style="padding:3px 0;">Voraussichtlicher Start</td><td style="padding:3px 0;color:#1f2a44;">{{ $startDate }}</td></tr>
            @endif
            @if($completionDate)
                <tr><td style="padding:3px 0;">Voraussichtliche Fertigstellung</td><td style="padding:3px 0;color:#1f2a44;">{{ $completionDate }}</td></tr>
            @endif
        </table>

        <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#64748b;">
            Sobald die Arbeit erledigt ist, markieren Sie den Auftrag in Vergo als abgeschlossen.
            Sie erhalten danach alle Angaben, die Sie für die Rechnungsstellung benötigen.
        </p>
    </div>
</body>
</html>
