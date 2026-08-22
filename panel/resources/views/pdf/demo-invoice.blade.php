<!doctype html>
<html lang="de">
<head>
    <meta charset="utf-8">
    <style>
        @page { margin: 30px 34px; }
        body { font-family: DejaVu Sans, sans-serif; font-size: 10px; color: #1f2a44; }
        .head { width: 100%; margin-bottom: 18px; }
        .vendor { font-size: 15px; font-weight: bold; }
        .muted { color: #6b7385; }
        .title { font-size: 20px; font-weight: bold; margin: 16px 0 4px; }
        table.meta { width: 100%; margin: 14px 0 18px; border-collapse: collapse; }
        table.meta td { padding: 3px 0; vertical-align: top; }
        table.meta td.label { color: #6b7385; width: 130px; }
        table.items { width: 100%; border-collapse: collapse; margin-top: 6px; }
        table.items th { background: #f1f4f9; text-align: left; padding: 7px 8px; font-size: 9px; text-transform: uppercase; letter-spacing: .05em; }
        table.items td { padding: 7px 8px; border-bottom: 1px solid #e8edf4; }
        .r { text-align: right; }
        .totals { width: 46%; margin-left: 54%; margin-top: 12px; border-collapse: collapse; }
        .totals td { padding: 5px 8px; }
        .totals tr.grand td { border-top: 2px solid #1f2a44; font-weight: bold; font-size: 12px; }
        .foot { margin-top: 26px; padding-top: 10px; border-top: 1px solid #e8edf4; font-size: 9px; color: #6b7385; }
    </style>
</head>
<body>
    <table class="head">
        <tr>
            <td>
                <div class="vendor">{{ $vendor['name'] }}</div>
                <div class="muted">
                    {{ $vendor['street'] }}<br>
                    {{ $vendor['zip'] }} {{ $vendor['city'] }}<br>
                    MWST-Nr. {{ $vendor['vat'] }}
                </div>
            </td>
            <td class="r muted">
                Rechnung Nr. <strong>{{ $invoice_number }}</strong><br>
                Rechnungsdatum: {{ $invoice_date }}<br>
                Fällig bis: {{ $due_date }}
            </td>
        </tr>
    </table>

    <div class="title">Rechnung</div>
    <div class="muted">Leistungszeitraum {{ $period }}</div>

    <table class="meta">
        <tr>
            <td class="label">Rechnungsempfänger</td>
            <td>{{ $recipient['name'] }}, {{ $recipient['street'] }}, {{ $recipient['zip'] }} {{ $recipient['city'] }}</td>
        </tr>
        <tr>
            <td class="label">Liegenschaft</td>
            <td>{{ $property['title'] }} ({{ $property['li_number'] }}), {{ $property['address'] }}, {{ $property['zip'] }} {{ $property['city'] }}</td>
        </tr>
        <tr>
            <td class="label">Objektgrösse</td>
            <td>{{ $property['size'] }} m²</td>
        </tr>
        <tr>
            <td class="label">Gewerk / Leistung</td>
            <td>{{ $service_label }}</td>
        </tr>
        <tr>
            <td class="label">Turnus</td>
            <td>{{ $interval }}</td>
        </tr>
    </table>

    <table class="items">
        <thead>
            <tr>
                <th style="width:32px;">Pos.</th>
                <th>Beschreibung</th>
                <th style="width:58px;">Einheit</th>
                <th class="r" style="width:56px;">Menge</th>
                <th class="r" style="width:78px;">Einzelpreis</th>
                <th class="r" style="width:82px;">Betrag</th>
            </tr>
        </thead>
        <tbody>
            @foreach($items as $index => $item)
                <tr>
                    <td>{{ $index + 1 }}</td>
                    <td>{{ $item['label'] }}</td>
                    <td>{{ $item['unit'] }}</td>
                    <td class="r">{{ number_format($item['quantity'], 2, '.', "'") }}</td>
                    <td class="r">{{ number_format($item['unit_price'], 2, '.', "'") }}</td>
                    <td class="r">{{ number_format($item['quantity'] * $item['unit_price'], 2, '.', "'") }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <table class="totals">
        <tr>
            <td class="muted">Zwischentotal</td>
            <td class="r">CHF {{ number_format($subtotal, 2, '.', "'") }}</td>
        </tr>
        <tr>
            <td class="muted">MWST 8.1 %</td>
            <td class="r">CHF {{ number_format($vat, 2, '.', "'") }}</td>
        </tr>
        <tr class="grand">
            <td>Total</td>
            <td class="r">CHF {{ number_format($total, 2, '.', "'") }}</td>
        </tr>
    </table>

    <div class="foot">
        Zahlbar innert 30 Tagen netto. IBAN {{ $vendor['iban'] }}.<br>
        Diese Rechnung wurde zu Demonstrationszwecken erstellt.
    </div>
</body>
</html>
