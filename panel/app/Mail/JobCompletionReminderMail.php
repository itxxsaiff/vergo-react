<?php

namespace App\Mail;

use App\Models\Bid;
use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Today is the completion date the company gave. A nudge to close the job in
 * Vergo, which is what releases their invoicing details.
 */
class JobCompletionReminderMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public Order $order,
        public Bid $bid,
        public string $loginUrl,
        public ?string $propertyAddress = null,
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            from: new Address(config('mail.orders_from.address'), config('mail.orders_from.name')),
            subject: sprintf(
                'Erinnerung: Auftrag heute abschliessen (%s)',
                $this->order->order_number ?: $this->order->title,
            ),
        );
    }

    public function content(): Content
    {
        return new Content(view: 'emails.job-completion-reminder');
    }
}
