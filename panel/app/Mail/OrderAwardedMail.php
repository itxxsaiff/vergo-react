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
 * The property manager accepted this company's offer. They now confirm the job
 * in Vergo and get on with it.
 */
class OrderAwardedMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public Order $order,
        public ServiceProvider $provider,
        public string $loginUrl,
        public ?string $tradeLabel = null,
        public ?string $propertyAddress = null,
        public ?string $amount = null,
        public ?string $startDate = null,
        public ?string $completionDate = null,
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            from: new Address(config('mail.orders_from.address'), config('mail.orders_from.name')),
            subject: sprintf(
                'Ihre Offerte wurde angenommen (%s)',
                $this->order->order_number ?: $this->order->title,
            ),
        );
    }

    public function content(): Content
    {
        return new Content(view: 'emails.order-awarded');
    }
}
