<?php

/*
|--------------------------------------------------------------------------
| Automated Offer Evaluation
|--------------------------------------------------------------------------
| Implements "Automated Offer Evaluation - Functional Description".
| Every offer is scored out of 100 points across six categories. Price is
| deliberately 60% of the total (45 + 15).
|
| The model rewards the economically plausible price, not the cheapest one:
| offers that are unusually low lose points just as offers that are too high.
*/

return [
    // Section 2 - maximum points per category.
    'points' => [
        'total_price' => 45,
        'position_plausibility' => 15,
        'manager_rating' => 12,
        'vergo_rating' => 12,
        'schedule' => 11,
        'property_experience' => 5,
    ],

    'total_price' => [
        // Deviation from the reference that still counts as plausible.
        'plausible_band' => 0.10,
        // How steeply points fall away outside the band. Being too expensive
        // is punished harder than being cheap, but both lose points.
        'over_rate' => 2.2,
        'under_rate' => 1.6,
        // Section 3: on small orders a modest CHF difference is already
        // commercially significant, so deviations are amplified up to
        // (1 + small_order_emphasis). On large orders the percentage alone
        // drives the score.
        'small_order_emphasis' => 0.5,
        'small_order_threshold' => 2000,
        'large_order_threshold' => 20000,
        // Mild gradient inside the plausible band so a closer price still
        // edges ahead, without punishing a plausible price.
        'in_band_gradient' => 0.15,
        // Weight of historical reference prices against the peer median.
        'historical_weight' => 0.35,
    ],

    'position' => [
        'plausible_band' => 0.15,
        'over_rate' => 1.8,
        'under_rate' => 1.4,
        // Quantity deviation from the peer median before it is an anomaly.
        'quantity_band' => 0.20,
        'quantity_penalty' => 0.35,
        'in_band_gradient' => 0.10,
        // Similarity needed to treat two positions as comparable.
        'match_threshold' => 0.55,
        // Section 9: how far back historical unit prices are considered, and
        // how much weight they carry against the peer median.
        'history_months' => 24,
        'history_min_sample' => 2,
        'history_weight' => 0.35,
        // Deviation from the historical reference before it is an anomaly.
        'history_band' => 0.25,
        // Section 12: a position total that disagrees with quantity x unit
        // price by more than this is implausible.
        'total_mismatch_tolerance' => 0.02,
    ],

    'manager_rating' => [
        // Bayesian shrinkage: with few reviews the score is pulled towards the
        // prior so a single 5-star review cannot beat a long track record.
        'confidence_k' => 3,
        'prior_rating' => 3.0,
    ],

    'schedule' => [
        // Meeting the requested completion date matters more than an early
        // start (section 16).
        'completion_points' => 7,
        'start_points' => 4,
        // Points decay per day beyond the requested date.
        'penalty_per_day' => 0.15,
    ],
];
