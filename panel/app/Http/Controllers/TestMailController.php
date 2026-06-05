<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Mail;

class TestMailController extends Controller
{
    public function sendVergoTest()
    {
        $provider = (object) [
            'company_name' => 'Dienstleister Test'
        ];

        $order = (object) [
            'service_type' => 'hvac_maintenance',
            'property' => (object) [
                'postal_code' => '8000',
                'city' => 'Zurich',
            ],
        ];

        Mail::mailer('orders')->send('emails.provider-order-notice', [
            'provider' => $provider,
            'order' => $order,
            'noticeType' => 'assigned',
            'loginUrl' => url('/login'),
        ], function ($message) {
            $message->to('saiffiverrfreelancer@gmail.com')
                ->from(config('mail.orders_from.address'), config('mail.orders_from.name'))
                ->subject('Vergo Auftragsbenachrichtigung');
        });

        return 'Test email sent successfully';
    }
}
