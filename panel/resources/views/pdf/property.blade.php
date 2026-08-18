<!DOCTYPE html>
<html lang="{{ $pdfLanguage ?? 'de' }}">
<head>
    <meta charset="UTF-8">
    <title>{{ $property->li_number ?: 'Liegenschaft' }}</title>
    <style>
        @page {
            margin: 14mm 13mm 15mm;
            size: A4 portrait;
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            font-family: DejaVu Sans, sans-serif;
            color: #1f2a44;
            font-size: 11px;
            background: #ffffff;
        }

        .header {
            width: 100%;
            margin-bottom: 18px;
            padding-bottom: 12px;
            border-bottom: 1px solid #e8edf4;
        }

        .header-left {
            float: left;
            width: 58%;
        }

        .header-right {
            float: right;
            width: 38%;
            text-align: right;
        }

        .header:after,
        .hero:after {
            content: "";
            display: table;
            clear: both;
        }

        .eyebrow {
            margin-bottom: 5px;
            color: #9f6d54;
            font-size: 8px;
            font-weight: 700;
            letter-spacing: 0.2em;
            text-transform: uppercase;
        }

        .document-title {
            font-size: 18px;
            font-weight: 700;
            letter-spacing: 0.04em;
        }

        .logo-shell {
            display: inline-block;
            padding: 8px 13px 6px;
            border-radius: 12px;
            background: #9f6d54;
        }

        .logo {
            max-width: 130px;
            max-height: 32px;
        }

        .hero {
            margin-bottom: 18px;
            padding: 16px 18px;
            border: 1px solid #e6eaf0;
            border-left: 5px solid #9f6d54;
            border-radius: 16px;
            background: #fbfcfe;
        }

        .hero-li {
            float: left;
            width: 38%;
            padding-top: 8px;
        }

        .li-label {
            margin-bottom: 8px;
            color: #8a94a8;
            font-size: 8px;
            font-weight: 700;
            letter-spacing: 0.16em;
            text-transform: uppercase;
        }

        .li-number {
            color: #1f2a44;
            font-size: 34px;
            font-weight: 700;
            line-height: 1;
        }

        .hero-info {
            float: right;
            width: 58%;
        }

        .info-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
        }

        .info-table td {
            width: 50%;
            padding: 0 0 12px 16px;
            vertical-align: top;
        }

        .info-label {
            margin-bottom: 4px;
            color: #8a94a8;
            font-size: 7px;
            font-weight: 700;
            letter-spacing: 0.15em;
            text-transform: uppercase;
        }

        .info-value {
            color: #1f2a44;
            font-size: 12px;
            font-weight: 700;
            line-height: 1.3;
        }

        .section-head {
            width: 100%;
            margin: 18px 0 10px;
        }

        .section-title {
            float: left;
            width: 50%;
            color: #1f2a44;
            font-size: 14px;
            font-weight: 700;
        }

        .section-meta {
            float: right;
            width: 45%;
            color: #8a94a8;
            text-align: right;
            font-size: 10px;
        }

        .section-head:after {
            content: "";
            display: table;
            clear: both;
        }

        .objects-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0 8px;
        }

        .object-row td {
            padding: 11px 12px;
            vertical-align: middle;
            border-top: 1px solid #e8edf4;
            border-bottom: 1px solid #e8edf4;
            background: #ffffff;
        }

        .object-row td:first-child {
            width: 46px;
            border-left: 1px solid #e8edf4;
            border-radius: 12px 0 0 12px;
        }

        .object-row td:last-child {
            border-right: 1px solid #e8edf4;
            border-radius: 0 12px 12px 0;
        }

        .object-index {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: #f3ebe6;
            color: #9f6d54;
            font-size: 10px;
            font-weight: 700;
            overflow: hidden;
        }

        .object-index-table {
            width: 24px;
            height: 24px;
            border-collapse: collapse;
            table-layout: fixed;
        }

        .object-index-table td {
            width: 24px;
            height: 24px;
            padding: 0;
            border: 0;
            background: transparent;
            text-align: center;
            vertical-align: middle;
            line-height: 1;
        }

        .object-address {
            color: #1f2a44;
            font-size: 12px;
            font-weight: 700;
        }

        .object-data-label {
            color: #8a94a8;
            font-size: 7px;
            font-weight: 700;
            letter-spacing: 0.14em;
            text-transform: uppercase;
        }

        .object-head-row td {
            padding: 0 12px 2px;
            border: 0;
            background: transparent;
        }

        .object-data-value {
            color: #1f2a44;
            font-size: 11px;
            font-weight: 700;
        }

        .footer-note {
            margin-top: 18px;
            padding-top: 8px;
            border-top: 1px solid #e8edf4;
            color: #9aa4b7;
            font-size: 8px;
            text-align: right;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="header-left">
            <div class="eyebrow">{{ $labels['sheet_eyebrow'] }}</div>
            <div class="document-title">{{ $labels['property_information'] }}</div>
        </div>
        <div class="header-right">
            @if($logoDataUri)
                <span class="logo-shell"><img class="logo" src="{{ $logoDataUri }}" alt="Vergo"></span>
            @endif
        </div>
    </div>

    <div class="hero">
        <div class="hero-li">
            <div class="li-label">{{ $labels['li_number'] }}</div>
            <div class="li-number">{{ $property->li_number ?: '-' }}</div>
        </div>
        <div class="hero-info">
            <table class="info-table">
                <tr>
                    <td>
                        <div class="info-label">{{ $labels['description'] }}</div>
                        <div class="info-value">{{ $property->title ?: '-' }}</div>
                    </td>
                    <td>
                        <div class="info-label">{{ $labels['use'] }}</div>
                        <div class="info-value">{{ $usageLabel }}</div>
                    </td>
                </tr>
                <tr>
                    <td>
                        <div class="info-label">{{ $labels['management'] }}</div>
                        <div class="info-value">{{ $managerLabel }}</div>
                    </td>
                    <td>
                        <div class="info-label">{{ $labels['owner'] }}</div>
                        <div class="info-value">{{ $ownerLabel }}</div>
                    </td>
                </tr>
                <tr>
                    <td>
                        <div class="info-label">{{ $labels['zip_city'] }}</div>
                        <div class="info-value">{{ trim(($property->postal_code ?: '-') . ' ' . ($property->city ?: '-')) }}</div>
                    </td>
                    <td>
                        <div class="info-label">{{ $labels['properties'] }}</div>
                        <div class="info-value">{{ count($objectCards) }}</div>
                    </td>
                </tr>
            </table>
        </div>
    </div>

    <div class="section-head">
        <div class="section-title">{{ $labels['properties'] }}</div>
    </div>

    <table class="objects-table">
        <tr class="object-head-row">
            <td></td>
            <td style="width: 52%;"><div class="object-data-label">{{ $labels['property_address'] }}</div></td>
            <td style="width: 20%;"><div class="object-data-label">{{ $labels['zip'] }}</div></td>
            <td style="width: 28%;"><div class="object-data-label">{{ $labels['city'] }}</div></td>
        </tr>
        @foreach($objectCards as $index => $card)
            <tr class="object-row">
                <td>
                    <div class="object-index">
                        <table class="object-index-table">
                            <tr><td>{{ $index + 1 }}</td></tr>
                        </table>
                    </div>
                </td>
                <td style="width: 52%;">
                    <div class="object-address">{{ $card['address'] }}</div>
                </td>
                <td style="width: 20%;">
                    <div class="object-data-value">{{ $card['postal_code'] }}</div>
                </td>
                <td style="width: 28%;">
                    <div class="object-data-value">{{ $card['city'] }}</div>
                </td>
            </tr>
        @endforeach
    </table>

    <div class="footer-note">
        {{ $labels['generated_by_vergo'] }}
    </div>
</body>
</html>
