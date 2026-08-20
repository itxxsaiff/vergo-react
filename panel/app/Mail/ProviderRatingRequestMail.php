<?php

namespace App\Mail;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ProviderRatingRequestMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public Order $order,
        public string $providerName,
        public string $ratingUrl,
        public bool $isReminder = false,
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            from: new Address(config('mail.orders_from.address'), config('mail.orders_from.name')),
            subject: ($this->isReminder ? 'Erinnerung: ' : '')
                .sprintf('Bitte bewerten Sie den Dienstleister (%s)', $this->order->order_number ?: $this->order->title),
        );
    }

    public function content(): Content
    {
        return new Content(view: 'emails.provider-rating-request');
    }
}
