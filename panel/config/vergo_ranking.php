<?php

/*
|--------------------------------------------------------------------------
| VERGO Ranking
|--------------------------------------------------------------------------
| Score out of 100 per service provider. The factors below are the ones the
| client named: starting on time, finishing on time, the final price matching
| the quoted price, the confidential 1-5 star ratings, and a penalty when a
| provider changes prices or adds items on their own after the job started.
|
| The exact weighting still has to be confirmed against the client's ranking
| document. Everything is configurable here so the methodology can be tuned
| without touching application code.
*/

return [
    'weights' => [
        'rating' => 40,          // confidential 1-5 star average
        'on_time_start' => 15,   // started on the agreed date
        'on_time_completion' => 20, // finished by the agreed date
        'price_accuracy' => 25,  // final price matches the quoted price
    ],

    // Deducted from the final score for each approved self-initiated change.
    'penalties' => [
        'price_change_request' => 4.0,
        'added_item' => 2.0,
        // Confirmed an inspection appointment and did not attend.
        'inspection_no_show' => 8.0,
        'max_penalty' => 30.0,
    ],

    // A provider with fewer completed jobs than this is treated as unranked
    // rather than being scored on a single data point.
    'minimum_completed_orders' => 1,

    // Neutral starting value for a factor with no data yet (0-1).
    'neutral_factor_value' => 0.7,

    // Tolerance before a price counts as "changed" (fraction of quoted amount).
    'price_tolerance' => 0.02,
];
