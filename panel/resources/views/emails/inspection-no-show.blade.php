<!doctype html>
<html lang="de">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2a44;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e8edf4;border-radius:12px;padding:28px;">
        <h1 style="margin:0 0 16px;font-size:20px;">Besichtigungstermin nicht wahrgenommen</h1>

        <p style="margin:0 0 16px;line-height:1.5;">
            Guten Tag {{ $bid->serviceProvider?->company_name }},
        </p>

        <p style="margin:0 0 16px;line-height:1.5;">
            für den Auftrag <strong>{{ $bid->order?->order_number ?: '-' }} - {{ $bid->order?->title }}</strong>
            wurde festgehalten, dass der von Ihnen bestätigte Besichtigungstermin
            @if($appointmentLabel)
                (<strong>{{ $appointmentLabel }}</strong>)
            @endif
            nicht wahrgenommen wurde.
        </p>

        <div style="margin:0 0 16px;padding:14px 16px;background:#fdf3f2;border:1px solid #f3d6d2;border-radius:8px;line-height:1.5;">
            Dies wirkt sich <strong>negativ auf das VERGO-Ranking</strong> Ihrer Firma aus.
        </div>

        <p style="margin:0;color:#64748b;font-size:13px;line-height:1.5;">
            Sollte es sich um ein Missverständnis handeln, wenden Sie sich bitte direkt an die Bewirtschaftung.
        </p>
    </div>
</body>
</html>
