<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class EmployeePasswordResetMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public string $employeeName,
        public string $resetUrl,
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Set or Reset Your Vergo Password',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.employee-password-reset',
        );
    }
}
