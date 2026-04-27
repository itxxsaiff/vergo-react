import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PageContent from '../components/PageContent'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { formatStatusLabel, getStatusBadgeClass } from '../lib/tableStatus'
import { getOptionLabel, JOB_TYPE_OPTIONS } from '../lib/vergoOptions'

function getLatestAnalysisResult(results, analysisType) {
  return [...(results ?? [])]
    .filter((result) => result?.comparison_data?.analysis_type === analysisType)
    .sort((firstResult, secondResult) => new Date(secondResult?.created_at ?? 0) - new Date(firstResult?.created_at ?? 0))[0] ?? null
}

function OrderDetailsPage() {
  const { user } = useAuth()
  const { orderId } = useParams()
  const [order, setOrder] = useState(null)
  const [comparison, setComparison] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isComparing, setIsComparing] = useState(false)
  const [isComparingPrice, setIsComparingPrice] = useState(false)
  const [updatingBidId, setUpdatingBidId] = useState(null)
  const [isCompletingOrder, setIsCompletingOrder] = useState(false)
  const [reviewForm, setReviewForm] = useState({ rating: '', comment: '' })
  const [isSavingReview, setIsSavingReview] = useState(false)
  const [error, setError] = useState('')

  async function loadOrder() {
    setIsLoading(true)
    setError('')

    try {
      const response = await api.getOrder(orderId)
      const orderData = response.data ?? null
      setOrder(orderData)
      const bidComparisonResult = getLatestAnalysisResult(orderData?.analysis_results, 'bid_comparison')
      setComparison(bidComparisonResult)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadOrder()
  }, [orderId])

  async function handleCompare() {
    setIsComparing(true)
    setError('')

    try {
      const response = await api.compareOrderBids(orderId)
      const analysis = response.data?.analysis ?? null
      setComparison(analysis)
      await loadOrder()
    } catch (compareError) {
      setError(compareError.message)
    } finally {
      setIsComparing(false)
    }
  }

  async function handleComparePrice() {
    setIsComparingPrice(true)
    setError('')

    try {
      await api.compareOrderPrice(orderId)
      await loadOrder()
    } catch (compareError) {
      setError(compareError.message)
    } finally {
      setIsComparingPrice(false)
    }
  }

  async function handleBidDecision(bidId, status) {
    setUpdatingBidId(bidId)
    setError('')

    try {
      let rejectionReason = null

      if (status === 'rejected') {
        rejectionReason = window.prompt('Bitte geben Sie einen Ablehnungsgrund ein.')

        if (!rejectionReason?.trim()) {
          setUpdatingBidId(null)
          setError('Ein Ablehnungsgrund ist erforderlich, bevor das nächste Angebot geöffnet werden kann.')
          return
        }
      }

      await api.updateBid(bidId, {
        status,
        rejection_reason: rejectionReason,
      })
      await loadOrder()
    } catch (updateError) {
      setError(updateError.message)
    } finally {
      setUpdatingBidId(null)
    }
  }

  async function handleCompleteOrder() {
    setIsCompletingOrder(true)
    setError('')

    try {
      await api.completeOrder(orderId)
      await loadOrder()
    } catch (completeError) {
      setError(completeError.message)
    } finally {
      setIsCompletingOrder(false)
    }
  }

  async function handleReviewSubmit(event) {
    event.preventDefault()
    setError('')

    if (!reviewForm.rating) {
      setError('Bitte wählen Sie eine Bewertung aus, bevor Sie die Rezension speichern.')
      return
    }

    setIsSavingReview(true)

    try {
      await api.createProviderReview(orderId, {
        rating: Number(reviewForm.rating),
        comment: reviewForm.comment || null,
      })
      setReviewForm({ rating: '', comment: '' })
      await loadOrder()
    } catch (reviewError) {
      setError(reviewError.message)
    } finally {
      setIsSavingReview(false)
    }
  }

  const rankings = comparison?.comparison_data?.rankings ?? []
  const bidScoreMap = Object.fromEntries(rankings.map((item) => [item.bid_id, item]))
  const canShortlistBids = user?.role === 'manager'
  const canApproveBids = user?.role === 'owner'
  const canCompleteOrder = ['manager', 'owner'].includes(user?.role) && order?.status === 'approved'
  const canReviewProvider = ['manager', 'owner'].includes(user?.role) && order?.status === 'completed'
  const priceRecommendation = getLatestAnalysisResult(order?.analysis_results, 'price_recommendation')
  const providerReviews = order?.provider_reviews ?? []
  const actorReview = providerReviews.find((review) => review.reviewer_role === user?.role)
  const rankedBids = [...(order?.bids ?? [])].sort((firstBid, secondBid) => {
    const firstScore = Number(bidScoreMap[firstBid.id]?.final_score ?? -1)
    const secondScore = Number(bidScoreMap[secondBid.id]?.final_score ?? -1)

    if (firstScore === secondScore) {
      return new Date(secondBid.submitted_at ?? secondBid.created_at ?? 0) - new Date(firstBid.submitted_at ?? firstBid.created_at ?? 0)
    }

    return secondScore - firstScore
  })
  const recommendedBidId = rankings[0]?.bid_id ?? null
  const isQuoteWorkflow = order?.workflow_meta?.assignment?.award_mode === 'request_quotes' || ['published_for_quotes', 'awarded', 'quotes_rejected'].includes(order?.workflow_status)
  const bidDeadlinePassed = !order?.bid_deadline_at || new Date(order.bid_deadline_at) <= new Date()
  const firstPendingRankIndex = rankedBids.findIndex((bid) => !['rejected', 'approved', 'accepted', 'completed'].includes(bid.status))
  const visibleRankLimit = firstPendingRankIndex === -1 ? rankedBids.length : firstPendingRankIndex + 1
  const visibleRankedBids = user?.role === 'manager' && isQuoteWorkflow && bidDeadlinePassed
    ? rankedBids.slice(0, visibleRankLimit)
    : rankedBids

  return (
    <PageContent
      title="Auftragsdetails"
      subtitle="Überprüfen Sie Angebote, Vergleichsergebnisse und unterstützende Dokumente für diesen Auftrag."
      breadcrumbs={[
        { label: 'Armaturenbrett', href: '/dashboard' },
        { label: 'Aufträge', href: '/orders' },
        { label: 'Auftragsdetails' },
      ]}
    >
      {error ? <div className="alert alert-danger py-2">{error}</div> : null}
      {isLoading ? <div className="card"><div className="card-body">Details zur Ladefolge...</div></div> : null}

      {!isLoading && order ? (
        <div className="row">
          <div className="col-xl-4">
            <div className="card">
              <div className="card-body">
                <h5 className="fw-semibold mb-3">{order.title}</h5>
                <p className="text-muted mb-3">{order.description || 'Keine Beschreibung hinzugefügt.'}</p>

                <div className="mb-2">
                  <strong>Immobilie:</strong> {order.property?.li_number} - {order.property?.title}
                </div>

                <div className="mb-2">
                  <strong>Objekt:</strong> {order.property_object?.name || '-'}
                </div>

                <div className="mb-2">
                  <strong>Auftragstyp:</strong> {getOptionLabel(JOB_TYPE_OPTIONS, order.service_type)}
                </div>

                <div className="mb-2">
                  <strong>Objekt / Bauteil:</strong> {order.workflow_meta?.detail_catalog?.trade_object || '-'}
                </div>

                <div className="mb-2">
                  <strong>Tätigkeit:</strong> {order.workflow_meta?.detail_catalog?.trade_activity || '-'}
                </div>

                <div className="mb-2">
                  <strong>Fälligkeitsdatum:</strong> {order.due_date || '-'}
                </div>

                <div className="mb-2">
                  <strong>Abgeschlossen am:</strong> {order.completed_at || '-'}
                </div>

                <div className="mb-3">
                  <strong>Status:</strong>{' '}
                  <span className={getStatusBadgeClass(order.status)}>
                    {formatStatusLabel(order.status)}
                  </span>
                </div>

                <div className="d-flex gap-2 flex-wrap">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleCompare}
                    disabled={isComparing}
                  >
                    {isComparing ? 'Wird verglichen...' : 'Angebote vergleichen'}
                  </button>

                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={handleComparePrice}
                    disabled={isComparingPrice}
                  >
                    {isComparingPrice ? 'Preise werden verglichen...' : 'Preise vergleichen'}
                  </button>

                  <Link className="btn btn-light-primary" to="/documents">
                    Dokumente anzeigen
                  </Link>

                  {canCompleteOrder ? (
                    <button
                      type="button"
                      className="btn btn-warning"
                      onClick={handleCompleteOrder}
                      disabled={isCompletingOrder}
                    >
                      {isCompletingOrder ? 'Wird als abgeschlossen markiert...' : 'Als abgeschlossen markieren'}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <h5 className="fw-semibold mb-3">Anbieterbewertung</h5>

                {order.approved_bid?.service_provider ? (
                  <div className="mb-3">
                    <div className="text-muted fs-2">Genehmigter Anbieter</div>
                    <div className="fw-semibold">{order.approved_bid.service_provider.company_name}</div>
                    <div className="text-muted">{order.approved_bid.service_provider.contact_email}</div>
                  </div>
                ) : (
                  <div className="text-muted mb-3">Noch kein genehmigter Anbieter.</div>
                )}

                {providerReviews.length > 0 ? (
                  <div className="mb-4">
                    {providerReviews.map((review) => (
                      <div key={review.id} className="border rounded p-3 mb-2">
                        <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
                          <div className="fw-semibold">{review.reviewer_name}</div>
                          <span className="badge bg-light-primary text-primary">{review.rating}/5</span>
                        </div>
                        <div className="text-muted small mb-1">
                          {formatStatusLabel(review.reviewer_role)} Bewertung
                        </div>
                        <div>{review.comment || 'Kein Kommentar hinzugefügt.'}</div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {canReviewProvider ? (
                  actorReview ? (
                    <div className="alert alert-light-success border mb-0">
                      Sie haben bereits eine Bewertung für diesen abgeschlossenen Auftrag abgegeben.
                    </div>
                  ) : (
                    <form onSubmit={handleReviewSubmit}>
                      <div className="mb-3">
                        <label className="form-label">Bewertung</label>
                        <select
                          className="form-select"
                          value={reviewForm.rating}
                          onChange={(event) =>
                            setReviewForm((current) => ({ ...current, rating: event.target.value }))
                          }
                        >
                          <option value="">Bewertung auswählen</option>
                          <option value="5">5 - Ausgezeichnet</option>
                          <option value="4">4 - Gut</option>
                          <option value="3">3 - Durchschnittlich</option>
                          <option value="2">2 - Schwach</option>
                          <option value="1">1 - Schlecht</option>
                        </select>
                      </div>

                      <div className="mb-3">
                        <label className="form-label">Kommentar</label>
                        <textarea
                          className="form-control"
                          rows="3"
                          value={reviewForm.comment}
                          onChange={(event) =>
                            setReviewForm((current) => ({ ...current, comment: event.target.value }))
                          }
                          placeholder="Feedback zu Qualität, Zeitplanung und Zuverlässigkeit hinzufügen"
                        />
                      </div>

                      <button type="submit" className="btn btn-primary" disabled={isSavingReview}>
                        {isSavingReview ? 'Bewertung wird gespeichert...' : 'Bewertung absenden'}
                      </button>
                    </form>
                  )
                ) : (
                  <div className="text-muted mb-0">
                    Anbieterbewertungen sind erst verfügbar, nachdem die genehmigte Arbeit als abgeschlossen markiert wurde.
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <h5 className="fw-semibold mb-3">Preisempfehlung</h5>

                {priceRecommendation ? (
                  <>
                    <div className="d-flex align-items-center justify-content-between gap-3 mb-3">
                      <span className="text-muted">Aktuelles Signal</span>
                      <span className={getStatusBadgeClass(priceRecommendation.comparison_data?.pricing_signal)}>
                        {formatStatusLabel(priceRecommendation.comparison_data?.pricing_signal)}
                      </span>
                    </div>

                    <div className="mb-2">
                      <strong>Benchmark:</strong> {priceRecommendation.comparison_data?.benchmark_amount ?? '-'} {priceRecommendation.comparison_data?.recommended_bid_currency ?? 'EUR'}
                    </div>

                    <div className="mb-2">
                      <strong>Bestes Angebot:</strong> {priceRecommendation.comparison_data?.recommended_bid_amount ?? '-'} {priceRecommendation.comparison_data?.recommended_bid_currency ?? 'EUR'}
                    </div>

                    <div className="mb-2">
                      <strong>Abweichung:</strong> {priceRecommendation.comparison_data?.variance_percentage ?? '-'}%
                    </div>

                    <div className="mb-2">
                      <strong>Leistung:</strong> {getOptionLabel(JOB_TYPE_OPTIONS, priceRecommendation.comparison_data?.service_category) || priceRecommendation.comparison_data?.service_category || '-'}
                    </div>

                    <div className="mb-2">
                      <strong>Intervall:</strong> {priceRecommendation.comparison_data?.service_interval || '-'}
                    </div>

                    <div className="mb-0">
                      <strong>Quellen:</strong> {priceRecommendation.comparison_data?.benchmark_source_count ?? 0} analysierte Dokument(e)
                    </div>
                  </>
                ) : (
                  <div className="text-muted">
                    Noch keine endgültige Preisempfehlung. Verwenden Sie <strong>Preis vergleichen</strong>, nachdem die Dokumente analysiert wurden.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="col-xl-8">
            <div className="card">
              <div className="px-4 py-3 border-bottom d-flex align-items-center justify-content-between">
                <h5 className="card-title fw-semibold mb-0">Angebotsvergleich</h5>
                <span className="text-muted">{order.bids?.length ?? 0} Angebote</span>
              </div>

              <div className="card-body p-4">
                {user?.role === 'manager' && isQuoteWorkflow && !bidDeadlinePassed ? (
                  <div className="alert alert-light-primary border mb-4">
                    <div className="fw-semibold mb-1">Bieterrunde läuft noch</div>
                    <div>
                      Bis zur Angebotsfrist sehen Sie nur die Anzahl der eingegangenen Angebote.
                      {order?.bid_deadline_at ? ` Frist: ${order.bid_deadline_at}` : ''}
                    </div>
                    <div className="mt-2 fw-semibold">{order.bids?.length ?? 0} Angebote eingegangen</div>
                  </div>
                ) : null}

                {priceRecommendation ? (
                  <div
                    className={`alert ${priceRecommendation.comparison_data?.pricing_signal === 'too_high'
                        ? 'alert-light-danger'
                        : priceRecommendation.comparison_data?.pricing_signal === 'too_low'
                          ? 'alert-light-warning'
                          : 'alert-light-success'
                      } border mb-4`}
                  >
                    <div className="fw-semibold mb-1">Preisvergleich Ergebnis</div>
                    <div>{priceRecommendation.summary}</div>

                    {(priceRecommendation.comparison_data?.reasons ?? []).length > 0 ? (
                      <ul className="mb-0 mt-2 ps-3">
                        {priceRecommendation.comparison_data.reasons.map((reason, index) => (
                          <li key={`${reason}-${index}`}>{reason}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}

                {(priceRecommendation?.comparison_data?.benchmark_sources ?? []).length > 0 ? (
                  <div className="table-responsive rounded-2 mb-4">
                    <table className="table border-none text-nowrap customize-table mb-0 align-middle">
                      <thead className="text-dark fs-4">
                        <tr>
                          <th><h6 className="fs-4 fw-semibold mb-0">Quelle</h6></th>
                          <th><h6 className="fs-4 fw-semibold mb-0">Betrag</h6></th>
                          <th><h6 className="fs-4 fw-semibold mb-0">Typ</h6></th>
                          <th><h6 className="fs-4 fw-semibold mb-0">Übereinstimmung</h6></th>
                        </tr>
                      </thead>
                      <tbody>
                        {priceRecommendation.comparison_data.benchmark_sources.slice(0, 6).map((source, index) => (
                          <tr key={`${source.result_id}-${index}`}>
                            <td>{source.document_title || '-'}</td>
                            <td>{source.amount ?? '-'} {source.currency || ''}</td>
                            <td>{source.document_type ? formatStatusLabel(source.document_type) : '-'}</td>
                            <td>{source.match_score ?? '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {comparison ? (
                  <>
                    <div className="alert alert-light-primary border mb-4">
                      <div className="fw-semibold mb-1">Neueste Zusammenfassung</div>
                      <div>{comparison.summary}</div>
                    </div>

                    <div className="row g-3 mb-4">
                      <div className="col-md-3">
                        <div className="border rounded p-3 h-100">
                          <div className="text-muted fs-2">Durchschnitt</div>
                          <div className="fw-semibold">{comparison.comparison_data?.average_amount ?? '-'} EUR</div>
                        </div>
                      </div>

                      <div className="col-md-3">
                        <div className="border rounded p-3 h-100">
                          <div className="text-muted fs-2">Niedrigster Wert</div>
                          <div className="fw-semibold">{comparison.comparison_data?.lowest_amount ?? '-'}</div>
                        </div>
                      </div>

                      <div className="col-md-3">
                        <div className="border rounded p-3 h-100">
                          <div className="text-muted fs-2">Höchster Wert</div>
                          <div className="fw-semibold">{comparison.comparison_data?.highest_amount ?? '-'}</div>
                        </div>
                      </div>

                      <div className="col-md-3">
                        <div className="border rounded p-3 h-100">
                          <div className="text-muted fs-2">Spanne</div>
                          <div className="fw-semibold">{comparison.comparison_data?.spread_percentage ?? '-'}%</div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-muted mb-4">
                    Noch kein Vergleich durchgeführt. Klicken Sie auf <strong>Angebote vergleichen</strong>, um die erste Zusammenfassung zu erstellen.
                  </div>
                )}

                {user?.role === 'manager' && isQuoteWorkflow && !bidDeadlinePassed ? null : (
                <div className="table-responsive rounded-2 mb-0">
                  <table className="table border-none text-nowrap customize-table mb-0 align-middle">
                    <thead className="text-dark fs-4">
                      <tr>
                        <th><h6 className="fs-4 fw-semibold mb-0">Anbieter</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">Betrag</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">Zeitraum</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">Anhang</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">Status</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">Bewertung</h6></th>
                        {(canShortlistBids || canApproveBids) ? (
                          <th><h6 className="fs-4 fw-semibold mb-0">Entscheidung</h6></th>
                        ) : null}
                      </tr>
                    </thead>

                    <tbody>
                      {visibleRankedBids.length > 0 ? visibleRankedBids.map((bid, index) => {
                        const score = bidScoreMap[bid.id]

                        return (
                          <tr key={bid.id} className={recommendedBidId === bid.id ? 'table-light' : ''}>
                            <td>
                              <div className="fw-semibold d-flex align-items-center gap-2 flex-wrap">
                                <span>{bid.service_provider?.company_name || '-'}</span>
                                {recommendedBidId === bid.id ? (
                                  <span className="badge bg-light-success text-success fw-semibold fs-2 rounded-3 py-1 px-2">
                                    Empfohlen
                                  </span>
                                ) : null}
                              </div>
                              <div className="text-muted">
                                {bid.service_provider?.contact_email || '-'}
                                {score ? ` • Rang #${index + 1}` : ''}
                              </div>
                            </td>

                            <td>
                              <div>{bid.amount} {bid.currency}</div>
                              {(bid.line_items ?? []).length > 0 ? (
                                <div className="text-muted small">{bid.line_items.length} Positionen</div>
                              ) : null}
                            </td>

                            <td>
                              <div>{bid.estimated_start_date || '-'}</div>
                              <div className="text-muted">{bid.estimated_completion_date || '-'}</div>
                            </td>

                            <td>
                              {bid.attachment_name ? (
                                <button
                                  type="button"
                                  className="btn btn-light-primary btn-sm"
                                  onClick={() => api.downloadBidAttachment(bid.id, bid.attachment_name)}
                                >
                                  Herunterladen
                                </button>
                              ) : '-'}
                            </td>

                            <td>
                              <span className={getStatusBadgeClass(bid.status)}>
                                {formatStatusLabel(bid.status)}
                              </span>
                            </td>

                            <td>{score?.final_score ?? '-'}</td>

                            {(canShortlistBids || canApproveBids) ? (
                              <td>
                                <div className="d-flex gap-2 flex-wrap">
                                  {canShortlistBids && !isQuoteWorkflow ? (
                                    <button
                                      type="button"
                                      className="btn btn-light-primary btn-sm"
                                      disabled={updatingBidId === bid.id || bid.status !== 'submitted' || ['approved', 'completed', 'closed'].includes(order.status)}
                                      onClick={() => handleBidDecision(bid.id, 'shortlisted')}
                                    >
                                      Vorauswählen
                                    </button>
                                  ) : null}

                                  {canApproveBids ? (
                                    <>
                                      <button
                                        type="button"
                                        className="btn btn-success btn-sm"
                                        disabled={updatingBidId === bid.id || bid.status !== 'shortlisted' || ['approved', 'completed', 'closed'].includes(order.status)}
                                        onClick={() => handleBidDecision(bid.id, 'approved')}
                                      >
                                        Genehmigen
                                      </button>

                                      <button
                                        type="button"
                                        className="btn btn-light-danger text-danger btn-sm"
                                        disabled={updatingBidId === bid.id || bid.status !== 'shortlisted' || ['approved', 'completed', 'closed'].includes(order.status)}
                                        onClick={() => handleBidDecision(bid.id, 'rejected')}
                                      >
                                        Ablehnen
                                      </button>
                                    </>
                                  ) : null}

                                  {canShortlistBids && isQuoteWorkflow ? (
                                    <>
                                      <button
                                        type="button"
                                        className="btn btn-success btn-sm"
                                        disabled={updatingBidId === bid.id || ['approved', 'accepted', 'completed', 'rejected'].includes(bid.status)}
                                        onClick={() => handleBidDecision(bid.id, 'approved')}
                                      >
                                        Zuschlag erteilen
                                      </button>

                                      <button
                                        type="button"
                                        className="btn btn-light-danger text-danger btn-sm"
                                        disabled={updatingBidId === bid.id || ['approved', 'accepted', 'completed', 'rejected'].includes(bid.status)}
                                        onClick={() => handleBidDecision(bid.id, 'rejected')}
                                      >
                                        Ablehnen
                                      </button>
                                    </>
                                  ) : null}
                                </div>
                                {bid.rejection_reason ? <div className="text-muted small mt-2">{bid.rejection_reason}</div> : null}
                              </td>
                            ) : null}
                          </tr>
                        )
                      }) : (
                        <tr>
                          <td colSpan={(canShortlistBids || canApproveBids) ? '7' : '6'} className="text-center text-muted py-4">
                            Keine Angebote für diesen Auftrag gefunden.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="px-4 py-3 border-bottom">
                <h5 className="card-title fw-semibold mb-0">Verknüpfte Dokumente</h5>
              </div>

              <div className="card-body p-4">
                {(order.documents ?? []).length > 0 ? (
                  <div className="table-responsive rounded-2 mb-0">
                    <table className="table border-none text-nowrap customize-table mb-0 align-middle">
                      <thead className="text-dark fs-4">
                        <tr>
                          <th><h6 className="fs-4 fw-semibold mb-0">Titel</h6></th>
                          <th><h6 className="fs-4 fw-semibold mb-0">Typ</h6></th>
                          <th><h6 className="fs-4 fw-semibold mb-0">Status</h6></th>
                          <th><h6 className="fs-4 fw-semibold mb-0">Aktion</h6></th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.documents.map((document) => (
                          <tr key={document.id}>
                            <td>{document.title}</td>
                            <td>{formatStatusLabel(document.type)}</td>
                            <td>
                              <span className={getStatusBadgeClass(document.status)}>
                                {formatStatusLabel(document.status)}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-light-primary btn-sm"
                                onClick={() => api.downloadDocument(document.id, document.file_name)}
                              >
                                Herunterladen
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-muted">Keine Dokumente mit diesem Auftrag verknüpft.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </PageContent>
  )
}

export default OrderDetailsPage
