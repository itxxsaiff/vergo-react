<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Vergo owner login code</title>
</head>
<body style="margin:0;padding:24px;background:#f5f7fb;font-family:Arial,sans-serif;color:#213547;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;border:1px solid #e5eaf3;">
        <p style="margin:0 0 12px;font-size:14px;color:#8a94a6;">Vergo</p>
        <h1 style="margin:0 0 12px;font-size:24px;line-height:1.3;">Your login code</h1>
        <p style="margin:0 0 20px;font-size:16px;line-height:1.6;">
            Use this code to sign in to your owner account{{ $liNumber ? " for {$liNumber}" : '' }}.
        </p>
        <p style="margin:0 0 24px;font-size:16px;font-weight:700;">{{ $ownerName }}</p>
        <div style="margin:0 0 24px;padding:18px 20px;background:#f3f6fb;border-radius:12px;font-size:30px;letter-spacing:8px;font-weight:700;text-align:center;">
            {{ $code }}
        </div>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#677489;">
            The code expires in {{ $expiresInMinutes }} minutes. If you did not request this login, you can ignore this email.
        </p>
    </div>
</body>
</html>
