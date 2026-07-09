<?php

namespace App\Mail;

use App\Models\Bid;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class InspectionAppointmentConfirmedMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(public Bid $bid)
    {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            from: new Address(config('mail.orders_from.address'), config('mail.orders_from.name')),
            subject: 'Besichtigungstermin bestätigt',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.inspection-appointment-confirmed',
        );
    }
}
