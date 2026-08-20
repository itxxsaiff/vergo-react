<?php

namespace App\Console\Commands;

use App\Models\Bid;
use App\Models\Document;
use App\Models\PropertyManagerDomain;
use App\Models\SupportTicket;
use App\Models\Order;
use App\Models\Property;
use App\Models\PropertyManagerProfile;
use App\Models\PropertyObject;
use App\Models\ProviderReview;
use App\Models\Role;
use App\Models\ServiceProvider;
use App\Models\User;
use App\Services\VergoRankingService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Builds a complete, realistic test scenario in one command so the whole
 * system can be walked through end to end: owners, managers, providers,
 * properties, orders in every state, competing quotes and ratings.
 *
 * Everything it creates is tagged DEMO so it can be removed again cleanly.
 */
class SeedDemoData extends Command
{
    protected $signature = 'vergo:demo-data
                            {--domain=vergo-demo.ch : Email domain used for every generated account}
                            {--fresh : Remove previously generated demo data first}
                            {--force : Allow running outside the local environment}';

    protected $description = 'Create a full demo dataset (owners, managers, providers, properties, orders, quotes) for end-to-end testing.';

    private const TAG = '[DEMO]';

    public function handle(VergoRankingService $ranking): int
    {
        if (! app()->environment('local') && ! $this->option('force')) {
            $this->error('Refusing to run outside the local environment. Use --force if you really mean it.');

            return self::FAILURE;
        }

        $domain = trim((string) $this->option('domain'));

        if ($this->option('fresh')) {
            $this->removeDemoData();
        }

        DB::transaction(function () use ($domain, $ranking): void {
            $owners = $this->createOwners($domain);
            $managers = $this->createManagers($domain);
            $providers = $this->createProviders($domain);
            $properties = $this->createProperties($owners, $managers);
            $this->createManagerDomains($properties, $domain);
            $this->createOrders($properties, $managers, $providers);
            $this->createInvoiceDocuments($properties, $providers);
            $this->createSupportTickets($managers);

            foreach ($providers as $provider) {
                $ranking->recalculate($provider);
            }
        });

        $this->newLine();
        $this->info('Demo data ready.');
        $this->line('  Owners / managers sign in with OTP; providers use their DLS number.');
        $this->line('  Remove it again with: php artisan vergo:demo-data --fresh');

        return self::SUCCESS;
    }

    /**
     * @return array<int, User>
     */
    private function createOwners(string $domain): array
    {
        $ownerRole = Role::query()->firstOrCreate(['name' => 'owner'], ['label' => 'Owner']);
        $rows = [
            ['Meier Immobilien AG', 'company', 'meier'],
            ['Sandra Blaser', 'private_individual', 'blaser'],
            ['Helvetia Real Estate', 'company', 'helvetia'],
        ];
        $owners = [];

        foreach ($rows as $index => [$name, $type, $slug]) {
            $email = $slug.'.owner@'.$domain;
            $owner = User::query()->updateOrCreate(['email' => $email], [
                'role_id' => $ownerRole->id,
                'name' => self::TAG.' '.$name,
                'company_name' => $type === 'company' ? $name : null,
                'owner_type' => $type,
                'login_email' => $email,
                'domain_suffix' => $type === 'company' ? $domain : null,
                'address' => 'Eigentümerweg '.($index + 1),
                'postal_code' => '800'.($index + 1),
                'city' => 'Zürich',
                'password' => bin2hex(random_bytes(16)),
                'status' => 'active',
            ]);
            $owners[] = $owner;
            $this->line('  owner    '.$email);
        }

        return $owners;
    }

    /**
     * @return array<int, PropertyManagerProfile>
     */
    private function createManagers(string $domain): array
    {
        $rows = [['Bewirtschaftung Nord', 'nord'], ['Bewirtschaftung Süd', 'sued'], ['City Verwaltung', 'city']];
        $managers = [];

        foreach ($rows as $index => [$name, $slug]) {
            $email = $slug.'.manager@'.$domain;
            $managers[] = PropertyManagerProfile::query()->updateOrCreate(['email' => $email], [
                'name' => self::TAG.' '.$name,
                'phone' => '04412345'.$index,
                'address' => 'Verwaltungsstrasse '.($index + 1),
                'postal_code' => '800'.($index + 1),
                'city' => 'Zürich',
                'canton' => 'ZH',
                'domain_suffix' => $domain,
                'invoice_email' => 'rechnung.'.$slug.'@'.$domain,
                'invoice_company_name' => $name.' AG',
                'invoice_address' => 'Rechnungsweg '.($index + 1),
                'invoice_postal_code' => '800'.($index + 1),
                'invoice_city' => 'Zürich',
                'invoice_delivery_method' => 'email',
            ]);
            $this->line('  manager  '.$email);
        }

        return $managers;
    }

