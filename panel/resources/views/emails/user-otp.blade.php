<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Vergo Login Code</title>
</head>
<body style="margin:0;padding:24px;background:#f8f8fb;font-family:Arial,sans-serif;color:#495057;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
            <td align="center">
                <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;">
                    <tr>
                        <td style="background:#556ee6;padding:24px 32px;color:#ffffff;">
                            <h1 style="margin:0;font-size:22px;font-weight:700;">Vergo Login Code</h1>
                            <p style="margin:8px 0 0;font-size:14px;opacity:0.92;">Use this one-time code to access your Vergo account.</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:32px;">
                            <p style="margin:0 0 12px;font-size:15px;">Hello {{ $userName }},</p>

                            <p style="margin:0 0 12px;font-size:15px;">Your login code</p>
                            <div style="display:inline-block;padding:14px 22px;background:#f1f5ff;border:1px solid #d6dfff;border-radius:10px;font-size:28px;font-weight:700;letter-spacing:8px;color:#556ee6;">
                                {{ $code }}
                            </div>

                            <p style="margin:20px 0 0;font-size:14px;line-height:1.6;">
                                This code expires in {{ $expiresInMinutes }} minutes.
                                If you did not request this code, you can ignore this email.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
