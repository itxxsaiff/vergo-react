<!doctype html>
<html lang="de">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2a44;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e8edf4;border-radius:12px;padding:28px;">
        <h1 style="margin:0 0 16px;font-size:20px;">Ihr Auftrag wurde erstellt</h1>

        <p style="margin:0 0 16px;line-height:1.5;">Guten Tag {{ $provider->company_name }},</p>

        <p style="margin:0 0 16px;line-height:1.5;">
            Ihre Offerte aus der Besichtigung wurde unverändert übernommen - Ihre Positionen und Preise bleiben bestehen.
            Bitte melden Sie sich an und erfassen Sie noch das <strong>voraussichtliche Startdatum</strong> und das
            <strong>voraussichtliche Fertigstellungsdatum</strong>.
        </p>

        <p style="margin:0 0 16px;line-height:1.5;">
            Auftrag: <strong>{{ $order->order_number ?: '-' }} - {{ $order->title }}</strong>
        </p>

        <p style="margin:24px 0;">
            <a href="{{ $loginUrl }}"
               style="display:inline-block;background:#4a5563;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold;">
                Termine erfassen
            </a>
        </p>

        <table style="width:100%;margin-top:24px;padding-top:14px;border-top:1px solid #e8edf4;font-size:13px;color:#64748b;">
            @if($tradeLabel)
                <tr><td style="padding:3px 0;width:170px;">Gewerk</td><td style="padding:3px 0;color:#1f2a44;">{{ $tradeLabel }}</td></tr>
            @endif
            @if($propertyAddress)
                <tr><td style="padding:3px 0;">Adresse</td><td style="padding:3px 0;color:#1f2a44;">{{ $propertyAddress }}</td></tr>
            @endif
            @if($completionDeadline)
                <tr><td style="padding:3px 0;">Fertigstellung bis</td><td style="padding:3px 0;color:#1f2a44;">{{ $completionDeadline }}</td></tr>
            @endif
        </table>
    </div>
</body>
</html>