    /**
     * @return array<int, ServiceProvider>
     */
    private function createProviders(string $domain): array
    {
        $providerRole = Role::query()->firstOrCreate(['name' => 'provider'], ['label' => 'Service Provider']);
        $rows = [
            // Trades overlap on purpose so every tender attracts 2-3
            // competing offers, the way a real one would.
            ['Malerei Frei', 'malerei-frei', ['maler'], 'ZH'],
            ['Farbwerk GmbH', 'farbwerk', ['maler', 'gipser_trockenbau', 'bodenbelaege'], 'ZH'],
            ['Haustechnik Suter', 'suter', ['heizung', 'lueftung', 'sanitaer'], 'ZH'],
            ['Klima Profi AG', 'klimaprofi', ['klima_kaelte', 'lueftung', 'heizung'], 'AG'],
            ['Sanitär Roth', 'roth', ['sanitaer', 'heizung', 'kanal_entwaesserung'], 'ZH'],
            ['Bodenwerk Zürich', 'bodenwerk', ['bodenbelaege', 'plattenleger', 'maler'], 'ZH'],
        ];
        $providers = [];

        foreach ($rows as $index => [$company, $slug, $trades, $canton]) {
            $providerDomain = $slug.'.'.$domain;
            $email = 'kontakt@'.$providerDomain;

            $user = User::query()->updateOrCreate(['email' => $email], [
                'role_id' => $providerRole->id,
                'name' => self::TAG.' '.$company,
                'company_name' => $company,
                'password' => bin2hex(random_bytes(16)),
                'status' => 'active',
            ]);

            $provider = ServiceProvider::query()->updateOrCreate(['user_id' => $user->id], [
                'company_name' => self::TAG.' '.$company,
                'contact_name' => 'Kontakt '.$company,
                'contact_email' => $email,
                'order_email' => 'auftrag@'.$providerDomain,
                'domain_suffix' => $providerDomain,
                'trade_groups' => $trades,
                'address' => 'Gewerbestrasse '.($index + 1),
                'postal_code' => '80'.str_pad((string) ($index + 10), 2, '0'),
                'city' => 'Zürich',
                'canton' => $canton,
                'phone' => '0447654'.$index,
                'is_vat_subject' => true,
                'status' => 'active',
            ]);

            $providers[] = $provider;
            $this->line('  provider DLS-'.str_pad((string) $provider->id, 5, '0', STR_PAD_LEFT).'  auftrag@'.$providerDomain);
        }

        return $providers;
    }

    /**
     * @param  array<int, User>  $owners
     * @param  array<int, PropertyManagerProfile>  $managers
     * @return array<int, Property>
     */
    private function createProperties(array $owners, array $managers): array
    {
        $rows = [
            ['Wohnüberbauung Seefeld', 'Seefeldstrasse 12', '8008', 'Zürich', 'ZH', 'Wohnen'],
            ['Geschäftshaus Enge', 'Engestrasse 4', '8002', 'Zürich', 'ZH', 'Gemischt'],
            ['Wohnhaus Oerlikon', 'Oerlikonerstrasse 88', '8050', 'Zürich', 'ZH', 'Wohnen'],
            ['Gewerbepark Baden', 'Industriestrasse 7', '5400', 'Baden', 'AG', 'Gewerbe'],
        ];
        $properties = [];

        foreach ($rows as $index => [$title, $street, $zip, $city, $canton, $usage]) {
            $owner = $owners[$index % count($owners)];
            $manager = $managers[$index % count($managers)];

            $property = Property::query()->updateOrCreate(
                ['li_number' => 'Li-9'.str_pad((string) ($index + 1), 4, '0', STR_PAD_LEFT)],
                [
                    'title' => self::TAG.' '.$title,
                    'management' => $manager->name,
                    'property_manager_profile_id' => $manager->id,
                    'address_line_1' => $street,
                    'postal_code' => $zip,
                    'city' => $city,
                    'state' => $canton,
                    'country' => 'CH',
                    'usage' => $usage,
                    'size' => 800 + ($index * 250),
                    'apartment_count' => 6 + $index,
                    'status' => 'active',
                    'created_by' => $owner->id,
                ]
            );

            $property->owners()->syncWithoutDetaching([$owner->id => ['assigned_at' => now()]]);

            foreach (range(1, 3) as $unit) {
                PropertyObject::query()->updateOrCreate(
                    ['property_id' => $property->id, 'reference' => 'OBJ-'.$property->id.'-'.$unit],
                    [
                        'name' => 'Wohnung '.$unit.'.OG',
                        'address' => $street,
                        'postal_code' => $zip,
                        'city' => $city,
                        'type' => 'apartment',
                        'status' => 'active',
                    ]
                );
            }

            $properties[] = $property;
            $this->line('  property '.$property->li_number.'  '.$title.'  owner='.$owner->email);
        }

        return $properties;
    }

