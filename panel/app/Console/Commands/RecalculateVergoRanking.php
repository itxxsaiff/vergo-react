<?php

namespace App\Console\Commands;

use App\Services\VergoRankingService;
use Illuminate\Console\Command;

class RecalculateVergoRanking extends Command
{
    protected $signature = 'vergo:ranking {--provider= : Only recalculate this service provider id}';

    protected $description = 'Recalculate the internal VERGO ranking score for service providers.';

    public function handle(VergoRankingService $ranking): int
    {
        if ($providerId = $this->option('provider')) {
            $provider = \App\Models\ServiceProvider::findOrFail((int) $providerId);
            $ranking->recalculate($provider);
            $this->info(sprintf('%s -> %s', $provider->company_name, $provider->fresh()->vergo_ranking_score ?? 'unranked'));

            return self::SUCCESS;
        }

        $count = $ranking->recalculateAll();
        $this->info($count.' provider(s) recalculated.');

        return self::SUCCESS;
    }
}
