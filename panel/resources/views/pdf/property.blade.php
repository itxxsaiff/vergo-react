<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <title>{{ $property->li_number ?: 'Liegenschaft' }}</title>
    <style>
        @page {
            margin: 16mm 12mm 16mm;
            size: A4 portrait;
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            font-family: DejaVu Sans, sans-serif;
            color: #22304a;
            font-size: 12px;
        }

        .page-title {
            width: 100%;
            margin-bottom: 16px;
        }

        .page-title-left {
            float: left;
            width: 55%;
            font-size: 16px;
            font-weight: 700;
            letter-spacing: 0.05em;
        }

        .page-title-right {
            float: right;
            width: 35%;
            text-align: right;
        }

        .page-title:after,
        .object-grid:after {
            content: "";
            display: table;
            clear: both;
        }

        .logo {
            max-width: 180px;
            max-height: 52px;
        }

        .top-panels {
            margin-bottom: 20px;
        }

        .top-panels-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 12px 0;
            table-layout: fixed;
        }

        .top-panels-cell {
            vertical-align: top;
        }

        .li-panel,
        .info-panel {
            min-height: 152px;
            overflow: hidden;
            background: #bb8867;
            color: #ffffff;
            border-radius: 24px;
        }

        .li-panel {
            text-align: center;
            padding: 56px 18px;
            font-size: 28px;
            font-weight: 700;
        }

        .info-panel {
            padding: 22px 24px;
        }

        .info-line {
            margin-bottom: 14px;
            font-size: 13px;
            font-weight: 700;
        }

        .section-title {
            margin-bottom: 16px;
            padding: 4px 12px;
            text-align: center;
            font-size: 13px;
            font-weight: 700;
            color: #8f604b;
            border: 1px solid #bb8867;
            border-radius: 8px;
        }

        .object-card {
            position: relative;
            float: left;
            width: 22.75%;
            min-height: 118px;
            margin-right: 3%;
            margin-bottom: 14px;
            padding: 28px 10px 12px;
            border: 1px solid #eee5de;
            border-radius: 14px;
            background: #ffffff;
            box-shadow: 0 8px 20px rgba(34, 48, 74, 0.05);
            overflow: hidden;
        }

        .object-card:nth-child(4n) {
            margin-right: 0;
        }

        .object-icon-wrap {
            position: absolute;
            top: -13px;
            left: 50%;
            width: 26px;
            height: 26px;
            margin-left: -13px;
            border-radius: 50%;
            border: 1px solid rgba(187, 136, 103, 0.18);
            background: #fff8f3;
            text-align: center;
            line-height: 24px;
            color: #bb8867;
            font-size: 12px;
        }

        .label {
            margin-bottom: 4px;
            font-size: 7px;
            font-weight: 700;
            letter-spacing: 0.16em;
            text-transform: uppercase;
            color: #8a93a8;
        }

        .address {
            min-height: 30px;
            margin-bottom: 12px;
            font-size: 11px;
            font-weight: 700;
            line-height: 1.35;
        }

        .meta-row:after {
            content: "";
            display: table;
            clear: both;
        }

        .meta-col {
            float: left;
            width: 48%;
        }

        .meta-col:last-child {
            float: right;
        }

        .value {
            font-size: 11px;
            font-weight: 700;
        }
    </style>
</head>
<body>
    <div class="page-title">
        <div class="page-title-left">LIEGENSCHAFTSINFORMATIONEN</div>
        <div class="page-title-right">
            @if($logoDataUri)
                <img class="logo" src="{{ $logoDataUri }}" alt="Vergo">
            @endif
        </div>
    </div>

    <div class="top-panels">
        <table class="top-panels-table">
            <tr>
                <td class="top-panels-cell" style="width: 46%;">
                    <div class="li-panel">{{ $property->li_number ?: '-' }}</div>
                </td>
                <td class="top-panels-cell" style="width: 54%;">
                    <div class="info-panel">
                        <div class="info-line">{{ $property->title ?: '-' }}</div>
                        <div class="info-line">{{ $managerLabel }}</div>
                        <div class="info-line">{{ $ownerLabel }}</div>
                        <div class="info-line">{{ trim(($property->postal_code ?: '-') . ' ' . ($property->city ?: '-')) }}</div>
                        <div class="info-line">{{ $usageLabel }}</div>
                    </div>
                </td>
            </tr>
        </table>
    </div>

    <div class="section-title">Objekte</div>

    <div class="object-grid">
        @foreach($objectCards as $card)
            <div class="object-card">
                <div class="object-icon-wrap">⌂</div>
                <div class="label">Adresse</div>
                <div class="address">{{ $card['address'] }}</div>
                <div class="meta-row">
                    <div class="meta-col">
                        <div class="label">PLZ</div>
                        <div class="value">{{ $card['postal_code'] }}</div>
                    </div>
                    <div class="meta-col">
                        <div class="label">Ort</div>
                        <div class="value">{{ $card['city'] }}</div>
                    </div>
                </div>
            </div>
        @endforeach
    </div>
</body>
</html>
