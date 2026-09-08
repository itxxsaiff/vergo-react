<!doctype html>
<html lang="de">
<head>
    <meta charset="utf-8">
    <style>
        * { font-family: DejaVu Sans, sans-serif; }
        body { margin: 0; padding: 28px 32px; color: #2f3441; font-size: 11px; }
        .head { border-bottom: 3px solid #9f6d54; padding-bottom: 10px; margin-bottom: 18px; }
        .head h1 { margin: 0 0 4px; font-size: 19px; color: #9f6d54; }
        .head .meta { color: #6b7280; font-size: 10px; }
        .totals { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .totals td { border: 1px solid #eaded7; padding: 7px 9px; width: 16.6%; }
        .totals .k { color: #6b7280; font-size: 9px; text-transform: uppercase; display: block; }
        .totals .v { font-weight: bold; font-size: 13px; }
        h2 { font-size: 13px; margin: 18px 0 6px; color: #9f6d54; }
        table.data { width: 100%; border-collapse: collapse; }
        table.data th { background: #f7f0ec; text-align: left; padding: 6px 9px; border: 1px solid #eaded7; font-size: 10px; }
        table.data td { padding: 6px 9px; border: 1px solid #eee3dc; }
        table.data td.r { text-align: right; }
        .empty { color: #6b7280; padding: 8px 0; }
    </style>
</head>
<body>
    <div class="head">
        <h1>{{ $labels['heading'] }}</h1>
        <div class="meta">
            @if($ownerName) {{ $labels['owner'] }}: {{ $ownerName }} &middot; @else {{ $labels['all_owners'] }} &middot; @endif
            @if($search) {{ $labels['filter'] }}: "{{ $search }}" &middot; @endif
            {{ $labels['generated'] }} {{ $generatedAt }}
        </div>
    </div>

    <table class="totals">
        <tr>
            <td><span class="k">{{ $labels['orders'] }}</span><span class="v">{{ $totals['order_count'] ?? 0 }}</span></td>
            <td><span class="k">{{ $labels['active'] }}</span><span class="v">{{ $totals['active_order_count'] ?? 0 }}</span></td>
            <td><span class="k">{{ $labels['completed'] }}</span><span class="v">{{ $totals['completed_order_count'] ?? 0 }}</span></td>
            <td><span class="k">{{ $labels['cancelled'] }}</span><span class="v">{{ $totals['cancelled_order_count'] ?? 0 }}</span></td>
            <td><span class="k">{{ $labels['properties'] }}</span><span class="v">{{ $totals['property_count'] ?? 0 }}</span></td>
            <td><span class="k">{{ $labels['spend'] }}</span><span class="v">{{ App\Support\SwissNumber::money($totals['total_spend'] ?? 0) }}</span></td>
        </tr>
    </table>

    @foreach($blocks as $block)
        <h2>{{ $block['title'] }}</h2>

        @if(empty($block['rows']))
            <div class="empty">{{ $labels['empty'] }}</div>
        @else
            <table class="data">
                <thead>
                    <tr>
                        <th>{{ $block['label_heading'] }}</th>
                        <th style="width:26%; text-align:right;">{{ $block['value_heading'] }}</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($block['rows'] as $row)
                        <tr>
                            <td>{{ data_get($row, 'label') ?? data_get($row, 'company_name') ?? data_get($row, 'manager_email') ?? '-' }}</td>
                            <td class="r">
                                @if($block['money'])
                                    {{ App\Support\SwissNumber::money(data_get($row, $block['value_key'], 0)) }}
                                @else
                                    {{ App\Support\SwissNumber::format(data_get($row, $block['value_key'], 0), 0) }}
                                @endif
                            </td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        @endif
    @endforeach
</body>
</html>
