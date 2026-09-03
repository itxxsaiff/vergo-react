<!doctype html>
<html lang="de">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2a44;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e8edf4;border-radius:12px;padding:28px;">
        <h1 style="margin:0 0 16px;font-size:20px;">Der Leistungsumfang hat sich geändert</h1>

        <p style="margin:0 0 16px;line-height:1.5;">Guten Tag {{ $provider->company_name }},</p>

        <p style="margin:0 0 16px;line-height:1.5;">
            Der Leistungsumfang eines Auftrags, für den Sie eine Offerte eingereicht haben, hat sich geändert.
            Bitte melden Sie sich an, um Ihre Offerte für diesen Auftrag zu aktualisieren.
        </p>

        <p style="margin:0 0 16px;line-height:1.5;">
            Auftrag: <strong>{{ $order->order_number ?: '-' }} - {{ $order->title }}</strong><br>
            Neuer Umfang: <strong>{{ $itemCount }}</strong> {{ $itemCount === 1 ? 'Position' : 'Positionen' }}.
            Mengen und Einheiten sind hinterlegt - Sie müssen nur Ihre Preise eintragen.
        </p>

        <p style="margin:24px 0;">
            <a href="{{ $loginUrl }}"
               style="display:inline-block;background:#95725f;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold;">
                Offerte aktualisieren
            </a>
        </p>

        <table style="width:100%;margin-top:24px;padding-top:14px;border-top:1px solid #e8edf4;font-size:13px;color:#64748b;">
            @if($tradeLabel)
                <tr>
                    <td style="padding:3px 0;width:150px;">Gewerk</td>
                    <td style="padding:3px 0;color:#1f2a44;">{{ $tradeLabel }}</td>
                </tr>
            @endif
            @if($propertyAddress)
                <tr>
                    <td style="padding:3px 0;">Adresse</td>
                    <td style="padding:3px 0;color:#1f2a44;">{{ $propertyAddress }}</td>
                </tr>
            @endif
            @if($originalQuoteEmail)
                <tr>
                    <td style="padding:3px 0;">Offerte eingereicht von</td>
                    <td style="padding:3px 0;color:#1f2a44;">{{ $originalQuoteEmail }}</td>
                </tr>
            @endif
        </table>
    </div>
</body>
</html>
