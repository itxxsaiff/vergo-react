<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bid;
use App\Models\Order;
use App\Models\User;
use App\Services\NotificationService;
use App\Services\OfferAwardService;
use App\Services\OrderCompletionService;
use App\Services\ProviderRatingService;
use App\Services\VergoRankingService;
use Illuminate\Http\JsonResponse;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;

class OrderCompletionController extends Controller
{
    /**
     * The provider marks the job finished. This closes the order, opens the
     * confidential rating window for the client, and returns the invoicing
     * summary the provider needs.
     */
    public function complete(
        Request $request,
        Order $order,
        OrderCompletionService $completionService,
        ProviderRatingService $ratingService,
        VergoRankingService $rankingService,
    ): JsonResponse {
        $bid = $this->authorizeProviderForOrder($request, $order);

        abort_unless(
            in_array($order->status, ['approved', 'in_progress'], true),
            422,
            'Only an awarded order can be marked as completed.'
        );

        $order = $completionService->markProviderCompleted($order);

        // Ask the client for the confidential rating straight away; reminders
        // follow every two days via vergo:rating-reminders.
        $ratingService->sendRatingRequest($order->load(['propertyManager', 'approvedBid.serviceProvider']));
        $rankingService->recalculate($bid->serviceProvider);

        return response()->json([
            'message' => 'Order marked as completed.',
            'data' => $completionService->buildSummary($order->fresh()),
        ]);
    }

    /**
     * The same summary on demand, so the provider can look it up again.
     */
    public function summary(Request $request, Order $order, OrderCompletionService $completionService): JsonResponse
    {
        $this->authorizeProviderForOrder($request, $order);

        return response()->json([
            'data' => $completionService->buildSummary($order),
        ]);
    }

    /**
     * The same invoicing summary as a printable document with the Vergo logo,
     * so the company can file it or work from it while writing the invoice.
     */
    public function summaryPdf(Request $request, Order $order, OrderCompletionService $completionService)
    {
        $this->authorizeProviderForOrder($request, $order);

        $language = in_array($request->query('language'), ['de', 'en', 'fr', 'it'], true)
            ? $request->query('language')
            : 'de';

        $pdf = Pdf::loadView('pdf.completion-summary', [
            'summary' => $completionService->buildSummary($order),
            'order' => $order,
            'logoDataUri' => $this->pdfLogoDataUri(),
            'generatedAt' => now()->format('d.m.Y H:i'),
            'labels' => $this->summaryLabels($language),
        ])->setPaper('a4', 'portrait');

        return $pdf->stream(($order->order_number ?: 'vergo-auftrag').'-rechnungsangaben.pdf');
    }

    /**
     * Wording for the invoicing sheet, in the language the provider works in.
     *
     * @return array<string, string>
     */
    private function summaryLabels(string $language): array
    {
        $all = [
            'de' => [
                'title' => 'Angaben zur Rechnungsstellung', 'order' => 'Auftrag', 'generated' => 'erstellt am',
                'object' => 'Objekt', 'property' => 'Liegenschaft', 'address' => 'Adresse', 'zip_city' => 'PLZ / Ort',
                'owner' => 'Eigentuemer', 'management' => 'Bewirtschaftung', 'recipient' => 'Rechnungsempfaenger',
                'company' => 'Firma', 'name' => 'Name', 'send_to' => 'Rechnung senden an',
                'by_email' => 'per E-Mail', 'by_post' => 'per Post', 'services' => 'Erbrachte Leistungen',
                'position' => 'Position', 'unit' => 'Einheit', 'quantity' => 'Menge', 'price' => 'Preis',
                'amount' => 'Betrag', 'total' => 'Total', 'no_items' => 'Keine Positionen erfasst.',
                'none' => 'Keine Angaben hinterlegt.', 'your_quote_number' => 'Ihre Angebotsnummer',
            ],
            'en' => [
                'title' => 'Invoicing details', 'order' => 'Order', 'generated' => 'created on',
                'object' => 'Object', 'property' => 'Property', 'address' => 'Address', 'zip_city' => 'ZIP / City',
                'owner' => 'Owner', 'management' => 'Property management', 'recipient' => 'Invoice recipient',
                'company' => 'Company', 'name' => 'Name', 'send_to' => 'Send invoice to',
                'by_email' => 'by e-mail', 'by_post' => 'by post', 'services' => 'Services provided',
                'position' => 'Item', 'unit' => 'Unit', 'quantity' => 'Quantity', 'price' => 'Price',
                'amount' => 'Amount', 'total' => 'Total', 'no_items' => 'No items recorded.',
                'none' => 'No details on file.', 'your_quote_number' => 'Your quote number',
            ],
            'it' => [
                'title' => 'Dati per la fatturazione', 'order' => 'Ordine', 'generated' => 'creato il',
                'object' => 'Oggetto', 'property' => 'Immobile', 'address' => 'Indirizzo', 'zip_city' => 'CAP / Citta',
                'owner' => 'Proprietario', 'management' => 'Amministrazione', 'recipient' => 'Destinatario fattura',
                'company' => 'Azienda', 'name' => 'Nome', 'send_to' => 'Inviare la fattura a',
                'by_email' => 'via e-mail', 'by_post' => 'per posta', 'services' => 'Prestazioni eseguite',
                'position' => 'Voce', 'unit' => 'Unita', 'quantity' => 'Quantita', 'price' => 'Prezzo',
                'amount' => 'Importo', 'total' => 'Totale', 'no_items' => 'Nessuna voce registrata.',
                'none' => 'Nessun dato disponibile.', 'your_quote_number' => 'Il tuo numero di offerta',
            ],
            'fr' => [
                'title' => 'Donnees de facturation', 'order' => 'Commande', 'generated' => 'cree le',
                'object' => 'Objet', 'property' => 'Bien', 'address' => 'Adresse', 'zip_city' => 'NPA / Localite',
                'owner' => 'Proprietaire', 'management' => 'Gerance', 'recipient' => 'Destinataire de la facture',
                'company' => 'Entreprise', 'name' => 'Nom', 'send_to' => 'Envoyer la facture a',
                'by_email' => 'par e-mail', 'by_post' => 'par courrier', 'services' => 'Prestations fournies',
                'position' => 'Poste', 'unit' => 'Unite', 'quantity' => 'Quantite', 'price' => 'Prix',
                'amount' => 'Montant', 'total' => 'Total', 'no_items' => 'Aucun poste enregistre.',
                'none' => 'Aucune donnee disponible.', 'your_quote_number' => 'Votre numero d offre',
            ],
        ];

        return $all[$language] ?? $all['de'];
    }

