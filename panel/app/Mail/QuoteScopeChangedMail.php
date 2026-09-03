<?php

namespace App\Mail;

use App\Models\Order;
use App\Models\ServiceProvider;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class QuoteScopeChangedMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public Order $order,
        public ServiceProvider $provider,
        public int $itemCount,
        public string $loginUrl,
        public ?string $tradeLabel = null,
        public ?string $propertyAddress = null,
        public ?string $originalQuoteEmail = null,
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            from: new Address(config('mail.orders_from.address'), config('mail.orders_from.name')),
            subject: sprintf('Auftragsvolumen geändert - bitte neu offerieren (%s)', $this->order->order_number ?: $this->order->title),
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.quote-scope-changed',
        );
    }
}
