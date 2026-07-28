import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import PageContent from '../components/PageContent'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { api } from '../lib/api'
import { formatDateDisplay, formatDateTimeDisplay, formatTimeDisplay } from '../lib/dateFormat'
import { formatStatusLabel, getStatusBadgeClass } from '../lib/tableStatus'
import { getOptionLabel, JOB_TYPE_OPTIONS } from '../lib/vergoOptions'

function getLatestAnalysisResult(results, analysisType) {
  return [...(results ?? [])]
    .filter((result) => result?.comparison_data?.analysis_type === analysisType)
    .sort((firstResult, secondResult) => new Date(secondResult?.created_at ?? 0) - new Date(firstResult?.created_at ?? 0))[0] ?? null
}

function getInspectionSlots(order) {
  return order?.workflow_meta?.inspection?.preferred_slots ?? []
}

function getOnsiteContact(order) {
  return order?.workflow_meta?.inspection?.onsite_contact ?? {}
}

function getOnsiteName(contact) {
  return [contact?.first_name, contact?.last_name].filter(Boolean).join(' ') || '-'
}

function isInspectionOrder(order) {
  return order?.workflow_type === 'inspection'
    || order?.workflow_meta?.flow_type === 'inspection'
    || (order?.workflow_meta?.inspection?.preferred_slots ?? []).length > 0
    || ['inspection_requested', 'public_inspection_open', 'inspection_signup_closed', 'inspection_company_selected'].includes(order?.workflow_status)
}

// Which inspection slot was accepted, so it can be highlighted green.
// Uses the confirmed provider's selected slot; if only one option exists and the
// inspection is confirmed, that single option is treated as accepted.
function getAcceptedSlotIndex(order, slots) {
  const confirmedStatuses = ['inspection_confirmed', 'accepted', 'approved', 'completed']
  const confirmedBid = (order?.bids ?? []).find((bid) => confirmedStatuses.includes(bid.status))

  if (!confirmedBid) {
    return null
  }

  const rawIndex = Number(confirmedBid.workflow_meta?.selected_slot_index)

  if (Number.isInteger(rawIndex) && rawIndex >= 0 && rawIndex < (slots?.length ?? 0)) {
    return rawIndex
  }

  return (slots?.length ?? 0) > 0 ? 0 : null
}

// A provider has submitted a priced offer after the inspection.
function getSubmittedQuoteBid(order) {
  return (order?.bids ?? []).find((bid) => ['submitted', 'shortlisted', 'approved', 'accepted', 'completed'].includes(bid.status)) ?? null
}

function getQuoteTaskKey(optionIndex, itemIndex) {
  return `${optionIndex}:${itemIndex}`
}

function getDefaultQuoteTaskKeys(order) {
  const firstOption = order?.inspection_quote_options?.[0]

  return (firstOption?.line_items ?? []).map((_, itemIndex) => getQuoteTaskKey(0, itemIndex))
}

function getSelectedQuoteItems(quoteOptions, selectedTaskKeys) {
  const selectedKeySet = new Set(selectedTaskKeys)

  return quoteOptions.flatMap((option, optionIndex) => (
    (option.line_items ?? [])
      .filter((_, itemIndex) => selectedKeySet.has(getQuoteTaskKey(optionIndex, itemIndex)))
      .map((item) => {
        const category = item.category || item.code || item.label || ''

        return {
          category,
          label: item.label || '',
          code: item.code || category,
          unit: item.unit || '',
          quantity: Number(item.quantity || 0),
          source: 'provider',
          is_custom: Boolean(item.is_custom ?? true),
          source_bid_id: option.source_bid_id || item.source_bid_id || null,
        }
      })
  ))
}

function getInspectionQuoteGenerateStorageKey(orderId) {
  return `vergo.inspectionQuoteGenerate.${orderId}`
}

function getFallbackQuoteItems(order) {
  const sourceBidId = order?.workflow_meta?.inspection?.quote_seed_bid_id ?? null

  return (order?.quote_items ?? []).map((item) => {
    const category = item.category || item.code || item.label || ''

    return {
      category,
      label: item.label || '',
      code: item.code || category,
      unit: item.unit || '',
      quantity: Number(item.quantity || 0),
      source: 'provider',
      is_custom: Boolean(item.is_custom ?? true),
      source_bid_id: sourceBidId,
    }
  })
}

function getOrderDueDateLabel(order, t) {
  if (order?.due_date) {
    return formatDateDisplay(order.due_date)
  }

  if (order?.workflow_meta?.assignment?.completion_mode === 'asap') {
    return t('So bald wie möglich')
  }

  return t('Nicht festgelegt')
}

function formatBidDeadlineDisplay(value, language) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return formatDateDisplay(value)
  }

  const localeMap = {
    de: 'de-CH',
    en: 'en-US',
    fr: 'fr-FR',
    it: 'it-IT',
  }

  return new Intl.DateTimeFormat(localeMap[language] ?? 'de-CH', {
    day: 'numeric',
    month: language === 'de' ? '2-digit' : 'long',
    year: 'numeric',
  }).format(date)
}

function getReceivedBidsLabel(count, t) {
  return `${count} ${count === 1 ? t('Angebot eingegangen') : t('Angebote eingegangen')}`
}

