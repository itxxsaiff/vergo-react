<!doctype html>
<html lang="de">
<head>
    <meta charset="utf-8">
    <style>
        * { font-family: DejaVu Sans, sans-serif; }
        body { margin: 0; padding: 30px 34px; color: #2f3441; font-size: 11px; }
        .head { border-bottom: 3px solid #16202b; padding-bottom: 12px; margin-bottom: 20px; }
        .head img { height: 38px; }
        /* The logo file is white, so it needs a dark panel behind it to be
           visible on white paper. */
        .logo-shell { display: inline-block; padding: 7px 12px 5px; background: #16202b; border-radius: 8px; }
        .head h1 { margin: 10px 0 2px; font-size: 18px; color: #16202b; }
        .head .meta { color: #6b7280; font-size: 10px; }
        h2 { font-size: 12px; margin: 18px 0 6px; color: #16202b; text-transform: uppercase; letter-spacing: .04em; }
        table.kv { width: 100%; border-collapse: collapse; }
        table.kv td { padding: 4px 0; vertical-align: top; }
        table.kv td.k { width: 190px; color: #6b7280; }
        .box { border: 1px solid #e3e6ea; border-radius: 6px; padding: 10px 12px; background: #f7f8fa; }
        table.items { width: 100%; border-collapse: collapse; margin-top: 4px; }
        table.items th { background: #f4f6f8; text-align: left; padding: 6px 8px; border: 1px solid #e3e6ea; font-size: 10px; }
        table.items td { padding: 6px 8px; border: 1px solid #e8eaee; }
        table.items td.r, table.items th.r { text-align: right; }
        .total { margin-top: 8px; text-align: right; font-size: 13px; font-weight: bold; }
        .muted { color: #6b7280; }
    </style>
</head>
<body>
    <div class="head">
        @if($logoDataUri)<span class="logo-shell"><img src="{{ $logoDataUri }}" alt="Vergo"></span>@endif
        <h1>{{ $labels['title'] }}</h1>
        <div class="meta">
            {{ $labels['order'] }} {{ $summary['order_number'] ?: '-' }}
            @if($order->title) &middot; {{ $order->title }} @endif
            &middot; {{ $labels['generated'] }} {{ $generatedAt }}
        </div>
    </div>

    <h2>{{ $labels['object'] }}</h2>
    <table class="kv">
        <tr><td class="k">{{ $labels['property'] }}</td><td>{{ $summary['property']['name'] ?? '-' }} ({{ $summary['property']['li_number'] ?? '-' }})</td></tr>
        <tr><td class="k">{{ $labels['address'] }}</td><td>{{ $summary['property']['street'] ?? '-' }}</td></tr>
        <tr><td class="k">{{ $labels['zip_city'] }}</td><td>{{ trim(($summary['property']['postal_code'] ?? '').' '.($summary['property']['city'] ?? '')) ?: '-' }}</td></tr>
    </table>

    <h2>{{ $labels['owner'] }}</h2>
    <table class="kv">
        @if(!empty($summary['owner']))
            <tr><td class="k">{{ $labels['name'] }}</td><td>{{ $summary['owner']['name'] ?? '-' }}</td></tr>
            @if(!empty($summary['owner']['address']))
                <tr><td class="k">{{ $labels['address'] }}</td><td>{{ $summary['owner']['address'] }}</td></tr>
            @endif
            <tr><td class="k">{{ $labels['zip_city'] }}</td><td>{{ trim(($summary['owner']['postal_code'] ?? '').' '.($summary['owner']['city'] ?? '')) ?: '-' }}</td></tr>
        @else
            <tr><td colspan="2" class="muted">{{ $labels['none'] }}</td></tr>
        @endif
    </table>

    <h2>{{ $labels['management'] }}</h2>
    <table class="kv">
        @if(!empty($summary['property_manager']))
            <tr><td class="k">{{ $labels['name'] }}</td><td>{{ $summary['property_manager']['name'] ?? '-' }}</td></tr>
            <tr><td class="k">{{ $labels['address'] }}</td><td>{{ $summary['property_manager']['address'] ?? '-' }}</td></tr>
            <tr><td class="k">{{ $labels['zip_city'] }}</td><td>{{ trim(($summary['property_manager']['postal_code'] ?? '').' '.($summary['property_manager']['city'] ?? '')) ?: '-' }}</td></tr>
        @else
            <tr><td colspan="2" class="muted">{{ $labels['none'] }}</td></tr>
        @endif
    </table>

    <h2>{{ $labels['recipient'] }}</h2>
    <div class="box">
        <table class="kv">
            @foreach(['company' => $labels['company'], 'name' => $labels['name'], 'address' => $labels['address']] as $key => $label)
                @if(!empty($summary['billing_address'][$key]))
                    <tr><td class="k">{{ $label }}</td><td>{{ $summary['billing_address'][$key] }}</td></tr>
                @endif
            @endforeach
            @if(!empty($summary['billing_address']['postal_code']) || !empty($summary['billing_address']['city']))
                <tr><td class="k">{{ $labels['zip_city'] }}</td><td>{{ trim(($summary['billing_address']['postal_code'] ?? '').' '.($summary['billing_address']['city'] ?? '')) }}</td></tr>
            @endif
        </table>

        <table class="kv" style="margin-top:8px;border-top:1px solid #e3e6ea;">
            <tr>
                <td class="k" style="padding-top:8px;"><strong>{{ $labels['send_to'] }}</strong></td>
                <td style="padding-top:8px;">
                    @if(($summary['invoice_delivery']['method'] ?? '') === 'email')
                        <strong>{{ $summary['invoice_delivery']['email'] ?? '-' }}</strong> <span class="muted">({{ $labels['by_email'] }})</span>
                    @else
                        <strong>{{ $summary['invoice_delivery']['postal_address'] ?? '-' }}</strong> <span class="muted">({{ $labels['by_post'] }})</span>
                    @endif
                </td>
            </tr>
        </table>
    </div>

    <h2>{{ $labels['services'] }}</h2>
    @if(empty($summary['line_items']))
        <div class="muted">{{ $labels['no_items'] }}</div>
    @else
        <table class="items">
            <thead>
                <tr>
                    <th>{{ $labels['position'] }}</th>
                    <th style="width:70px;">{{ $labels['unit'] }}</th>
                    <th class="r" style="width:70px;">{{ $labels['quantity'] }}</th>
                    <th class="r" style="width:90px;">{{ $labels['price'] }}</th>
                    <th class="r" style="width:95px;">{{ $labels['amount'] }}</th>
                </tr>
            </thead>
            <tbody>
                @foreach($summary['line_items'] as $item)
                    <tr>
                        <td>
                            {{ $item['label'] }}
                            @if(!empty($item['category']))<br><span class="muted">{{ $item['category'] }}</span>@endif
                        </td>
                        <td>{{ $item['unit'] ?: '-' }}</td>
                        <td class="r">{{ App\Support\SwissNumber::format($item['quantity'], 0) }}</td>
                        <td class="r">{{ App\Support\SwissNumber::format($item['unit_price']) }}</td>
                        <td class="r">{{ App\Support\SwissNumber::format($item['subtotal']) }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
        <div class="total">
            {{ $labels['total'] }}: {{ App\Support\SwissNumber::money($summary['total'] ?? 0, $summary['currency'] ?? 'CHF') }}
        </div>
    @endif

    @if(!empty($summary['provider_reference']))
        <p class="muted" style="margin-top:16px;">{{ $labels['your_quote_number'] }}: {{ $summary['provider_reference'] }}</p>
    @endif
</body>
</html>
