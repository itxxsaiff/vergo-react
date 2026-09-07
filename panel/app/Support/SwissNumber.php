<?php

namespace App\Support;

/**
 * Swiss number formatting: thousands separated by an apostrophe, decimals by a
 * point - 10000 becomes 10'000.00.
 */
class SwissNumber
{
    public static function format(float|int|string|null $value, int $decimals = 2): string
    {
        return number_format((float) $value, $decimals, '.', "'");
    }

    /** Amount plus its currency, e.g. "10'000.00 CHF". */
    public static function money(float|int|string|null $value, ?string $currency = 'CHF'): string
    {
        return trim(self::format($value).' '.($currency ?: ''));
    }
}
