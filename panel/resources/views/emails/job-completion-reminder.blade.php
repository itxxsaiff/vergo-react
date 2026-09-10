<!doctype html>
<html lang="de">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2a44;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e8edf4;border-radius:12px;padding:28px;">
        <h1 style="margin:0 0 16px;font-size:20px;">Auftrag heute abschliessen?</h1>

        <p style="margin:0 0 16px;line-height:1.5;">Guten Tag {{ $bid->serviceProvider?->company_name }},</p>

        <p style="margin:0 0 16px;line-height:1.5;">
            Sie haben den <strong>{{ $bid->estimated_completion_date?->format('d.m.Y') }}</strong> als
            voraussichtliches Fertigstellungsdatum angegeben. Wenn die Arbeit erledigt ist, markieren Sie den
            Auftrag bitte in Vergo als abgeschlossen.
        </p>

        <p style="margin:0 0 16px;line-height:1.5;">
            Auftrag: <strong>{{ $order->order_number ?: '-' }} - {{ $order->title }}</strong>
            @if($propertyAddress)<br>{{ $propertyAddress }}@endif
        </p>

        <p style="margin:24px 0;">
            <a href="{{ $loginUrl }}"
               style="display:inline-block;background:#4a5563;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold;">
                Auftrag als erledigt markieren
            </a>
        </p>

        <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
            Direkt danach erhalten Sie alle Angaben für die Rechnungsstellung - Adresse, Eigentümer,
            Rechnungsempfänger und die erfassten Positionen.
            Dauert die Arbeit länger, können Sie diese Erinnerung ignorieren.
        </p>
    </div>
</body>
</html>
