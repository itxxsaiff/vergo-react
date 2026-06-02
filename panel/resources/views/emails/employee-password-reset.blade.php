<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Vergo Password Reset</title>
</head>
<body style="margin:0;padding:24px;background:#f8f8fb;font-family:Arial,sans-serif;color:#495057;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
            <td align="center">
                <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;">
                    <tr>
                        <td style="background:#556ee6;padding:24px 32px;color:#ffffff;">
                            <h1 style="margin:0;font-size:22px;font-weight:700;">Vergo Password Setup</h1>
                            <p style="margin:8px 0 0;font-size:14px;opacity:0.92;">Use the link below to create or reset your password.</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:32px;">
                            <p style="margin:0 0 12px;font-size:15px;">Hello {{ $employeeName }},</p>

                            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
                                Your Vergo account is ready. Click the button below to set a new password.
                            </p>

                            <p style="margin:0 0 20px;">
                                <a href="{{ $resetUrl }}" style="display:inline-block;padding:14px 22px;background:#556ee6;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;">
                                    Set Password
                                </a>
                            </p>

                            <p style="margin:0;font-size:14px;line-height:1.6;">
                                If you did not expect this email, you can ignore it.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
