<!doctype html>
<html lang="de">
<head>
    <meta charset="utf-8">
    <style>
        * { font-family: DejaVu Sans, sans-serif; }
        body { margin: 0; padding: 30px 34px; color: #2f3441; font-size: 11px; }
        .head { border-bottom: 3px solid #16202b; padding-bottom: 12px; margin-bottom: 18px; }
        .head img { height: 36px; }
        /* The logo file is white, so it needs a dark panel behind it to be
           visible on white paper. */
        .logo-shell { display: inline-block; padding: 7px 12px 5px; background: #16202b; border-radius: 8px; }
        .head h1 { margin: 10px 0 2px; font-size: 18px; color: #16202b; }
        .head .meta { color: #6b7280; font-size: 10px; }
        h2 { font-size: 13px; margin: 20px 0 6px; color: #16202b; }
        h2 .count { color: #6b7280; font-size: 10px; font-weight: normal; }
        table.jobs { width: 100%; border-collapse: collapse; }
        table.jobs th { background: #f4f6f8; text-align: left; padding: 6px 8px; border: 1px solid #e3e6ea; font-size: 10px; }
        table.jobs td { padding: 6px 8px; border: 1px solid #e8eaee; }
        table.jobs td.r, table.jobs th.r { text-align: right; }
        .subtotal { text-align: right; font-weight: bold; margin-top: 5px; }
        .grand { margin-top: 22px; padding-top: 10px; border-top: 2px solid #16202b; text-align: right; font-size: 13px; font-weight: bold; }
        .empty { color: #6b7280; padding: 10px 0; }
    </style>
</head>
<body>
    <div class="head">
        @if($logoDataUri)<span class="logo-shell"><img src="{{ $logoDataUri }}" alt="Vergo"></span>@endif
        <h1>{{ $labels['title'] }}</h1>
        <div class="meta">{{ $labels['period'] }}: {{ $periodLabel }} &middot; {{ $labels['generated'] }} {{ $generatedAt }}</div>
    </div>

    @if(empty($groups))
        <div class="empty">{{ $labels['empty'] }}</div>
    @else
        @foreach($groups as $group)
            {{-- The company's name heads its own block, the jobs follow underneath. --}}
            <h2>{{ $group['provider'] }} <span class="count">- {{ count($group['rows']) }} {{ $labels['jobs'] }}</span></h2>

            <table class="jobs">
                <thead>
                    <tr>
                        <th style="width:120px;">{{ $labels['order_number'] }}</th>
                        <th style="width:90px;">{{ $labels['completed_on'] }}</th>
                        <th style="width:90px;">{{ $labels['trade'] }}</th>
                        <th style="width:80px;">{{ $labels['status'] }}</th>
                        <th>{{ $labels['address'] }}</th>
                        <th class="r" style="width:95px;">{{ $labels['price'] }}</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($group['rows'] as $row)
                        <tr>
                            <td>{{ $row['order_number'] ?: '-' }}</td>
                            <td>{{ $row['completed_at'] ? \Carbon\Carbon::parse($row['completed_at'])->format('d.m.Y') : '-' }}</td>
                            <td>{{ $row['trade'] ?: '-' }}</td>
                            <td>{{ ucfirst(str_replace('_', ' ', (string) ($row['status'] ?? '-'))) }}</td>
                            <td>{{ $row['address'] ?: '-' }}</td>
                            <td class="r">{{ App\Support\SwissNumber::format($row['amount'] ?? 0) }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>

            <div class="subtotal">{{ $labels['total'] }}: {{ App\Support\SwissNumber::money($group['total']) }}</div>
        @endforeach

        <div class="grand">{{ $labels['grand_total'] }}: {{ App\Support\SwissNumber::money($grandTotal) }}</div>
    @endif
</body>
</html>