    /**
     * The Vergo logo inlined, so the PDF renders it without a network call.
     */
    private function pdfLogoDataUri(): string
    {
        $logoPath = collect([
            public_path('VERGO.png'),
            base_path('../public/VERGO.png'),
            base_path('../../public/VERGO.png'),
        ])->first(fn (string $path) => file_exists($path));

        if (! $logoPath) {
            return '';
        }

        return 'data:'.(mime_content_type($logoPath) ?: 'image/png').';base64,'.base64_encode(file_get_contents($logoPath));
    }

    /**
     * The provider confirms an awarded job and work begins. Everyone else's
     * offer is closed off at the same moment.
     */
    public function acceptAward(Request $request, Order $order, OfferAwardService $award, NotificationService $notifications): JsonResponse
    {
        $bid = $this->awardedBid($request, $order);

        $award->providerAccept($bid);
        $notifications->sendProviderResponse($bid->fresh()->load(['order.property.owners', 'order.property.managerProfiles', 'serviceProvider']), 'accepted');

        return response()->json(['message' => 'Job accepted. You can start work.']);
    }

    /**
     * The provider turns the award down; the manager picks someone else.
     */
    public function declineAward(Request $request, Order $order, OfferAwardService $award, NotificationService $notifications): JsonResponse
    {
        $bid = $this->awardedBid($request, $order);

        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:2000'],
        ]);

        $award->providerDecline($bid, $validated['reason'] ?? null);
        $notifications->sendProviderResponse($bid->fresh()->load(['order.property.owners', 'order.property.managerProfiles', 'serviceProvider']), 'rejected');

        return response()->json(['message' => 'Job declined. The management has been informed.']);
    }

    /**
     * The provider abandons a job that had already started. A substantial
     * reason is required and is kept for the owner to review.
     */
    public function cancelAward(Request $request, Order $order, OfferAwardService $award, NotificationService $notifications): JsonResponse
    {
        $actor = $request->user();
        abort_unless($actor instanceof User && $actor->role?->name === 'provider', 403);

        $provider = $actor->serviceProvider;
        abort_unless($provider, 403);

        $bid = $order->bids()
            ->where('service_provider_id', $provider->id)
            ->whereIn('status', ['accepted', 'approved'])
            ->first();

        abort_unless($bid, 403, 'You have no running job on this order.');

        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:20', 'max:2000'],
        ], [
            'reason.min' => 'Please give a reason of at least 20 characters.',
            'reason.required' => 'Please state why you are cancelling this job.',
        ]);

        $award->providerCancel($bid->setRelation('serviceProvider', $provider), $validated['reason']);
        $notifications->sendProviderResponse($bid->fresh()->load(['order.property.owners', 'order.property.managerProfiles', 'serviceProvider']), 'rejected');

        return response()->json(['message' => 'Job cancelled. The management has been informed.']);
    }

    /**
     * The bid this provider was awarded and has not answered yet.
     */
    private function awardedBid(Request $request, Order $order): Bid
    {
        $actor = $request->user();
        abort_unless($actor instanceof User && $actor->role?->name === 'provider', 403);

        $provider = $actor->serviceProvider;
        abort_unless($provider, 403);

        $bid = $order->bids()
            ->where('service_provider_id', $provider->id)
            ->where('status', 'awarded_pending_acceptance')
            ->first();

        abort_unless($bid, 403, 'This order is not awaiting your acceptance.');

        return $bid->setRelation('serviceProvider', $provider);
    }

    private function authorizeProviderForOrder(Request $request, Order $order)
    {
        $actor = $request->user();

        abort_unless($actor instanceof User && $actor->role?->name === 'provider', 403);

        $provider = $actor->serviceProvider;
        abort_unless($provider, 403);

        $bid = $order->bids()
            ->where('service_provider_id', $provider->id)
            ->whereIn('status', ['approved', 'accepted', 'completed'])
            ->first();

        abort_unless($bid, 403, 'This order is not awarded to your company.');

        return $bid->setRelation('serviceProvider', $provider);
    }
}