function OrderDetailsPage() {
  const { user } = useAuth()
  const { t, language } = useLanguage()
  const { orderId } = useParams()
  const navigate = useNavigate()
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false)
  const [order, setOrder] = useState(null)
  const [comparison, setComparison] = useState(null)
  const [hasAutoCompared, setHasAutoCompared] = useState(false)
  const [hasAutoComparedPrice, setHasAutoComparedPrice] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isComparing, setIsComparing] = useState(false)
  const [isComparingPrice, setIsComparingPrice] = useState(false)
  const [updatingBidId, setUpdatingBidId] = useState(null)
  const [isCompletingOrder, setIsCompletingOrder] = useState(false)
  const [reviewForm, setReviewForm] = useState({
    communication_rating: '',
    punctuality_rating: '',
    quality_rating: '',
    comment: '',
  })
  const [isSavingReview, setIsSavingReview] = useState(false)
  const [selectedQuoteTaskKeys, setSelectedQuoteTaskKeys] = useState([])
  const [selectedBidDetailId, setSelectedBidDetailId] = useState(null)
  const [error, setError] = useState('')

  const loadOrder = useCallback(async function loadOrder() {
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
  }, [orderId])

  useEffect(() => {
    setHasAutoCompared(false)
    setHasAutoComparedPrice(false)
    setSelectedBidDetailId(null)
  }, [orderId])

  useEffect(() => {
    loadOrder()
  }, [loadOrder])

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
          return false
        }
      }

      await api.updateBid(bidId, {
        status,
        rejection_reason: rejectionReason,
      })
      await loadOrder()
      return true
    } catch (updateError) {
      setError(updateError.message)
      return false
    } finally {
      setUpdatingBidId(null)
    }
  }

  async function handleBidDetailDecision(bidId, status) {
    const didUpdate = await handleBidDecision(bidId, status)

    if (didUpdate) {
      setSelectedBidDetailId(null)
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

  function handleStartQuoteRequestWizard() {
    setError('')

    try {
      const quoteOptions = order?.inspection_quote_options ?? []
      const selectedQuoteItems = quoteOptions.length > 0
        ? getSelectedQuoteItems(quoteOptions, selectedQuoteTaskKeys)
        : getFallbackQuoteItems(order)

      if (quoteOptions.length > 0 && selectedQuoteItems.length === 0) {
        setError(t('Bitte wählen Sie mindestens eine Leistungsposition aus.'))
        return
      }

      window.sessionStorage.setItem(getInspectionQuoteGenerateStorageKey(orderId), JSON.stringify({
        source_order_id: Number(orderId),
        quote_items: selectedQuoteItems,
        quote_source_bid_ids: [...new Set(selectedQuoteItems.map((item) => item.source_bid_id).filter(Boolean))],
        saved_at: new Date().toISOString(),
      }))

      navigate(`/orders?generate-from=${orderId}`)
    } catch {
      setError(t('Die ausgewählten Positionen konnten nicht vorbereitet werden.'))
    }
  }

  async function handleReviewSubmit(event) {
    event.preventDefault()
    setError('')

    if (!reviewForm.communication_rating || !reviewForm.punctuality_rating || !reviewForm.quality_rating) {
      setError('Bitte bewerten Sie Kommunikation, Pünktlichkeit und Arbeitsqualität.')
      return
    }

    setIsSavingReview(true)

    try {
      await api.createProviderReview(orderId, {
        communication_rating: Number(reviewForm.communication_rating),
        punctuality_rating: Number(reviewForm.punctuality_rating),
        quality_rating: Number(reviewForm.quality_rating),
        comment: reviewForm.comment || null,
      })
      setReviewForm({
        communication_rating: '',
        punctuality_rating: '',
        quality_rating: '',
        comment: '',
      })
      await loadOrder()
    } catch (reviewError) {
      setError(reviewError.message)
    } finally {
      setIsSavingReview(false)
    }
  }

  function openQuoteModal() {
    setError('')
    setSelectedQuoteTaskKeys(getDefaultQuoteTaskKeys(order))
    setIsQuoteModalOpen(true)
  }

  function toggleQuoteTask(taskKey) {
    setError('')
    setSelectedQuoteTaskKeys((current) => (
      current.includes(taskKey)
        ? current.filter((key) => key !== taskKey)
        : [...current, taskKey]
    ))
  }

  function selectQuoteOption(optionIndex, itemCount) {
    setError('')
    setSelectedQuoteTaskKeys(
      Array.from({ length: itemCount }, (_, itemIndex) => getQuoteTaskKey(optionIndex, itemIndex))
    )
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
  const comparableBids = (order?.bids ?? []).filter((bid) => !bid.prices_hidden)
  const arrivalOrderedBids = [...comparableBids].sort((firstBid, secondBid) => {
    const firstDate = new Date(firstBid.submitted_at ?? firstBid.created_at ?? 0)
    const secondDate = new Date(secondBid.submitted_at ?? secondBid.created_at ?? 0)

    if (firstDate.getTime() === secondDate.getTime()) {
      return Number(firstBid.id) - Number(secondBid.id)
    }

    return firstDate - secondDate
  })
  const hasAiRanking = rankings.length > 0
  const rankingIndexByBidId = Object.fromEntries(rankings.map((item, index) => [item.bid_id, index]))
  const rankedBids = hasAiRanking
    ? [...comparableBids].sort((firstBid, secondBid) => {
      const firstIndex = rankingIndexByBidId[firstBid.id] ?? Number.MAX_SAFE_INTEGER
      const secondIndex = rankingIndexByBidId[secondBid.id] ?? Number.MAX_SAFE_INTEGER

      if (firstIndex === secondIndex) {
        return arrivalOrderedBids.findIndex((bid) => bid.id === firstBid.id) - arrivalOrderedBids.findIndex((bid) => bid.id === secondBid.id)
      }

      return firstIndex - secondIndex
    })
    : arrivalOrderedBids
  const recommendedBidId = hasAiRanking ? rankings[0]?.bid_id ?? null : null
  const isQuoteWorkflow = order?.workflow_meta?.assignment?.award_mode === 'request_quotes' || ['published_for_quotes', 'awarded', 'quotes_rejected'].includes(order?.workflow_status)
  const bidDeadlinePassed = !order?.bid_deadline_at || new Date(order.bid_deadline_at) <= new Date()
  const shouldHideBidPrices = isQuoteWorkflow && !bidDeadlinePassed
  const managerAnonymousBidReview = user?.role === 'manager' && isQuoteWorkflow && bidDeadlinePassed
  const canShowBidPricesInline = !shouldHideBidPrices && !managerAnonymousBidReview
  const showManualAnalysisButtons = canShowBidPricesInline && user?.role !== 'manager'
  const visibleRankedBids = rankedBids
  const selectedBidDetail = selectedBidDetailId
    ? visibleRankedBids.find((bid) => bid.id === selectedBidDetailId) ?? comparableBids.find((bid) => bid.id === selectedBidDetailId) ?? null
    : null
  const selectedBidDetailIndex = selectedBidDetail
    ? Math.max(0, visibleRankedBids.findIndex((bid) => bid.id === selectedBidDetail.id))
    : -1
  const selectedBidDetailScore = selectedBidDetail ? bidScoreMap[selectedBidDetail.id] : null
  const inspectionSlots = getInspectionSlots(order)
  const onsiteContact = getOnsiteContact(order)
  const isInspectionDetails = isInspectionOrder(order)
  const acceptedSlotIndex = getAcceptedSlotIndex(order, inspectionSlots)
  const submittedQuoteBid = getSubmittedQuoteBid(order)
  const inspectionQuoteOptions = order?.inspection_quote_options ?? []
  const quoteServices = order?.quote_items ?? []
  const hasQuoteToGenerate = inspectionQuoteOptions.length > 0 || (Boolean(submittedQuoteBid) && quoteServices.length > 0)
  const hasMultipleInspectionQuoteOptions = inspectionQuoteOptions.length > 1
  const selectedQuoteItems = getSelectedQuoteItems(inspectionQuoteOptions, selectedQuoteTaskKeys)
  const selectedQuoteTaskKeySet = new Set(selectedQuoteTaskKeys)
  const comparisonBenchmarkSources = comparison?.comparison_data?.standard_benchmark_sources
    ?? comparison?.comparison_data?.invoice_benchmark_sources
    ?? []
  const canPublishInspectionQuote = user?.role === 'manager'
    && order?.workflow_status === 'inspection_quote_created'
    && hasQuoteToGenerate
  const quoteRequestAlreadyPublished = order?.workflow_status === 'published_for_quotes'

  useEffect(() => {
    if (
      !order
      || comparison
      || hasAutoCompared
      || isComparing
      || shouldHideBidPrices
      || !isQuoteWorkflow
      || !bidDeadlinePassed
      || comparableBids.length === 0
      || !['admin', 'manager'].includes(user?.role)
    ) {
      return undefined
    }

    let cancelled = false

    async function runAutomaticComparison() {
      setHasAutoCompared(true)
      setIsComparing(true)
      setError('')

      try {
        const comparisonResponse = await api.compareOrderBids(orderId)

        if (cancelled) {
          return
        }

        setComparison(comparisonResponse.data?.analysis ?? null)

        const orderResponse = await api.getOrder(orderId)

        if (!cancelled) {
          setOrder(orderResponse.data ?? null)
        }
      } catch (compareError) {
        if (!cancelled) {
          setError(compareError.message)
        }
      } finally {
        if (!cancelled) {
          setIsComparing(false)
        }
      }
    }

    runAutomaticComparison()

    return () => {
      cancelled = true
    }
  }, [bidDeadlinePassed, comparableBids.length, comparison, hasAutoCompared, isComparing, isQuoteWorkflow, order, orderId, shouldHideBidPrices, user?.role])

  useEffect(() => {
    if (
      !order
      || priceRecommendation
      || hasAutoComparedPrice
      || isComparingPrice
      || shouldHideBidPrices
      || !isQuoteWorkflow
      || !bidDeadlinePassed
      || comparableBids.length === 0
      || !['admin', 'manager'].includes(user?.role)
    ) {
      return undefined
    }

    let cancelled = false

    async function runAutomaticPriceComparison() {
      setHasAutoComparedPrice(true)
      setIsComparingPrice(true)

      try {
        await api.compareOrderPrice(orderId)
        const orderResponse = await api.getOrder(orderId)

        if (!cancelled) {
          const orderData = orderResponse.data ?? null
          setOrder(orderData)
          setComparison(getLatestAnalysisResult(orderData?.analysis_results, 'bid_comparison'))
        }
      } catch (compareError) {
        if (!cancelled) {
          setError(compareError.message)
        }
      } finally {
        if (!cancelled) {
          setIsComparingPrice(false)
        }
      }
    }

    runAutomaticPriceComparison()

    return () => {
      cancelled = true
    }
  }, [bidDeadlinePassed, comparableBids.length, hasAutoComparedPrice, isComparingPrice, isQuoteWorkflow, order, orderId, priceRecommendation, shouldHideBidPrices, user?.role])

  return (
    <PageContent
      title={isInspectionDetails ? t('Besichtigungsdetails') : t('Auftragsdetails')}
      subtitle={isInspectionDetails
        ? ''
        : t('Überprüfen Sie Angebote, Vergleichsergebnisse und unterstützende Dokumente für diesen Auftrag.')}
      breadcrumbs={[
        { label: t('Dashboard'), href: '/dashboard' },
        { label: t('Aufträge'), href: '/orders' },
        { label: isInspectionDetails ? t('Besichtigungsdetails') : t('Auftragsdetails') },
      ]}
    >
      {error ? <div className="alert alert-danger py-2">{error}</div> : null}
      {isLoading ? <div className="card"><div className="card-body">{t('Details werden geladen...')}</div></div> : null}

      {!isLoading && order ? (
        isInspectionDetails ? (
          <div className="row">
            <div className="col-xl-7">
              <div className="card">
                <div className="card-body">
                  <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap mb-3">
                    <div>
                      <div className="text-muted small text-uppercase fw-semibold mb-1">{t('Aktivität')}</div>
                      <h4 className="fw-semibold mb-2">{order.title || '-'}</h4>
                      <div className="text-muted small text-uppercase fw-semibold mb-1">{t('Auftragstext')}</div>
                      <p className="text-muted mb-0">{order.description || t('Keine Beschreibung hinzugefügt.')}</p>
                    </div>
                    <span className={getStatusBadgeClass(order.status)}>
                      {t(formatStatusLabel(order.status))}
                    </span>
                  </div>

                  <div className="vergo-inspection-section mb-3">
                    <div className="vergo-inspection-section-title">{t('Liegenschaft')}</div>
                    <div className="vergo-inspection-property-grid">
                      <div className="vergo-inspection-property-cell">
                        <span>{t('Name')}</span>
                        <strong>{order.property?.title || '-'}</strong>
                      </div>
                      <div className="vergo-inspection-property-cell">
                        <span>{t('LI-Nummer')}</span>
                        <strong>{order.property?.li_number || '-'}</strong>
                      </div>
                      <div className="vergo-inspection-property-cell">
                        <span>{t('Adresse')}</span>
                        <strong>{order.property_object?.address || order.property_object?.name || '-'}</strong>
                      </div>
                      <div className="vergo-inspection-property-cell">
                        <span>{t('PLZ')}</span>
                        <strong>{order.property_object?.postal_code || order.property?.postal_code || '-'}</strong>
                      </div>
                      <div className="vergo-inspection-property-cell">
                        <span>{t('Ort')}</span>
                        <strong>{order.property_object?.city || order.property?.city || '-'}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="vergo-inspection-section mb-3">
                    <div className="vergo-inspection-section-title">{t('Besichtigungstermine')}</div>
                    {inspectionSlots.length > 0 ? (
                      <div className="row g-3">
                        {inspectionSlots.map((slot, index) => (
                          <div className="col-md-6" key={`${slot.date}-${slot.time}-${index}`}>
                            <div className={`vergo-inspection-detail-card h-100${index === acceptedSlotIndex ? ' is-accepted-slot' : ''}`}>
                              <div className="vergo-inspection-detail-label">{t('Option')} {index + 1}</div>
                              <div className="vergo-inspection-detail-value">{formatDateDisplay(slot.date)}</div>
                              <div className="vergo-inspection-detail-subvalue">{formatTimeDisplay(slot.time)}</div>
                              <div className="vergo-inspection-detail-subvalue">{t('Offerte erstellen bis')}: {formatDateDisplay(slot.quote_due_date)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="vergo-inspection-empty">{t('Keine Besichtigungstermine hinterlegt.')}</div>
                    )}
                  </div>

                  <div className="vergo-inspection-section">
                    <div className="vergo-inspection-section-title">{t('Kontakt vor Ort')}</div>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <div className="vergo-inspection-detail-card h-100">
                          <div className="vergo-inspection-detail-label">{t('Firma')}</div>
                          <div className="vergo-inspection-detail-value">{onsiteContact.company || '-'}</div>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="vergo-inspection-detail-card h-100">
                          <div className="vergo-inspection-detail-label">{t('Name')}</div>
                          <div className="vergo-inspection-detail-value">{getOnsiteName(onsiteContact)}</div>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="vergo-inspection-detail-card h-100">
                          <div className="vergo-inspection-detail-label">{t('Telefon')}</div>
                          <div className="vergo-inspection-detail-value">{onsiteContact.phone || '-'}</div>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="vergo-inspection-detail-card h-100">
                          <div className="vergo-inspection-detail-label">{t('E-Mail')}</div>
                          <div className="vergo-inspection-detail-value">{onsiteContact.email || '-'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-xl-5">
              <div className="card">
                <div className="px-4 py-3 border-bottom d-flex align-items-center justify-content-between">
                  <h5 className="card-title fw-semibold mb-0">{t('Dienstleister')}</h5>
                  <span className="text-muted">{order.bids?.length ?? 0} {t('Einträge')}</span>
                </div>
                <div className="card-body p-4">
                  {(order.bids ?? []).length > 0 ? (
                    <div className="d-flex flex-column gap-3">
                      {order.bids.map((bid) => {
                        const selectedSlot = inspectionSlots[Number(bid.workflow_meta?.selected_slot_index)]
                        const isAnonymousQuoteSeed = Boolean(bid.workflow_meta?.quote_scope_seed)

                        return (
                          <div className="vergo-inspection-detail-card" key={bid.id}>
                            <div className="d-flex align-items-start justify-content-between gap-3 mb-2">
                              <div>
                                <div className="fw-semibold">{isAnonymousQuoteSeed ? t('Anonyme Offerte') : (bid.service_provider?.company_name || '-')}</div>
                                <div className="text-muted small">
                                  {isAnonymousQuoteSeed ? t('Dienstleisterangaben verborgen') : (bid.assigned_provider_email || bid.service_provider?.contact_email || '-')}
                                </div>
                              </div>
                              <span className={getStatusBadgeClass(bid.status)}>
                                {t(formatStatusLabel(bid.status))}
                              </span>
                            </div>
                            <div className="vergo-inspection-detail-subvalue">
                              {t('Gewählter Termin')}: {selectedSlot ? `${formatDateDisplay(selectedSlot.date)} ${formatTimeDisplay(selectedSlot.time)}` : '-'}
                            </div>
                            <div className="vergo-inspection-detail-subvalue">
                              {t('Offerte erstellen bis')}: {formatDateDisplay(selectedSlot?.quote_due_date)}
                            </div>
                            {bid.rejection_reason ? <div className="text-muted small mt-2">{bid.rejection_reason}</div> : null}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-muted">{t('Noch keine Dienstleister für diese Besichtigung vorhanden.')}</div>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="card-body">
                  <h5 className="fw-semibold mb-3">{t('Auftragsdaten')}</h5>
                  <div className="vergo-inspection-section">
                    <div className="d-flex flex-column gap-3">
                      <div className="vergo-inspection-detail-card">
                        <div className="vergo-inspection-detail-label">{t('Gewerk')}</div>
                        <div className="vergo-inspection-detail-value">{getOptionLabel(JOB_TYPE_OPTIONS, order.service_type)}</div>
                      </div>
                      <div className="vergo-inspection-detail-card">
                        <div className="vergo-inspection-detail-label">{t('Typ')}</div>
                        <div className="vergo-inspection-detail-value">{t('Besichtigung')}</div>
                      </div>
                      <div className="vergo-inspection-detail-card">
                        <div className="vergo-inspection-detail-label">{t('Anfragender')}</div>
                        <div className="vergo-inspection-detail-value">
                          {order.requester_name || '-'} {order.requester_email ? `(${order.requester_email})` : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {hasQuoteToGenerate ? (
                <div className="card vergo-quote-cta-card">
                  <div className="card-body">
                    <div className="text-uppercase small fw-bold vergo-quote-cta-label mb-2">{t('Offerte nach Besichtigung')}</div>
                    <p className="mb-3">
                      {canPublishInspectionQuote
                        ? hasMultipleInspectionQuoteOptions
                          ? t('Mehrere Dienstleister haben nach der Besichtigung Leistungspositionen erfasst. Prüfen Sie die Optionen und starten Sie die Ausschreibung für weitere Anbieter.')
                          : t('Der Dienstleister hat nach der Besichtigung eine Offerte erstellt. Prüfen Sie die Leistungen und starten Sie die Ausschreibung für weitere Anbieter.')
                        : quoteRequestAlreadyPublished
                          ? t('Die Offerte wurde bereits als Ausschreibung für weitere Anbieter veröffentlicht.')
                          : hasMultipleInspectionQuoteOptions
                            ? t('Mehrere Dienstleister haben nach der Besichtigung Leistungspositionen erfasst. Sie können die Optionen ansehen.')
                            : t('Der Dienstleister hat nach der Besichtigung eine Offerte erstellt. Sie können die Leistungen ansehen.')}
                    </p>
                    <button type="button" className="btn btn-light fw-semibold" onClick={openQuoteModal}>
                      {t('Offerte ansehen')}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
        <div className="row">
          <div className="col-xl-4">
            <div className="card">
              <div className="card-body">
                <h5 className="fw-semibold mb-3">{order.title}</h5>
                <p className="text-muted mb-3">{order.description || t('Keine Beschreibung hinzugefügt.')}</p>

                <div className="mb-2">
                  <strong>{t('Immobilie')}:</strong> {order.property?.li_number} - {order.property?.title}
                </div>

                <div className="mb-2">
                  <strong>{t('Objekt')}:</strong> {order.property_object?.name || '-'}
                </div>

                <div className="mb-2">
                  <strong>{t('Auftragstyp')}:</strong> {getOptionLabel(JOB_TYPE_OPTIONS, order.service_type)}
                </div>

                <div className="mb-2">
                  <strong>{t('Fälligkeitsdatum (spätestens bis)')}:</strong> {getOrderDueDateLabel(order, t)}
                </div>

                {order.completed_at ? (
                  <div className="mb-2">
                    <strong>{t('Abgeschlossen am')}:</strong> {formatDateTimeDisplay(order.completed_at)}
                  </div>
                ) : null}

                <div className="mb-3">
                  <strong>{t('Status')}:</strong>{' '}
                  <span className={getStatusBadgeClass(order.status)}>
                    {t(formatStatusLabel(order.status))}
                  </span>
                </div>

                <div className="d-flex gap-2 flex-wrap">
                  {showManualAnalysisButtons ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleCompare}
                        disabled={isComparing}
                      >
                        {isComparing ? t('Wird verglichen...') : t('Angebote vergleichen')}
                      </button>
                    </>
                  ) : null}

                  <Link className="btn btn-light-primary" to="/documents">
                    {t('Dokumente anzeigen')}
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
                <h5 className="fw-semibold mb-3">{t('Anbieterbewertung')}</h5>

                {order.approved_bid?.service_provider ? (
                  <div className="mb-3">
                    <div className="text-muted fs-2">{t('Genehmigter Anbieter')}</div>
                    <div className="fw-semibold">{order.approved_bid.service_provider.company_name}</div>
                    <div className="text-muted">{order.approved_bid.service_provider.contact_email}</div>
                  </div>
                ) : (
                  <div className="text-muted mb-3">{t('Noch kein genehmigter Anbieter.')}</div>
                )}

                {providerReviews.length > 0 ? (
                  <div className="mb-4">
                    {providerReviews.map((review) => (
                      <div key={review.id} className="border rounded p-3 mb-2">
                        <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
                          <div className="fw-semibold">{review.reviewer_name}</div>
                          <span className="badge bg-light-primary text-primary">{review.rating}/5</span>
                        </div>
                        <div className="d-flex flex-wrap gap-2 mb-2">
                          <span className="badge bg-light-secondary text-secondary">
                            Kommunikation {review.communication_rating ?? review.rating}/5
                          </span>
                          <span className="badge bg-light-secondary text-secondary">
                            Pünktlichkeit {review.punctuality_rating ?? review.rating}/5
                          </span>
                          <span className="badge bg-light-secondary text-secondary">
                            Qualität {review.quality_rating ?? review.rating}/5
                          </span>
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
                      <div className="row g-3 mb-3">
                        {[
                          ['communication_rating', 'Kommunikation'],
                          ['punctuality_rating', 'Pünktlichkeit'],
                          ['quality_rating', 'Arbeitsqualität'],
                        ].map(([field, label]) => (
                          <div className="col-md-4" key={field}>
                            <label className="form-label">{label}</label>
                            <select
                              className="form-select"
                              value={reviewForm[field]}
                              onChange={(event) =>
                                setReviewForm((current) => ({ ...current, [field]: event.target.value }))
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
                        ))}
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

            {!managerAnonymousBidReview ? (
              <div className="card">
                <div className="card-body">
                  <h5 className="fw-semibold mb-3">{t('Preisempfehlung')}</h5>

                  {priceRecommendation && canShowBidPricesInline ? (
                    <>
                      <div className="d-flex align-items-center justify-content-between gap-3 mb-3">
                        <span className="text-muted">{t('Aktuelles Signal')}</span>
                        <span className={getStatusBadgeClass(priceRecommendation.comparison_data?.pricing_signal)}>
                          {t(formatStatusLabel(priceRecommendation.comparison_data?.pricing_signal))}
                        </span>
                      </div>

                      <div className="mb-2">
                        <strong>{t('Benchmark')}:</strong> {priceRecommendation.comparison_data?.benchmark_amount ?? '-'} {priceRecommendation.comparison_data?.recommended_bid_currency ?? 'CHF'}
                      </div>

                      <div className="mb-2">
                        <strong>{t('Bestes Angebot')}:</strong> {priceRecommendation.comparison_data?.recommended_bid_amount ?? '-'} {priceRecommendation.comparison_data?.recommended_bid_currency ?? 'CHF'}
                      </div>

                      <div className="mb-2">
                        <strong>{t('Abweichung')}:</strong> {priceRecommendation.comparison_data?.variance_percentage ?? '-'}%
                      </div>

                      <div className="mb-2">
                        <strong>{t('Leistung')}:</strong> {getOptionLabel(JOB_TYPE_OPTIONS, priceRecommendation.comparison_data?.service_category) || priceRecommendation.comparison_data?.service_category || '-'}
                      </div>

                      <div className="mb-2">
                        <strong>{t('Intervall')}:</strong> {priceRecommendation.comparison_data?.service_interval || '-'}
                      </div>

                      <div className="mb-0">
                        <strong>{t('Quellen')}:</strong> {priceRecommendation.comparison_data?.benchmark_source_count ?? 0} {t('historische Quelle(n)')}
                      </div>
                    </>
                  ) : (
                    <div className="text-muted">
                      {t('Die Preisanalyse wird nach Ablauf der Angebotsfrist automatisch erstellt.')}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="col-xl-8">
            <div className="card">
              <div className="px-4 py-3 border-bottom d-flex align-items-center justify-content-between">
                <h5 className="card-title fw-semibold mb-0">{t('Angebotsvergleich')}</h5>
                <span className="text-muted">{comparableBids.length} {t('Angebote')}</span>
              </div>

              <div className="card-body p-4">
                {user?.role === 'manager' && isQuoteWorkflow && !bidDeadlinePassed ? (
                  <div className="alert alert-light-primary border mb-4">
                    <div className="fw-semibold mb-1">{t('Bieterrunde läuft noch')}</div>
                    <div>
                      {t('Bis zur Angebotsfrist sehen Sie nur die Anzahl der eingegangenen Angebote.')}
                      {order?.bid_deadline_at ? ` ${t('Frist')}: ${formatBidDeadlineDisplay(order.bid_deadline_at, language)}` : ''}
                    </div>
                    <div className="mt-2 fw-semibold">{getReceivedBidsLabel(comparableBids.length, t)}</div>
                  </div>
                ) : null}

                {priceRecommendation && canShowBidPricesInline ? (
                  <div
                    className={`alert ${priceRecommendation.comparison_data?.pricing_signal === 'too_high'
                        ? 'alert-light-danger'
                        : priceRecommendation.comparison_data?.pricing_signal === 'too_low'
                          ? 'alert-light-warning'
                          : 'alert-light-success'
                      } border mb-4`}
                  >
                    <div className="fw-semibold mb-1">{t('Preisvergleich Ergebnis')}</div>
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

                {canShowBidPricesInline && (priceRecommendation?.comparison_data?.benchmark_sources ?? []).length > 0 ? (
                  <div className="table-responsive rounded-2 mb-4">
                    <table className="table border-none text-nowrap customize-table mb-0 align-middle">
                      <thead className="text-dark fs-4">
                        <tr>
                          <th><h6 className="fs-4 fw-semibold mb-0">{t('Quelle')}</h6></th>
                          <th><h6 className="fs-4 fw-semibold mb-0">{t('Betrag')}</h6></th>
                          <th><h6 className="fs-4 fw-semibold mb-0">{t('Typ')}</h6></th>
                          <th><h6 className="fs-4 fw-semibold mb-0">{t('Übereinstimmung')}</h6></th>
                        </tr>
                      </thead>
                      <tbody>
                        {priceRecommendation.comparison_data.benchmark_sources.slice(0, 6).map((source, index) => (
                          <tr key={`${source.result_id ?? source.order_id ?? source.bid_id ?? 'source'}-${index}`}>
                            <td>{source.document_title || source.order_title || '-'}</td>
                            <td>{source.amount ?? '-'} {source.currency || ''}</td>
                            <td>{source.document_type ? formatStatusLabel(source.document_type) : source.source_type === 'historical_order' ? 'Abgeschlossener Auftrag' : '-'}</td>
                            <td>{source.match_score ?? '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {comparison && canShowBidPricesInline ? (
                  <>
                    <div className="alert alert-light-primary border mb-4">
                      <div className="fw-semibold mb-1">{t('Neueste Zusammenfassung')}</div>
                      <div>{comparison.summary}</div>
                    </div>

                    <div className="row g-3 mb-4">
                      <div className="col-md-3">
                        <div className="border rounded p-3 h-100">
                          <div className="text-muted fs-2">{t('Durchschnitt')}</div>
                          <div className="fw-semibold">{comparison.comparison_data?.average_amount ?? '-'} CHF</div>
                        </div>
                      </div>

                      <div className="col-md-3">
                        <div className="border rounded p-3 h-100">
                          <div className="text-muted fs-2">{t('Niedrigster Wert')}</div>
                          <div className="fw-semibold">{comparison.comparison_data?.lowest_amount ?? '-'}</div>
                        </div>
                      </div>

                      <div className="col-md-3">
                        <div className="border rounded p-3 h-100">
                          <div className="text-muted fs-2">{t('Höchster Wert')}</div>
                          <div className="fw-semibold">{comparison.comparison_data?.highest_amount ?? '-'}</div>
                        </div>
                      </div>

                      <div className="col-md-3">
                        <div className="border rounded p-3 h-100">
                          <div className="text-muted fs-2">{t('Spanne')}</div>
                          <div className="fw-semibold">{comparison.comparison_data?.spread_percentage ?? '-'}%</div>
                        </div>
                      </div>
                    </div>

                    {comparison.comparison_data?.active_price_benchmark_amount ? (
                      <div className="border rounded-3 p-3 mb-4">
                        <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap mb-3">
                          <div>
                            <div className="text-muted fs-2">{t('Preisbenchmark nach Gewerk')}</div>
                            <div className="fw-semibold">
                              {comparison.comparison_data.active_price_benchmark_amount} CHF
                            </div>
                            {comparison.comparison_data?.low_bid_threshold_amount ? (
                              <div className="text-muted small">
                                {t('Tiefer-Preis-Schwelle')}: {comparison.comparison_data.low_bid_threshold_amount} CHF
                              </div>
                            ) : null}
                          </div>
                          <span className="badge bg-light-primary text-primary fw-semibold fs-2 rounded-3 py-2 px-3">
                            {comparison.comparison_data?.standard_benchmark_source_count ?? comparison.comparison_data?.invoice_benchmark_source_count ?? 0} {t('Quellen')}
                          </span>
                        </div>
                        {comparison.comparison_data?.low_bid_count > 0 ? (
                          <div className="alert alert-light-warning border py-2 mb-3">
                            {comparison.comparison_data.low_bid_count} {t('Angebot(e) liegen mindestens 20% unter dem Benchmark und wurden mit Punktabzug bewertet.')}
                          </div>
                        ) : null}
                        {comparisonBenchmarkSources.length > 0 ? (
                          <div className="table-responsive rounded-2">
                            <table className="table table-sm align-middle mb-0">
                              <thead>
                                <tr>
                                  <th>{t('Quelle')}</th>
                                  <th>{t('Betrag')}</th>
                                  <th>{t('Gewerk')}</th>
                                  <th>{t('Treffer')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {comparisonBenchmarkSources.slice(0, 5).map((source, index) => (
                                  <tr key={`${source.result_id}-${index}`}>
                                    <td>{source.document_title || source.order_title || '-'}</td>
                                    <td>{source.amount ?? '-'} {source.currency || 'CHF'}</td>
                                    <td>{getOptionLabel(JOB_TYPE_OPTIONS, source.service_category) || source.service_category || '-'}</td>
                                    <td>{source.match_score ?? '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                ) : canShowBidPricesInline ? (
                  <div className="text-muted mb-4">
                    {isComparing || isComparingPrice
                      ? t('Die automatische Analyse läuft. Bitte warten Sie einen Moment.')
                      : t('Die automatische Analyse wird nach Ablauf der Angebotsfrist erstellt.')}
                  </div>
                ) : null}

                {shouldHideBidPrices ? (
                  <div className="row g-3 mb-4">
                    {arrivalOrderedBids.map((bid, index) => (
                      <div className="col-md-4 col-lg-3" key={bid.id}>
                        <div className="border rounded-3 p-4 text-center h-100 bg-light">
                          <div className="fw-semibold fs-5">{t('Angebot')} {index + 1}</div>
                          <div className="text-muted small mt-2">
                            {t('Eingegangen')}: {formatDateTimeDisplay(bid.submitted_at ?? bid.created_at)}
                          </div>
                        </div>
                      </div>
                    ))}
                    {comparableBids.length === 0 ? (
                      <div className="col-12">
                        <div className="border rounded-3 p-4 text-muted">
                          {t('Noch keine Angebote eingegangen.')}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {managerAnonymousBidReview ? (
                  <div className="vergo-anonymous-bid-list">
                    {isComparing || isComparingPrice ? (
                      <div className="alert alert-light-primary border mb-3">
                        {t('Die automatische Analyse läuft. Bitte warten Sie einen Moment.')}
                      </div>
                    ) : null}

                    {visibleRankedBids.length > 0 ? visibleRankedBids.map((bid, index) => {
                      const score = bidScoreMap[bid.id]
                      const isRecommended = recommendedBidId === bid.id

                      return (
                        <div className={`vergo-anonymous-bid-card${isRecommended ? ' is-recommended' : ''}`} key={bid.id}>
                          <div className="vergo-anonymous-bid-main">
                            <div>
                              <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                                <h6 className="mb-0">{t('Angebot')} {index + 1}</h6>
                                {isRecommended ? (
                                  <span className="badge bg-light-success text-success fw-semibold fs-2 rounded-3 py-1 px-2">
                                    {t('Empfohlen')}
                                  </span>
                                ) : null}
                              </div>
                              <div className="text-muted small">
                                {t('Details sind erst nach dem Öffnen sichtbar.')}
                              </div>
                            </div>
                            <span className={getStatusBadgeClass(bid.status)}>
                              {t(formatStatusLabel(bid.status))}
                            </span>
                          </div>

                          <div className="vergo-anonymous-bid-score-grid">
                            <div>
                              <span>{t('Gesamtbewertung')}</span>
                              <strong>{score?.final_score ?? '-'} / 100</strong>
                            </div>
                            <div>
                              <span>{t('Terminbewertung')}</span>
                              <strong>{score?.timeline_score ?? '-'} / 100</strong>
                            </div>
                            <div>
                              <span>{t('Anbieterbewertung')}</span>
                              <strong>{score?.rating_score ?? '-'} / 100</strong>
                            </div>
                          </div>

                          <div className="d-flex justify-content-end">
                            <button type="button" className="btn btn-primary btn-sm" onClick={() => setSelectedBidDetailId(bid.id)}>
                              {t('Details öffnen')}
                            </button>
                          </div>
                        </div>
                      )
                    }) : (
                      <div className="border rounded-3 p-4 text-muted">
                        {t('Noch keine Angebote eingegangen.')}
                      </div>
                    )}
                  </div>
                ) : null}

                {shouldHideBidPrices || managerAnonymousBidReview ? null : (
                <div className="table-responsive rounded-2 mb-0">
                  <table className="table border-none text-nowrap customize-table mb-0 align-middle">
                    <thead className="text-dark fs-4">
                      <tr>
                        <th><h6 className="fs-4 fw-semibold mb-0">Anbieter</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">Betrag</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">Zeitraum</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">Anhang</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">Status</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">Punkte</h6></th>
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
                                {hasAiRanking ? (
                                  <span className="badge bg-light-primary text-primary fw-semibold fs-2 rounded-3 py-1 px-2">
                                    {t('Option')} {index + 1}
                                  </span>
                                ) : null}
                                {recommendedBidId === bid.id ? (
                                  <span className="badge bg-light-success text-success fw-semibold fs-2 rounded-3 py-1 px-2">
                                    {t('Empfohlen')}
                                  </span>
                                ) : null}
                              </div>
                              <div className="text-muted">
                                {bid.service_provider?.contact_email || '-'}
                                {score ? ` • ${t('KI-geprüfte Reihenfolge')}` : ''}
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
                                {t(formatStatusLabel(bid.status))}
                              </span>
                            </td>

                            <td>
                              <div className="fw-semibold">{score?.final_score ?? '-'}</div>
                              {score ? (
                                <div className="text-muted small">
                                  Preis {score.price_score ?? '-'} / Termin {score.timeline_score ?? '-'} / Objekt {score.property_experience_score ?? '-'} / Rating {score.rating_score ?? '-'}
                                </div>
                              ) : null}
                              {score?.provider_rating_breakdown ? (
                                <div className="text-muted small">
                                  K {score.provider_rating_breakdown.communication ?? '-'} / P {score.provider_rating_breakdown.punctuality ?? '-'} / Q {score.provider_rating_breakdown.quality ?? '-'}
                                </div>
                              ) : null}
                              {score?.is_unreasonably_low ? (
                                <div className="mt-1">
                                  <span className="badge bg-light-warning text-warning fw-semibold fs-2 rounded-3 py-1 px-2">
                                    Ungewöhnlich tief
                                  </span>
                                  <div className="text-muted small mt-1">
                                    {score.price_benchmark_variance_percentage}% vs. Benchmark, -{score.low_bid_penalty_points} Punkte
                                  </div>
                                </div>
                              ) : null}
                            </td>

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
                                      {t('Vorauswählen')}
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
                                        {t('Genehmigen')}
                                      </button>

                                      <button
                                        type="button"
                                        className="btn btn-light-danger text-danger btn-sm"
                                        disabled={updatingBidId === bid.id || bid.status !== 'shortlisted' || ['approved', 'completed', 'closed'].includes(order.status)}
                                        onClick={() => handleBidDecision(bid.id, 'rejected')}
                                      >
                                        {t('Ablehnen')}
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
                                        {t('Zuschlag erteilen')}
                                      </button>

                                      <button
                                        type="button"
                                        className="btn btn-light-danger text-danger btn-sm"
                                        disabled={updatingBidId === bid.id || ['approved', 'accepted', 'completed', 'rejected'].includes(bid.status)}
                                        onClick={() => handleBidDecision(bid.id, 'rejected')}
                                      >
                                        {t('Ablehnen')}
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
        )
      ) : null}

      {selectedBidDetail ? (
        <div className="modal fade show d-block" tabIndex="-1" role="dialog" style={{ background: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <div>
                  <h5 className="modal-title">{t('Angebotsdetails')} {selectedBidDetailIndex + 1}</h5>
                  <div className="text-muted small">{t('Preis- und Firmendetails sind nur in dieser Detailansicht sichtbar.')}</div>
                </div>
                <button type="button" className="btn-close" aria-label={t('Schließen')} onClick={() => setSelectedBidDetailId(null)} />
              </div>
              <div className="modal-body">
                {error ? <div className="alert alert-danger py-2">{error}</div> : null}

                <div className="row g-3 mb-4">
                  <div className="col-md-6">
                    <div className="border rounded-3 p-3 h-100">
                      <div className="text-muted small">{t('Anbieter')}</div>
                      <div className="fw-semibold">{selectedBidDetail.service_provider?.company_name || '-'}</div>
                      <div className="text-muted small">{selectedBidDetail.service_provider?.contact_email || '-'}</div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="border rounded-3 p-3 h-100">
                      <div className="text-muted small">{t('Betrag')}</div>
                      <div className="fw-semibold fs-5">{selectedBidDetail.amount ?? '-'} {selectedBidDetail.currency || 'CHF'}</div>
                      <div className="text-muted small">{t('Status')}: {t(formatStatusLabel(selectedBidDetail.status))}</div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="border rounded-3 p-3 h-100">
                      <div className="text-muted small">{t('Gesamtbewertung')}</div>
                      <div className="fw-semibold">{selectedBidDetailScore?.final_score ?? '-'} / 100</div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="border rounded-3 p-3 h-100">
                      <div className="text-muted small">{t('Startdatum')}</div>
                      <div className="fw-semibold">{formatDateDisplay(selectedBidDetail.estimated_start_date)}</div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="border rounded-3 p-3 h-100">
                      <div className="text-muted small">{t('Fertigstellungsdatum')}</div>
                      <div className="fw-semibold">{formatDateDisplay(selectedBidDetail.estimated_completion_date)}</div>
                    </div>
                  </div>
                </div>

                {(selectedBidDetail.line_items ?? []).length > 0 ? (
                  <div className="table-responsive rounded-2 mb-4">
                    <table className="table align-middle mb-0">
                      <thead>
                        <tr>
                          <th>{t('Leistung')}</th>
                          <th>{t('Einheit')}</th>
                          <th className="text-end">{t('Menge')}</th>
                          <th className="text-end">{t('Einzelpreis')}</th>
                          <th className="text-end">{t('Zwischensumme')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedBidDetail.line_items.map((item, index) => {
                          const quantity = Number(item.quantity || 0)
                          const unitPrice = Number(item.unit_price || 0)
                          const subtotal = quantity * unitPrice

                          return (
                            <tr key={item.id || item.code || item.label || index}>
                              <td>
                                <div className="fw-semibold">{item.label || '-'}</div>
                                {item.category || item.code ? <div className="text-muted small">{item.category || item.code}</div> : null}
                              </td>
                              <td>{item.unit || '-'}</td>
                              <td className="text-end">{item.quantity ?? '-'}</td>
                              <td className="text-end">{unitPrice ? `${unitPrice.toFixed(2)} ${selectedBidDetail.currency || 'CHF'}` : '-'}</td>
                              <td className="text-end">{subtotal ? `${subtotal.toFixed(2)} ${selectedBidDetail.currency || 'CHF'}` : '-'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {priceRecommendation ? (
                  <div className="alert alert-light-primary border mb-4">
                    <div className="fw-semibold mb-1">{t('Automatische Preisanalyse')}</div>
                    <div>{priceRecommendation.summary}</div>
                    <div className="row g-2 mt-2">
                      <div className="col-md-4">
                        <span className="text-muted small">{t('Benchmark')}</span>
                        <div className="fw-semibold">{priceRecommendation.comparison_data?.benchmark_amount ?? '-'} {priceRecommendation.comparison_data?.recommended_bid_currency ?? 'CHF'}</div>
                      </div>
                      <div className="col-md-4">
                        <span className="text-muted small">{t('Abweichung')}</span>
                        <div className="fw-semibold">{priceRecommendation.comparison_data?.variance_percentage ?? '-'}%</div>
                      </div>
                      <div className="col-md-4">
                        <span className="text-muted small">{t('Quellen')}</span>
                        <div className="fw-semibold">{priceRecommendation.comparison_data?.benchmark_source_count ?? 0}</div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {selectedBidDetail.notes ? (
                  <div className="mb-4">
                    <div className="fw-semibold mb-1">{t('Notizen')}</div>
                    <div className="border rounded-3 p-3">{selectedBidDetail.notes}</div>
                  </div>
                ) : null}

                {selectedBidDetail.attachment_name ? (
                  <button
                    type="button"
                    className="btn btn-light-primary btn-sm"
                    onClick={() => api.downloadBidAttachment(selectedBidDetail.id, selectedBidDetail.attachment_name)}
                  >
                    {t('Anhang herunterladen')}
                  </button>
                ) : null}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setSelectedBidDetailId(null)}>
                  {t('Schließen')}
                </button>
                {canShortlistBids && isQuoteWorkflow ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-light-danger text-danger"
                      disabled={updatingBidId === selectedBidDetail.id || ['approved', 'accepted', 'completed', 'rejected'].includes(selectedBidDetail.status)}
                      onClick={() => handleBidDetailDecision(selectedBidDetail.id, 'rejected')}
                    >
                      {t('Ablehnen')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-success"
                      disabled={updatingBidId === selectedBidDetail.id || ['approved', 'accepted', 'completed', 'rejected'].includes(selectedBidDetail.status)}
                      onClick={() => handleBidDetailDecision(selectedBidDetail.id, 'approved')}
                    >
                      {t('Zuschlag erteilen')}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isQuoteModalOpen ? (
        <div className="modal fade show d-block" tabIndex="-1" role="dialog" style={{ background: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{t('Offerten nach Besichtigung')}</h5>
                <button type="button" className="btn-close" aria-label={t('Schließen')} onClick={() => setIsQuoteModalOpen(false)} />
              </div>
              <div className="modal-body">
                {error ? <div className="alert alert-danger py-2">{error}</div> : null}
                <p className="text-muted">{t('Nach der Besichtigung erfasste Leistungen. Preise bleiben für Immobilienverwalter und andere Anbieter verborgen.')}</p>
                {inspectionQuoteOptions.length > 0 ? (
                  <div className="d-flex flex-column gap-3">
                    {inspectionQuoteOptions.map((option, optionIndex) => (
                      <div className="vergo-inspection-quote-option" key={option.option_id || optionIndex}>
                        <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap mb-2">
                          <h6 className="fw-semibold mb-0">{t('Anonyme Option')} {optionIndex + 1}</h6>
                          <button
                            type="button"
                            className="btn btn-light-primary btn-sm"
                            onClick={() => selectQuoteOption(optionIndex, option.line_items?.length ?? 0)}
                          >
                            {t('Alle Positionen wählen')}
                          </button>
                        </div>
                        <div className="table-responsive">
                          <table className="table align-middle mb-0">
                            <thead>
                              <tr>
                                <th className="vergo-quote-select-column"></th>
                                <th>{t('Leistung')}</th>
                                <th>{t('Einheit')}</th>
                                <th className="text-end">{t('Menge')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(option.line_items ?? []).map((item, itemIndex) => {
                                const taskKey = getQuoteTaskKey(optionIndex, itemIndex)

                                return (
                                  <tr key={`${option.option_id || optionIndex}-${item.code || item.label || itemIndex}`}>
                                    <td className="vergo-quote-select-column">
                                      <input
                                        type="checkbox"
                                        className="form-check-input"
                                        checked={selectedQuoteTaskKeySet.has(taskKey)}
                                        onChange={() => toggleQuoteTask(taskKey)}
                                        aria-label={`${t('Position')} ${itemIndex + 1}`}
                                      />
                                    </td>
                                    <td>
                                      <div className="fw-semibold">{item.label || '-'}</div>
                                      {item.category || item.code ? <div className="text-muted small">{item.category || item.code}</div> : null}
                                    </td>
                                    <td>{item.unit || '-'}</td>
                                    <td className="text-end">{item.quantity ?? '-'}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                    <div className="alert alert-light-primary border mb-0">
                      {t('Ausgewählte Positionen')}: {selectedQuoteItems.length}
                    </div>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table align-middle mb-0">
                      <thead>
                        <tr>
                          <th>{t('Leistung')}</th>
                          <th>{t('Einheit')}</th>
                          <th className="text-end">{t('Menge')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quoteServices.map((item, index) => (
                          <tr key={item.code || item.label || index}>
                            <td>
                              <div className="fw-semibold">{item.label || '-'}</div>
                              {item.code ? <div className="text-muted small">{item.code}</div> : null}
                            </td>
                            <td>{item.unit || '-'}</td>
                            <td className="text-end">{item.quantity ?? '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setIsQuoteModalOpen(false)}>
                  {t('Schließen')}
                </button>
                {canPublishInspectionQuote ? (
                  <button type="button" className="btn btn-primary" onClick={handleStartQuoteRequestWizard}>
                    {t('Ausschreibung starten')}
                  </button>
                ) : quoteRequestAlreadyPublished ? (
                  <button type="button" className="btn btn-primary" onClick={() => navigate('/orders')}>
                    {t('Zur Auftragsliste')}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </PageContent>
  )
}

export default OrderDetailsPage
