import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageContent from '../components/PageContent'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { api } from '../lib/api'
import { formatStatusLabel, getStatusBadgeClass } from '../lib/tableStatus'
import { getOptionLabel, JOB_TYPE_OPTIONS } from '../lib/vergoOptions'

const initialBidForm = {
  amount: '',
  currency: 'EUR',
  estimated_start_date: '',
  estimated_completion_date: '',
  notes: '',
  attachment: null,
  selected_inspection_slot: '',
  line_items: [],
}

const emptyLineItem = {
  label: '',
  code: '',
  unit: 'Stück',
  quantity: '',
  unit_price: '',
  is_custom: true,
}

function getInspectionSlots(order) {
  return order?.workflow_meta?.inspection?.preferred_slots ?? []
}

function getOnsiteContact(order) {
  return order?.workflow_meta?.inspection?.onsite_contact ?? {}
}

function getPropertyAddress(order) {
  return order?.property_object?.address || order?.property_object?.name || order?.property?.address || '-'
}

function isInspectionWorkflow(order) {
  return order?.workflow_type === 'inspection'
    || ['inspection_requested', 'public_inspection_open', 'inspection_signup_closed', 'inspection_company_selected'].includes(order?.workflow_status)
}

function AvailableJobsPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [searchParams] = useSearchParams()
  const [orders, setOrders] = useState([])
  const [submittedBids, setSubmittedBids] = useState([])
  const [filters, setFilters] = useState({ search: '', status: '' })
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [bidForm, setBidForm] = useState(initialBidForm)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)
  const [assignmentMode, setAssignmentMode] = useState('self')
  const [targetProviderEmail, setTargetProviderEmail] = useState('')
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState('')
  const [error, setError] = useState('')
  const [hasOpenedInitialOrder, setHasOpenedInitialOrder] = useState(false)

  useEffect(() => {
    loadOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (isLoading || hasOpenedInitialOrder) {
      return
    }

    const orderId = searchParams.get('order_id')
    const matchingOrder = orderId ? orders.find((order) => String(order.id) === String(orderId)) : null

    if (matchingOrder) {
      openBidModal(matchingOrder)
      setHasOpenedInitialOrder(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasOpenedInitialOrder, isLoading, orders, searchParams])

  useEffect(() => {
    if (selectedOrder) {
      document.body.classList.add('modal-open')
      document.body.style.overflow = 'hidden'
    } else {
      document.body.classList.remove('modal-open')
      document.body.style.overflow = ''
    }

    return () => {
      document.body.classList.remove('modal-open')
      document.body.style.overflow = ''
    }
  }, [selectedOrder])

  async function loadOrders() {
    setIsLoading(true)
    setError('')

    try {
      const [ordersResponse, bidsResponse] = await Promise.all([
        api.getOrders(),
        api.getBids(),
      ])

      setOrders(ordersResponse.data ?? [])
      setSubmittedBids(bidsResponse.data ?? [])
    } catch (loadError) {
      setError(t(loadError.message))
    } finally {
      setIsLoading(false)
    }
  }

  function handleFilterChange(event) {
    const { name, value } = event.target
    setFilters((current) => ({ ...current, [name]: value }))
  }

  function handleBidChange(event) {
    const { name, value, files } = event.target
    setBidForm((current) => ({ ...current, [name]: files ? files[0] : value }))
  }

  function handleLineItemChange(index, field, value) {
    setBidForm((current) => ({
      ...current,
      line_items: current.line_items.map((item, itemIndex) => (
        itemIndex === index
          ? { ...item, [field]: value }
          : item
      )),
    }))
  }

  function hydrateBidForm(order, providerBid = null) {
    const draft = providerBid?.draft_payload
    const quoteItems = draft?.line_items
      ?? ((order.quote_items ?? []).length > 0 ? order.quote_items : [{ ...emptyLineItem }])

    return {
      ...initialBidForm,
      amount: draft?.amount ?? providerBid?.amount ?? '',
      currency: draft?.currency ?? providerBid?.currency ?? 'EUR',
      estimated_start_date: draft?.estimated_start_date ?? providerBid?.estimated_start_date ?? '',
      estimated_completion_date: draft?.estimated_completion_date ?? providerBid?.estimated_completion_date ?? '',
      notes: draft?.notes ?? providerBid?.notes ?? '',
      selected_inspection_slot: draft?.selected_inspection_slot ?? providerBid?.workflow_meta?.selected_slot_index ?? '',
      line_items: quoteItems.map((item) => ({
        ...item,
        unit_price: draft ? item.unit_price : '',
      })),
    }
  }

  function addLineItem() {
    setBidForm((current) => ({
      ...current,
      line_items: [...(current.line_items ?? []), { ...emptyLineItem }],
    }))
  }

  function removeLineItem(index) {
    setBidForm((current) => ({
      ...current,
      line_items: current.line_items.filter((_, itemIndex) => itemIndex !== index),
    }))
  }

  function getQuoteBidTotal() {
    return (bidForm.line_items ?? []).reduce((sum, item) => {
      return sum + (Number(item.quantity || 0) * Number(item.unit_price || 0))
    }, 0)
  }

  function openBidModal(order) {
    setSelectedOrder(order)
    setBidForm(hydrateBidForm(order, providerBidByOrderId[order.id]))
    setLastDraftSavedAt(providerBidByOrderId[order.id]?.draft_saved_at || '')
    setAssignmentMode('self')
    setTargetProviderEmail('')
    setError('')
  }

  function closeModal() {
    setSelectedOrder(null)
    setBidForm(initialBidForm)
    setAssignmentMode('self')
    setTargetProviderEmail('')
    setLastDraftSavedAt('')
    setError('')
  }

  async function handleAssignProvider(targetEmail = '') {
    if (!selectedOrder) return

    setIsAssigning(true)
    setError('')

    try {
      const response = await api.assignProviderOrder(selectedOrder.id, targetEmail ? { assigned_provider_email: targetEmail } : {})
      const assignedBid = response.data
      setSubmittedBids((current) => [
        ...current.filter((bid) => bid.order_id !== selectedOrder.id),
        assignedBid,
      ])
      setBidForm(hydrateBidForm(selectedOrder, assignedBid))
      if (targetEmail) {
        setTargetProviderEmail('')
      }
    } catch (assignError) {
      setError(t(assignError.message))
    } finally {
      setIsAssigning(false)
    }
  }

  async function handleAssignToMe() {
    await handleAssignProvider()
  }

  async function handleAssignToOther() {
    const email = targetProviderEmail.trim().toLowerCase()

    if (!email) {
      setError(t('Bitte geben Sie eine E-Mail-Adresse ein.'))
      return
    }

    await handleAssignProvider(email)
  }

  async function handleProviderDecision(status) {
    const providerBid = providerBidByOrderId[selectedOrder?.id]

    if (!providerBid) {
      return
    }

    setIsSaving(true)
    setError('')

    try {
      const response = await api.updateBid(providerBid.id, { status })
      const updatedBid = response.data
      setSubmittedBids((current) => current.map((bid) => (bid.id === updatedBid.id ? updatedBid : bid)))
    } catch (actionError) {
      setError(t(actionError.message))
    } finally {
      setIsSaving(false)
    }
  }

  async function submitBid(acknowledgeBenchmarkWarning = false) {
    const isInspectionSignup = selectedOrder.workflow_status === 'public_inspection_open'
    const isQuoteRequest = isOrderQuoteRequest(selectedOrder)

    if (!canSubmitCurrentOrder) {
      setError(t('Für diesen Auftrag ist keine Angebotsabgabe erforderlich.'))
      setIsSaving(false)
      return
    }

    if (!isAssignedToMe) {
      setError(t('Bitte weisen Sie den Auftrag zuerst sich selbst zu.'))
      setIsSaving(false)
      return
    }
    const payload = new FormData()
    payload.append('order_id', selectedOrder.id)
    payload.append('currency', bidForm.currency || 'EUR')

    if (isQuoteRequest) {
      const quoteLineItems = (bidForm.line_items ?? []).filter((item) => (
        item.label?.trim()
        && Number(item.quantity || 0) > 0
        && Number(item.unit_price || 0) > 0
      ))

      quoteLineItems.forEach((item, index) => {
        payload.append(`line_items[${index}][label]`, item.label)
        payload.append(`line_items[${index}][code]`, item.code || '')
        payload.append(`line_items[${index}][unit]`, item.unit || '')
        payload.append(`line_items[${index}][quantity]`, Number(item.quantity || 0))
        payload.append(`line_items[${index}][unit_price]`, Number(item.unit_price || 0))
        payload.append(`line_items[${index}][is_custom]`, item.is_custom ? '1' : '0')
      })

      if (acknowledgeBenchmarkWarning) {
        payload.append('workflow_meta[benchmark_warning_acknowledged]', '1')
      }
    } else if (!isInspectionSignup) {
      payload.append('amount', Number(bidForm.amount))
    }

    if (bidForm.estimated_start_date) payload.append('estimated_start_date', bidForm.estimated_start_date)
    if (bidForm.estimated_completion_date) payload.append('estimated_completion_date', bidForm.estimated_completion_date)
    if (bidForm.notes) payload.append('notes', bidForm.notes)
    if (isInspectionSignup) {
      payload.append('workflow_meta[selected_slot_index]', Number(bidForm.selected_inspection_slot))
      payload.append('workflow_meta[selected_slot][date]', selectedOrder.workflow_meta?.inspection?.preferred_slots?.[Number(bidForm.selected_inspection_slot)]?.date || '')
      payload.append('workflow_meta[selected_slot][time]', selectedOrder.workflow_meta?.inspection?.preferred_slots?.[Number(bidForm.selected_inspection_slot)]?.time || '')
    }
    if (bidForm.attachment) payload.append('attachment', bidForm.attachment)

    return api.createBid(payload)
  }

  async function handleSubmitBid(event) {
    event.preventDefault()
    setIsSaving(true)
    setError('')

    const isInspectionSignup = selectedOrder.workflow_status === 'public_inspection_open'
    const isQuoteRequest = isOrderQuoteRequest(selectedOrder)

    if (isInspectionSignup && !bidForm.selected_inspection_slot) {
      setError('Bitte wählen Sie einen Besichtigungstermin aus.')
      setIsSaving(false)
      return
    }

    if (isQuoteRequest) {
      const validLineItems = (bidForm.line_items ?? []).filter((item) => (
        item.label?.trim()
        && Number(item.quantity || 0) > 0
        && Number(item.unit_price || 0) > 0
      ))

      if (validLineItems.length === 0) {
        setError('Bitte erfassen Sie mindestens eine Position mit Menge und Preis.')
        setIsSaving(false)
        return
      }

      if (!bidForm.estimated_completion_date) {
        setError('Bitte geben Sie an, wann Sie die Arbeit ausführen können.')
        setIsSaving(false)
        return
      }
    } else if (!isInspectionSignup && !bidForm.amount) {
      setError(t('Gebotsbetrag erforderlich.'))
      setIsSaving(false)
      return
    }

    try {
      const hadExistingBid = Boolean(providerBidByOrderId[selectedOrder.id])
      const response = await submitBid(false)
      const savedBid = response.data
      setSubmittedBids((current) => [
        ...current.filter((bid) => bid.order_id !== selectedOrder.id),
        savedBid,
      ])
      setOrders((current) => current.map((order) => (
        order.id === selectedOrder.id
          ? { ...order, bids_count: hadExistingBid ? order.bids_count : (order.bids_count ?? 0) + 1 }
          : order
      )))
      closeModal()
    } catch (saveError) {
      if (saveError.payload?.requires_confirmation) {
        const shouldSubmit = window.confirm(saveError.message)

        if (shouldSubmit) {
          try {
            const hadExistingBid = Boolean(providerBidByOrderId[selectedOrder.id])
            const response = await submitBid(true)
            const savedBid = response.data
            setSubmittedBids((current) => [
              ...current.filter((bid) => bid.order_id !== selectedOrder.id),
              savedBid,
            ])
            setOrders((current) => current.map((order) => (
              order.id === selectedOrder.id
                ? { ...order, bids_count: hadExistingBid ? order.bids_count : (order.bids_count ?? 0) + 1 }
                : order
            )))
            closeModal()
          } catch (confirmedError) {
            setError(t(confirmedError.message))
          } finally {
            setIsSaving(false)
          }

          return
        }
      }

      setError(t(saveError.message))
    } finally {
      setIsSaving(false)
    }
  }

  const providerBidByOrderId = useMemo(() => {
    return submittedBids.reduce((map, bid) => {
      map[bid.order_id] = bid
      return map
    }, {})
  }, [submittedBids])

  const activeProviderBid = selectedOrder ? providerBidByOrderId[selectedOrder.id] : null
  const providerLoginEmail = String(user?.provider_login_email || user?.email || '').toLowerCase()
  const isAssignedToMe = Boolean(activeProviderBid?.assigned_provider_email)
    && String(activeProviderBid.assigned_provider_email).toLowerCase() === providerLoginEmail
  const canSubmitCurrentOrder = selectedOrder
    ? selectedOrder.workflow_status === 'public_inspection_open' || (!isInspectionWorkflow(selectedOrder) && isOrderQuoteRequest(selectedOrder))
    : false

  useEffect(() => {
    if (!selectedOrder || !activeProviderBid?.id || !isAssignedToMe) {
      return undefined
    }

    const intervalId = window.setInterval(async () => {
      try {
        const response = await api.saveBidDraft(activeProviderBid.id, {
          draft_payload: {
            amount: bidForm.amount,
            currency: bidForm.currency,
            estimated_start_date: bidForm.estimated_start_date,
            estimated_completion_date: bidForm.estimated_completion_date,
            notes: bidForm.notes,
            selected_inspection_slot: bidForm.selected_inspection_slot,
            line_items: bidForm.line_items,
          },
        })

        setLastDraftSavedAt(response.data?.draft_saved_at || '')
      } catch {
        // Autosave must not interrupt manual editing.
      }
    }, 10000)

    return () => window.clearInterval(intervalId)
  }, [activeProviderBid?.id, bidForm, isAssignedToMe, selectedOrder])

  function isOrderQuoteRequest(order) {
    const providerBid = providerBidByOrderId[order.id]

    return order.workflow_status === 'published_for_quotes'
      || (
        order.workflow_status === 'inspection_signup_closed'
        && ['inspection_interest', 'inspection_confirmed'].includes(providerBid?.status)
      )
  }

  function hasSubmittedQuote(order) {
    return ['submitted', 'shortlisted', 'approved', 'accepted', 'completed', 'rejected'].includes(providerBidByOrderId[order.id]?.status)
  }

  const filteredOrders = orders.filter((order) => {
    const providerBid = providerBidByOrderId[order.id]

    if (order.workflow_status === 'public_inspection_open' && providerBid && !providerBid.assigned_provider_email) {
      return false
    }

    if (
      !['public_inspection_open', 'published_for_quotes'].includes(order.workflow_status)
      && !isOrderQuoteRequest(order)
      && !providerBid
    ) {
      return false
    }

    const searchValue = [
      order.title,
      getOptionLabel(JOB_TYPE_OPTIONS, order.service_type),
      order.property?.li_number,
      order.property?.title,
      order.property_object?.name,
    ].filter(Boolean).join(' ').toLowerCase()

    const searchMatch = !filters.search || searchValue.includes(filters.search.toLowerCase())
    const statusMatch = !filters.status || String(order.status || '').toLowerCase() === filters.status.toLowerCase()
    return searchMatch && statusMatch
  })

  const openOrdersCount = orders.filter((order) => order.status === 'open').length
  const inReviewOrdersCount = orders.filter((order) => order.status === 'in_review').length
  const submittedBidsCount = submittedBids.filter((bid) => hasSubmittedQuote({ id: bid.order_id })).length
  const selectedOrderIsInspection = isInspectionWorkflow(selectedOrder)
  const selectedInspectionSlots = getInspectionSlots(selectedOrder)
  const selectedOnsiteContact = getOnsiteContact(selectedOrder)
  const selectedOnsiteName = [
    selectedOnsiteContact.first_name,
    selectedOnsiteContact.last_name,
  ].filter(Boolean).join(' ')

  return (
    <PageContent
      title="Verfügbare Aufträge"
      subtitle="Offene Aufträge, auf die Dienstleister Angebote abgeben können."
      breadcrumbs={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Verfügbare Aufträge' },
      ]}
    >
      <div className="row g-3 mb-4 vergo-filter-bar">
        <div className="col-md-4">
          <div className="card vergo-job-stat-card h-100">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <div className="text-muted mb-1">Offene Aufträge</div>
                  <h3 className="mb-0">{openOrdersCount}</h3>
                </div>
                <span className="vergo-job-stat-icon bg-light text-primary">
                  <i className="ti ti-briefcase-2"></i>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card vergo-job-stat-card h-100">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <div className="text-muted mb-1">In Prüfung</div>
                  <h3 className="mb-0">{inReviewOrdersCount}</h3>
                </div>
                <span className="vergo-job-stat-icon bg-light text-warning">
                  <i className="ti ti-hourglass-high"></i>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card vergo-job-stat-card h-100">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <div className="text-muted mb-1">Ihre eingereichten Angebote</div>
                  <h3 className="mb-0">{submittedBidsCount}</h3>
                </div>
                <span className="vergo-job-stat-icon bg-light text-success">
                  <i className="ti ti-rosette-discount-check"></i>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body p-4">
          <div className="row g-3 mb-4 vergo-filter-bar">
            <div className="col-md-6">
              <label className="form-label">Suche</label>
              <div className="vergo-search-input-wrap">
                <i className="ti ti-search vergo-search-input-icon" aria-hidden="true"></i>
                <input
                  aria-label="Suche"
                  className="form-control"
                  name="search"
                  value={filters.search}
                  onChange={handleFilterChange}
                  placeholder="Nach Auftrag, Immobilie, Objekt oder Dienstleistungstyp suchen"
                />
              </div>
            </div>

            <div className="col-md-3">
              <label className="form-label">Status</label>
              <div className="vergo-select-input-wrap">
                <i className="ti ti-adjustments vergo-select-input-icon" aria-hidden="true"></i>
                <select aria-label="Status" className="form-select" name="status" value={filters.status} onChange={handleFilterChange}>
                  <option value="">Alle Status</option>
                  <option value="open">Offen</option>
                  <option value="in_review">In Prüfung</option>
                </select>
              </div>
            </div>

            <div className="col-md-1 d-flex align-items-end justify-content-end vergo-filter-reset-wrap">
              <button
                type="button"
                className="btn btn-light-primary vergo-filter-reset-btn"
                onClick={() => setFilters({ search: '', status: '' })}
              >
                <i className="ti ti-refresh me-1" aria-hidden="true"></i>
                Zurücksetzen
              </button>
            </div>
          </div>

          {error && !selectedOrder ? <div className="alert alert-danger py-2">{error}</div> : null}
          {isLoading ? <p className="text-muted mb-0">Verfügbare Aufträge werden geladen...</p> : null}

          {!isLoading ? (
            <div className="row g-4">
              {filteredOrders.map((order) => {
                const isSubmitted = hasSubmittedQuote(order)
                const isQuoteRequest = isOrderQuoteRequest(order)

                return (
                  <div className="col-12" key={order.id}>
                    <div className="card vergo-job-card h-100 border">
                      <div className="card-body p-4 p-lg-4">

                        <div className="d-flex align-items-start justify-content-between gap-4 flex-wrap">
                          <div className="vergo-job-card-main">
                            <div className="mb-3">
                              <span className="vergo-job-type-pill">
                                {getOptionLabel(JOB_TYPE_OPTIONS, order.service_type) || 'Allgemeiner Auftrag'}
                              </span>
                            </div>

                            <h4 className="vergo-job-card-title mb-2">{order.title}</h4>

                            <p className="vergo-job-card-description mb-0">
                              {order.description || 'Für diesen Auftrag wurde keine zusätzliche Beschreibung hinzugefügt.'}
                            </p>

                            <div className="mt-3 small text-muted">
                              {order.workflow_status === 'public_inspection_open'
                                ? 'Öffentliche Besichtigungsanfrage'
                                : `Öffentliche Offertenanfrage${order.bid_deadline_at ? ` bis ${order.bid_deadline_at.slice(0, 10)}` : ''}`}
                            </div>
                          </div>

                          <div className="d-flex align-items-start gap-2">
                            <span className={getStatusBadgeClass(order.status)}>
                              {formatStatusLabel(order.status)}
                            </span>
                          </div>
                        </div>

                        <div className="vergo-job-card-footer d-flex align-items-end justify-content-between gap-3 flex-wrap">
                          <div className="vergo-job-meta-row">

                            <div className="vergo-job-meta-item">
                              <i className="ti ti-building-estate"></i>
                              <span>{order.property?.li_number ?? '-'} - {order.property?.title ?? '-'}</span>
                            </div>

                            <div className="vergo-job-meta-item">
                              <i className="ti ti-home-2"></i>
                              <span>{order.property_object?.name ?? 'Gesamte Immobilie / Nicht zugewiesen'}</span>
                            </div>

                            <div className="vergo-job-meta-item">
                              <i className="ti ti-calendar-due"></i>
                              <span>{order.due_date || '-'}</span>
                            </div>
                          </div>

                          {isSubmitted ? (
                            <button type="button" className="btn vergo-job-apply-btn vergo-job-apply-btn-submitted" disabled>
                              {isQuoteRequest ? 'Angebot eingereicht' : 'Besichtigung angefragt'}
                              <i className="ti ti-check ms-2"></i>
                            </button>
                          ) : (
                            <button type="button" className="btn vergo-job-apply-btn" onClick={() => openBidModal(order)}>
                              {isQuoteRequest ? 'Angebot abgeben' : 'Besichtigung anfragen'}
                              <i className="ti ti-arrow-right ms-2"></i>
                            </button>
                          )}
                        </div>

                      </div>
                    </div>
                  </div>
                )
              })}

              {filteredOrders.length === 0 ? (
                <div className="col-12">
                  <div className="border rounded-3 p-5 text-center text-muted">
                    Keine verfügbaren Aufträge gefunden.
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {selectedOrder ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1" aria-hidden="false">
            <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
              <div className="modal-content rounded-1">
                <div className="modal-header border-bottom">
                  <h5 className="modal-title">{t('Auftrag bearbeiten')}</h5>
                  <button type="button" className="btn-close" onClick={closeModal}></button>
                </div>
                <form onSubmit={handleSubmitBid}>
                  <div className="modal-body">
                    <div className="border rounded-3 p-3 mb-3">
                      <div className="text-muted small text-uppercase fw-semibold mb-1">{t('Betreff')}</div>
                      <div className="fw-semibold fs-5">{selectedOrder.title}</div>
                      <div className="text-muted mt-2">
                        {selectedOrder.description || t('Für diesen Auftrag wurde keine zusätzliche Beschreibung hinzugefügt.')}
                      </div>
                    </div>

                    <div className="border rounded-3 p-3 mb-3">
                      <div className="text-muted small text-uppercase fw-semibold mb-2">{t('Liegenschaft')}</div>
                      <div className="row g-3">
                        <div className="col-md-6">
                          <div className="text-muted small">{t('Name')}</div>
                          <div className="fw-semibold">{selectedOrder.property?.title || '-'}</div>
                        </div>
                        <div className="col-md-6">
                          <div className="text-muted small">{t('Adresse')}</div>
                          <div className="fw-semibold">{getPropertyAddress(selectedOrder)}</div>
                        </div>
                        <div className="col-md-3">
                          <div className="text-muted small">{t('PLZ')}</div>
                          <div className="fw-semibold">{selectedOrder.property_object?.postal_code || selectedOrder.property?.postal_code || '-'}</div>
                        </div>
                        <div className="col-md-3">
                          <div className="text-muted small">{t('Ort')}</div>
                          <div className="fw-semibold">{selectedOrder.property_object?.city || selectedOrder.property?.city || '-'}</div>
                        </div>
                        <div className="col-md-6">
                          <div className="text-muted small">{t('LI-Nummer')}</div>
                          <div className="fw-semibold">{selectedOrder.property?.li_number || '-'}</div>
                        </div>
                      </div>
                    </div>

                    {selectedOrderIsInspection ? (
                      <>
                        <div className="border rounded-3 p-3 mb-3">
                          <div className="text-muted small text-uppercase fw-semibold mb-2">{t('Besichtigungstermine')}</div>
                          <div className="row g-3">
                            {[0, 1].map((slotIndex) => {
                              const slot = selectedInspectionSlots[slotIndex]

                              return (
                                <div className="col-md-6" key={slotIndex}>
                                  <div className="bg-light rounded-3 p-3 h-100">
                                    <div className="text-muted small">{t(`Termin ${slotIndex + 1}`)}</div>
                                    <div className="fw-semibold">{slot?.date || '-'}</div>
                                    <div className="text-muted">{slot?.time || '-'}</div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        {selectedOrder.workflow_status === 'public_inspection_open' ? (
                          <div className="border rounded-3 p-3 mb-3">
                            <label className="form-label">{t('Besichtigungstermin auswählen')}</label>
                            <select className="form-select" name="selected_inspection_slot" value={bidForm.selected_inspection_slot} onChange={handleBidChange}>
                              <option value="">{t('Termin auswählen')}</option>
                              {selectedInspectionSlots.map((slot, index) => (
                                <option key={`${slot.date}-${slot.time}-${index}`} value={index}>
                                  {slot.date || '-'} {slot.time || ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : null}

                        <div className="border rounded-3 p-3 mb-3">
                          <div className="text-muted small text-uppercase fw-semibold mb-2">{t('Kontakt vor Ort')}</div>
                          <div className="row g-3">
                            <div className="col-md-6">
                              <div className="text-muted small">{t('Firma')}</div>
                              <div className="fw-semibold">{selectedOnsiteContact.company || '-'}</div>
                            </div>
                            <div className="col-md-6">
                              <div className="text-muted small">{t('Name')}</div>
                              <div className="fw-semibold">{selectedOnsiteName || '-'}</div>
                            </div>
                            <div className="col-md-6">
                              <div className="text-muted small">{t('Telefon')}</div>
                              <div className="fw-semibold">{selectedOnsiteContact.phone || '-'}</div>
                            </div>
                            <div className="col-md-6">
                              <div className="text-muted small">{t('E-Mail')}</div>
                              <div className="fw-semibold">{selectedOnsiteContact.email || '-'}</div>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : null}

                    <div className="alert alert-light border d-flex align-items-center justify-content-between gap-3 flex-wrap">
                      <div>
                        <div className="fw-semibold">{t('Bearbeitung')}</div>
                        <div className="text-muted small">
                          {activeProviderBid?.assigned_provider_email
                            ? `${t('Zugewiesen an')}: ${activeProviderBid.assigned_provider_email}`
                            : t('Noch niemand aus Ihrer Firma bearbeitet diesen Auftrag.')}
                        </div>
                        {lastDraftSavedAt ? (
                          <div className="text-muted small">{t('Automatisch gespeichert')}: {lastDraftSavedAt}</div>
                        ) : null}
                      </div>
                      {isAssignedToMe ? (
                        <span className="badge bg-light-success text-success rounded-pill px-3 py-2">{t('Mir zugewiesen')}</span>
                      ) : activeProviderBid?.status !== 'inspection_requested' ? (
                        <button type="button" className="btn btn-primary btn-sm" disabled={isAssigning} onClick={handleAssignToMe}>
                          {isAssigning ? t('Wird zugewiesen...') : t('Assign to Me')}
                        </button>
                      ) : null}
                    </div>
                    {selectedOrderIsInspection && activeProviderBid?.status === 'inspection_requested' ? (
                      <div className="border rounded-3 p-3 mb-3">
                        <div className="fw-semibold mb-2">{t('Wer übernimmt die Besichtigung?')}</div>
                        <div className="d-flex flex-wrap gap-3 mb-3">
                          <label className="form-check">
                            <input
                              className="form-check-input"
                              type="radio"
                              name="assignment_mode"
                              value="self"
                              checked={assignmentMode === 'self'}
                              onChange={() => setAssignmentMode('self')}
                            />
                            <span className="form-check-label">{t('Ich übernehme selbst')}</span>
                          </label>
                          <label className="form-check">
                            <input
                              className="form-check-input"
                              type="radio"
                              name="assignment_mode"
                              value="other"
                              checked={assignmentMode === 'other'}
                              onChange={() => setAssignmentMode('other')}
                            />
                            <span className="form-check-label">{t('Andere Person in der Firma')}</span>
                          </label>
                        </div>

                        {assignmentMode === 'other' ? (
                          <div className="row g-2 align-items-end">
                            <div className="col-md-8">
                              <label className="form-label">{t('E-Mail der zuständigen Person')}</label>
                              <input
                                type="email"
                                className="form-control"
                                value={targetProviderEmail}
                                onChange={(event) => setTargetProviderEmail(event.target.value)}
                                placeholder="name@firma.ch"
                              />
                            </div>
                            <div className="col-md-4">
                              <button type="button" className="btn btn-primary w-100" disabled={isAssigning} onClick={handleAssignToOther}>
                                {isAssigning ? t('Wird zugewiesen...') : t('Zuweisen und E-Mail senden')}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button type="button" className="btn btn-primary" disabled={isAssigning || isAssignedToMe} onClick={handleAssignToMe}>
                            {isAssignedToMe ? t('Mir zugewiesen') : isAssigning ? t('Wird zugewiesen...') : t('Assign to Me')}
                          </button>
                        )}
                      </div>
                    ) : null}

                    {!selectedOrderIsInspection ? (
                      <div className="row">
                        {isOrderQuoteRequest(selectedOrder) ? (
                          <div className="col-12 mb-3">
                            <label className="form-label">Positionen und Preise</label>
                            <div className="border rounded-3">
                              {(bidForm.line_items ?? []).map((item, index) => (
                                <div key={`${item.label}-${index}`} className="p-3 border-bottom">
                                  <div className="row g-3 align-items-end">
                                    <div className="col-md-5">
                                      {(selectedOrder.quote_items ?? []).length > 0 ? (
                                        <>
                                          <div className="fw-semibold">{item.label}</div>
                                          <div className="text-muted small">{item.quantity} {item.unit || 'Stück'}</div>
                                        </>
                                      ) : (
                                        <div className="row g-2">
                                          <div className="col-12">
                                            <label className="form-label mb-1">Leistung</label>
                                            <input
                                              className="form-control"
                                              value={item.label}
                                              onChange={(event) => handleLineItemChange(index, 'label', event.target.value)}
                                            />
                                          </div>
                                          <div className="col-6">
                                            <label className="form-label mb-1">Menge</label>
                                            <input
                                              type="number"
                                              min="0"
                                              step="0.01"
                                              className="form-control"
                                              value={item.quantity}
                                              onChange={(event) => handleLineItemChange(index, 'quantity', event.target.value)}
                                            />
                                          </div>
                                          <div className="col-6">
                                            <label className="form-label mb-1">Einheit</label>
                                            <input
                                              className="form-control"
                                              value={item.unit}
                                              onChange={(event) => handleLineItemChange(index, 'unit', event.target.value)}
                                            />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    <div className="col-md-3">
                                      <label className="form-label mb-1">Einzelpreis</label>
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="form-control"
                                        value={item.unit_price}
                                        onChange={(event) => handleLineItemChange(index, 'unit_price', event.target.value)}
                                      />
                                    </div>
                                    <div className={(selectedOrder.quote_items ?? []).length > 0 ? 'col-md-4' : 'col-md-3'}>
                                      <div className="text-muted small mb-1">Zwischensumme</div>
                                      <div className="fw-semibold">
                                        {(Number(item.quantity || 0) * Number(item.unit_price || 0)).toFixed(2)} {bidForm.currency}
                                      </div>
                                    </div>
                                    {(selectedOrder.quote_items ?? []).length === 0 ? (
                                      <div className="col-md-1">
                                        <button type="button" className="btn btn-light-danger btn-sm" onClick={() => removeLineItem(index)}>
                                          <i className="ti ti-trash"></i>
                                        </button>
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              ))}
                              {(selectedOrder.quote_items ?? []).length === 0 ? (
                                <div className="p-3 border-bottom">
                                  <button type="button" className="btn btn-light-primary btn-sm" onClick={addLineItem}>
                                    <i className="ti ti-plus me-1"></i>
                                    Position hinzufügen
                                  </button>
                                </div>
                              ) : null}
                              <div className="p-3 d-flex justify-content-between align-items-center">
                                <span className="fw-semibold">Gesamtsumme</span>
                                <span className="fw-semibold">{getQuoteBidTotal().toFixed(2)} {bidForm.currency}</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="col-md-6 mb-3">
                            <label className="form-label">Betrag</label>
                            <input className="form-control" name="amount" value={bidForm.amount} onChange={handleBidChange} />
                          </div>
                        )}

                        <div className="col-md-6 mb-3">
                          <label className="form-label">Währung</label>
                          <select className="form-select" name="currency" value={bidForm.currency} onChange={handleBidChange}>
                            <option value="EUR">EUR</option>
                            <option value="USD">USD</option>
                            <option value="GBP">GBP</option>
                            <option value="AED">AED</option>
                          </select>
                        </div>
                        <div className="col-md-6 mb-3">
                          <label className="form-label">Voraussichtliches Startdatum</label>
                          <input type="date" className="form-control" name="estimated_start_date" value={bidForm.estimated_start_date} onChange={handleBidChange} />
                        </div>
                        <div className="col-md-6 mb-3">
                          <label className="form-label">Voraussichtliches Fertigstellungsdatum</label>
                          <input type="date" className="form-control" name="estimated_completion_date" value={bidForm.estimated_completion_date} onChange={handleBidChange} />
                        </div>
                        <div className="col-12 mb-0">
                          <label className="form-label">Notizen</label>
                          <textarea className="form-control" rows="4" name="notes" value={bidForm.notes} onChange={handleBidChange}></textarea>
                        </div>
                        <div className="col-12 mt-3">
                          <label className="form-label">Angebotsanhang</label>
                          <input type="file" className="form-control" name="attachment" onChange={handleBidChange} />
                          <div className="form-text">Optional. Laden Sie ein Angebot, einen Kostenvoranschlag oder eine unterstützende Datei bis zu 10 MB hoch.</div>
                        </div>
                      </div>
                    ) : null}
                    {error ? <div className="alert alert-danger py-2 mt-3 mb-0">{error}</div> : null}
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-light-danger text-danger" onClick={closeModal}>{t('Abbrechen')}</button>
                    {activeProviderBid?.status === 'inspection_requested' ? (
                      <>
                        <button type="button" className="btn btn-light-danger text-danger" disabled={isSaving} onClick={() => handleProviderDecision('rejected')}>
                          {t('Ablehnen')}
                        </button>
                        <button type="button" className="btn btn-primary" disabled={isSaving || !isAssignedToMe} onClick={() => handleProviderDecision('inspection_confirmed')}>
                          {t('Besichtigung bestätigen')}
                        </button>
                      </>
                    ) : null}
                    {activeProviderBid?.status === 'awarded_pending_acceptance' ? (
                      <>
                        <button type="button" className="btn btn-light-danger text-danger" disabled={isSaving} onClick={() => handleProviderDecision('rejected')}>
                          {t('Ablehnen')}
                        </button>
                        <button type="button" className="btn btn-success" disabled={isSaving || !isAssignedToMe} onClick={() => handleProviderDecision('accepted')}>
                          {t('Auftrag annehmen')}
                        </button>
                      </>
                    ) : null}
                    {['accepted', 'approved'].includes(activeProviderBid?.status) ? (
                      <button type="button" className="btn btn-warning" disabled={isSaving || !isAssignedToMe} onClick={() => handleProviderDecision('completed')}>
                        {t('Als erledigt markieren')}
                      </button>
                    ) : null}
                    {canSubmitCurrentOrder ? (
                      <button type="submit" className="btn btn-primary" disabled={isSaving || !isAssignedToMe}>
                        {isSaving ? 'Wird gespeichert...' : isOrderQuoteRequest(selectedOrder) ? 'Angebot einreichen' : 'Besichtigung anfragen'}
                      </button>
                    ) : null}
                  </div>
                </form>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show"></div>
        </>
      ) : null}
    </PageContent>
  )
}

export default AvailableJobsPage
