<?php

namespace App\Mail;

use App\Models\Order;
use App\Models\ServiceProvider;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ProviderOrderNoticeMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public Order $order,
        public ServiceProvider $provider,
        public string $noticeType,
        public string $loginUrl,
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->noticeType === 'assigned'
                ? 'Vergo: New order assigned to your company'
                : 'Vergo: New public order published',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.provider-order-notice',
        );
    }
}
