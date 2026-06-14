<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class OwnerOtpMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public string $code,
        public string $ownerName,
        public ?string $liNumber = null,
        public int $expiresInMinutes = 10,
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            from: new Address(config('mail.otp_from.address'), config('mail.otp_from.name')),
            subject: 'Dein Vergo Login Code',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.owner-otp',
        );
    }
}
