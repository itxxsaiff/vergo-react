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

class OrderCancelledMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public Order $order,
        public ServiceProvider $provider,
        public string $reason,
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            from: new Address(config('mail.orders_from.address'), config('mail.orders_from.name')),
            subject: sprintf('Auftrag abgesagt (%s)', $this->order->order_number ?: $this->order->title),
        );
    }

    public function content(): Content
    {
        return new Content(view: 'emails.order-cancelled');
    }
}