    /**
     * Orders across every state the system can be in, each with competing
     * quotes so the evaluation and ranking have something to work on.
     *
     * @param  array<int, Property>  $properties
     * @param  array<int, PropertyManagerProfile>  $managers
     * @param  array<int, ServiceProvider>  $providers
     */
    private function createOrders(array $properties, array $managers, array $providers): void
    {
        $blueprints = [
            ['Treppenhaus streichen', 'painting', 'open', [['Malen', 'm2', 120, 58], ['Abdecken', 'pauschal', 1, 300]]],
            ['Heizung Jahreswartung', 'hvac_maintenance', 'in_review', [['Wartung', 'Std', 8, 130], ['Material', 'pauschal', 1, 250]]],
            ['Bad sanieren', 'plumbing', 'completed', [['Demontage', 'Std', 12, 120], ['Montage', 'Std', 20, 125]]],
            ['Bodenbelag ersetzen', 'flooring', 'completed', [['Boden', 'm2', 85, 74], ['Sockelleisten', 'm', 40, 22]]],
            ['Fassade reinigen', 'painting', 'cancelled', [['Reinigung', 'm2', 300, 12]]],
        ];

        foreach ($blueprints as $index => [$title, $trade, $status, $items]) {
            $property = $properties[$index % count($properties)];
            $manager = $managers[$index % count($managers)];
            $object = $property->objects()->first();

            $order = Order::query()->create([
                'property_id' => $property->id,
                'property_object_id' => $object?->id,
                'property_manager_profile_id' => $manager->id,
                'requester_name' => $manager->name,
                'requester_email' => $manager->email,
                'title' => self::TAG.' '.$title,
                'description' => 'Testauftrag für '.$title.' in '.$property->title.'.',
                'service_type' => $trade,
                'status' => $status === 'cancelled' ? 'cancelled' : $status,
                'workflow_type' => 'direct_order',
                'workflow_status' => 'published_for_quotes',
                'bid_deadline_at' => now()->addDays(7)->endOfDay(),
                'due_date' => now()->addDays(30),
                'requested_at' => now()->addDays(3),
                'quote_items' => array_map(fn (array $i): array => [
                    'label' => $i[0], 'code' => $i[0], 'unit' => $i[1], 'quantity' => $i[2],
                ], $items),
                'cancelled_at' => $status === 'cancelled' ? now() : null,
                'cancellation_reason' => $status === 'cancelled' ? 'Budget wurde für dieses Jahr gestrichen.' : null,
                'cancelled_by_type' => $status === 'cancelled' ? 'manager' : null,
                'cancelled_by_id' => $status === 'cancelled' ? $manager->id : null,
                'completed_at' => $status === 'completed' ? now()->subDays(5) : null,
                'provider_completed_at' => $status === 'completed' ? now()->subDays(5) : null,
            ]);

            // Three competing quotes: a plausible one, a cheap one and an
            // expensive one, so the evaluation has a real spread to score.
            $eligible = array_values(array_filter(
                $providers,
                fn (ServiceProvider $p): bool => $p->supportsServiceType($trade)
            )) ?: $providers;

            $factors = [1.0, 0.62, 1.45];
            $awarded = null;

            foreach (array_slice($eligible, 0, 3) as $slot => $provider) {
                $factor = $factors[$slot] ?? 1.0;
                $lineItems = array_map(fn (array $i): array => [
                    'label' => $i[0], 'code' => $i[0], 'unit' => $i[1],
                    'quantity' => $i[2], 'unit_price' => round($i[3] * $factor, 2),
                ], $items);
                $amount = round(array_sum(array_map(
                    fn (array $i): float => $i['quantity'] * $i['unit_price'],
                    $lineItems
                )), 2);

                $bid = Bid::query()->create([
                    'order_id' => $order->id,
                    'service_provider_id' => $provider->id,
                    'assigned_provider_email' => $provider->order_email,
                    'amount' => $amount,
                    'currency' => 'CHF',
                    'line_items' => $lineItems,
                    'estimated_start_date' => now()->addDays(4 + $slot),
                    'estimated_completion_date' => now()->addDays(20 + $slot),
                    'status' => $status === 'completed' && $slot === 0 ? 'approved' : 'submitted',
                    'submitted_at' => now()->subDays(2),
                ]);

                if ($status === 'completed' && $slot === 0) {
                    $awarded = $bid;
                }
            }

            // Completed jobs carry a confidential rating so the VERGO score
            // and the manager-rating category have data.
            if ($awarded) {
                ProviderReview::query()->updateOrCreate(
                    ['order_id' => $order->id, 'service_provider_id' => $awarded->service_provider_id],
                    [
                        'property_id' => $property->id,
                        'reviewer_manager_profile_id' => $manager->id,
                        'rating' => 4 + ($index % 2),
                        'comment' => 'Saubere Ausführung, Termin eingehalten.',
                    ]
                );

                $order->forceFill(['reviewed_at' => now()])->save();
            }

            $this->line('  order    '.$order->order_number.'  '.$title.'  ('.$status.')');
        }
    }

