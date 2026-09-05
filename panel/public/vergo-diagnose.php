<?php

/**
 * TEMPORARY diagnostic - upload, open in the browser, then DELETE this file.
 *
 *   https://work.vergo.ch/vergo-diagnose.php?key=YOUR_KEY&order=VER-2609-00009
 *
 * Read-only: it prints why each inspection quote was kept or sent back for
 * re-pricing. It changes nothing.
 */

// 1) Put your own long random value here before uploading.
$secret = '8fd3d359b73e996dbe8cf7baefeedc369172f78ee59b8c5c';

if (! hash_equals($secret, (string) ($_GET['key'] ?? ''))) {
    http_response_code(404);
    exit('Not found');
}

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

header('Content-Type: text/plain; charset=utf-8');

$order = App\Models\Order::query()
    ->where('order_number', (string) ($_GET['order'] ?? ''))
    ->first();

if (! $order) {
    exit("Order not found.\n");
}

$items = $order->quote_items ?? [];
echo "Order {$order->order_number} - {$order->title}\n";
echo 'Published positions: '.count($items)."\n";

foreach ($items as $i => $item) {
    printf("  %d. %-28s source_bid_id = %s\n",
        $i + 1,
        (string) data_get($item, 'label'),
        var_export(data_get($item, 'source_bid_id'), true),
    );
}

$sourceId = (int) data_get($order->workflow_meta ?? [], 'assignment.source_inspection_order_id');
echo 'Source inspection order id: '.($sourceId ?: 'MISSING')."\n\n";

if (! $sourceId || ! ($inspection = App\Models\Order::find($sourceId))) {
    exit("No source inspection to compare against.\n");
}

$publishedSourceBidIds = collect($items)
    ->pluck('source_bid_id')->map(fn ($id): int => (int) $id)->filter()->unique()->values();

echo 'Distinct source bids in published scope: '
    .($publishedSourceBidIds->isEmpty() ? 'NONE' : $publishedSourceBidIds->implode(', '))."\n\n";

foreach ($inspection->bids()->with('serviceProvider')->get() as $bid) {
    $raw = count($bid->line_items ?? []);
    $real = collect($bid->line_items ?? [])
        ->filter(fn ($item): bool => filled(data_get($item, 'label'))
            && (float) data_get($item, 'quantity', 0) > 0)
        ->count();
    $taken = collect($items)
        ->filter(fn ($item): bool => (int) data_get($item, 'source_bid_id') === $bid->id)
        ->count();
    $whole = $publishedSourceBidIds->count() === 1 && $publishedSourceBidIds->first() === $bid->id;
    $matches = $real > 0 && $items !== [] && $whole && $taken === $real;

    echo "bid #{$bid->id}  ".($bid->serviceProvider?->company_name ?? '?')."\n";
    echo "   status                : {$bid->status}\n";
    echo '   quote_scope_seed      : '.(data_get($bid->workflow_meta ?? [], 'quote_scope_seed') ? 'yes' : 'NO')."\n";
    echo "   rows stored on the bid: {$raw}\n";
    echo "   real positions        : {$real}".($raw !== $real ? "   <-- {$raw} rows stored, ".($raw - $real).' blank" => THIS was the bug' : '')."\n";
    echo "   of those, published   : {$taken}\n";
    echo '   whole scope is theirs : '.($whole ? 'yes' : 'no')."\n";
    echo '   => '.($matches ? 'KEEPS quote, receives NO email' : 'must RE-PRICE, gets the "scope changed" email')."\n\n";
}
