<?php

namespace App\Mail;

use App\Models\Bid;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class InspectionNoShowMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public Bid $bid,
        public ?string $appointmentLabel = null,
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            from: new Address(config('mail.orders_from.address'), config('mail.orders_from.name')),
            subject: sprintf(
                'Besichtigungstermin nicht wahrgenommen (%s)',
                $this->bid->order?->order_number ?: $this->bid->order?->title
            ),
        );
    }

    public function content(): Content
    {
        return new Content(view: 'emails.inspection-no-show');
    }
}