    /**
     * Allows the seeded managers to sign in on their properties by domain.
     *
     * @param  array<int, Property>  $properties
     */
    private function createManagerDomains(array $properties, string $domain): void
    {
        foreach ($properties as $property) {
            PropertyManagerDomain::query()->updateOrCreate(
                ['property_id' => $property->id, 'domain' => $domain],
                ['label' => self::TAG.' Demo-Domain']
            );
        }

        $this->line('  domains  '.$domain.' allowed on '.count($properties).' properties');
    }

    /**
     * Historical invoices give the price benchmarking something to compare
     * against, which is what the AI analysis reads.
     *
     * @param  array<int, Property>  $properties
     * @param  array<int, ServiceProvider>  $providers
     */
    private function createInvoiceDocuments(array $properties, array $providers): void
    {
        $rows = [
            ['Rechnung Malerarbeiten 2025', 'painting', 6800],
            ['Rechnung Heizungswartung 2025', 'hvac_maintenance', 1450],
            ['Rechnung Sanitaer 2025', 'plumbing', 3900],
            ['Rechnung Bodenbelag 2025', 'flooring', 7100],
        ];

        foreach ($rows as $index => [$title, $trade, $amount]) {
            $property = $properties[$index % count($properties)];
            $provider = $providers[$index % count($providers)];

            Document::query()->updateOrCreate(
                ['property_id' => $property->id, 'title' => self::TAG.' '.$title],
                [
                    'service_provider_id' => $provider->id,
                    'type' => 'invoice',
                    'service_type' => $trade,
                    'file_name' => str($title)->slug().'.pdf',
                    'file_path' => 'vergo-demo/'.str($title)->slug().'.pdf',
                    'mime_type' => 'application/pdf',
                    'size' => 120000 + ($index * 5000),
                    // Left pending so `vergo:process-ai-analysis` has work to do
                    // during the demo.
                    'status' => 'pending',
                ]
            );

            $this->line('  invoice  '.$title.'  ('.$trade.', CHF '.$amount.')');
        }
    }

    /**
     * @param  array<int, PropertyManagerProfile>  $managers
     */
    private function createSupportTickets(array $managers): void
    {
        $manager = $managers[0];

        SupportTicket::query()->updateOrCreate(
            ['subject' => self::TAG.' Frage zur Offertenfreigabe'],
            [
                // Same SUP-00001 scheme the controller uses.
                'ticket_number' => 'SUP-'.str_pad((string) (((int) SupportTicket::query()->max('id')) + 1), 5, '0', STR_PAD_LEFT),
                'requester_email' => $manager->email,
                'first_name' => 'Demo',
                'last_name' => 'Bewirtschaftung',
                'message' => 'Wie kann ich eine bereits freigegebene Offerte nachträglich anpassen?',
                'priority' => 'normal',
                'status' => 'open',
            ]
        );

        $this->line('  ticket   support ticket created');
    }

    private function removeDemoData(): void
    {
        $this->warn('Removing existing demo data...');

        $orders = Order::withTrashed()->where('title', 'like', self::TAG.'%')->get();

        foreach ($orders as $order) {
            ProviderReview::where('order_id', $order->id)->delete();
            $order->bids()->forceDelete();
            $order->forceDelete();
        }

        $properties = Property::where('title', 'like', self::TAG.'%')->get();

        foreach ($properties as $property) {
            $property->objects()->delete();
            $property->owners()->detach();
            $property->forceFill(['property_manager_profile_id' => null])->save();
            $property->delete();
        }

        ServiceProvider::where('company_name', 'like', self::TAG.'%')->get()
            ->each(function (ServiceProvider $provider): void {
                $userId = $provider->user_id;
                $provider->delete();
                User::where('id', $userId)->delete();
            });

        Document::where('title', 'like', self::TAG.'%')->delete();
        SupportTicket::where('subject', 'like', self::TAG.'%')->delete();
        PropertyManagerProfile::where('name', 'like', self::TAG.'%')->delete();
        User::where('name', 'like', self::TAG.'%')->delete();

        $this->line('  demo data removed');
    }
}
