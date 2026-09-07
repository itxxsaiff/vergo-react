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

/**
 * The manager turned this provider's inspection quote into an order without
 * changing a single position. Their prices stand - the only thing still
 * missing is when they can start and finish.
 */
class QuotePreservedDatesRequestedMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public Order $order,
        public ServiceProvider $provider,
        public string $loginUrl,
        public ?string $tradeLabel = null,
        public ?string $propertyAddress = null,
        public ?string $completionDeadline = null,
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            from: new Address(config('mail.orders_from.address'), config('mail.orders_from.name')),
            subject: sprintf(
                'Auftrag erstellt - bitte Termine erfassen (%s)',
                $this->order->order_number ?: $this->order->title,
            ),
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.quote-preserved-dates-requested',
        );
    }
}
