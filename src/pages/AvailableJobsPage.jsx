import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageContent from '../components/PageContent'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { api } from '../lib/api'
import { formatDateDisplay, formatTimeDisplay } from '../lib/dateFormat'
import { formatStatusLabel, getStatusBadgeClass } from '../lib/tableStatus'
import {
  ADD_SERVICE_OPTION_VALUE,
  calculateQuoteVatBreakdown,
  createQuoteLineItem,
  formatCurrencyAmount,
  getOptionLabel,
  getTradeActivityOptions,
  getTradeUnitOptions,
  JOB_TYPE_OPTIONS,
} from '../lib/vergoOptions'

const initialBidForm = {
  amount: '',
  currency: 'CHF',
  estimated_start_date: '',
  estimated_completion_date: '',
  notes: '',
  provider_reference: '',
  attachment: null,
  selected_inspection_slot: '',
  vat_included: false,
  line_items: [],
}

const emptyLineItem = {
  id: '',
  category: '',
  label: '',
  code: '',
  unit: '',
  quantity: '',
  unit_price: '',
  is_custom: true,
}

function getInspectionSlots(order) {
  return order?.workflow_meta?.inspection?.preferred_slots ?? []
}

function getPreferredInspectionSlotIndex(order) {
  const value = order?.preferred_inspection_appointment?.slot_index
    ?? order?.workflow_meta?.inspection?.preferred_appointment?.slot_index

  if (value === null || value === undefined || value === '') {
    return null
  }

  const index = Number(value)

  return Number.isInteger(index) && index >= 0 ? index : null
}

function getInspectionSlotIndex(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const index = Number(value)

  return Number.isInteger(index) && index >= 0 ? index : null
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

// Local calendar date in the yyyy-mm-dd form <input type="date"> expects.
// toISOString() would shift the day for anyone east of UTC.
function getTodayDateValue() {
  const now = new Date()

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
}

function getAssignedProviderEmail(bid) {
  return String(
    bid?.assigned_provider_email
    || bid?.workflow_meta?.assigned_provider_email
    || ''
  ).toLowerCase()
}

function getInvoiceRecipient(order) {
  return order?.workflow_meta?.assignment?.invoice_recipient ?? null
}

function getOrderTradeGroup(order) {
  return order?.workflow_meta?.detail_catalog?.trade_group || order?.service_type || ''
}

function getCardDisplayStatus(order, providerBid) {
  if (isInspectionWorkflow(order) && providerBid?.status) {
    return providerBid.status
  }

  return order?.status
}

function getInspectionCardAction(providerBid, isQuoteRequest) {
  const bidStatus = String(providerBid?.status || '').toLowerCase()

  if (bidStatus === 'inspection_confirmed') {
    return { label: 'Offerte erstellen', disabled: false, submitted: false }
  }

  if (['submitted', 'shortlisted', 'approved', 'accepted', 'completed'].includes(bidStatus)) {
    return { label: 'Angebot eingereicht', disabled: true, submitted: true }
  }

  if (isQuoteRequest) {
    return { label: 'Angebot abgeben', disabled: false, submitted: false }
  }

  if (bidStatus === 'inspection_requested') {
    return { label: 'Besichtigung bestätigen', disabled: false, submitted: false }
  }

  if (bidStatus === 'inspection_interest') {
    return { label: 'Besichtigung angefragt', disabled: true, submitted: true }
  }

  return { label: 'Besichtigung bestätigen', disabled: false, submitted: false }
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
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)
  const [assignmentMode, setAssignmentMode] = useState('self')
  const [targetProviderEmail, setTargetProviderEmail] = useState('')
  const [assignmentNotice, setAssignmentNotice] = useState('')
  const [completionSummary, setCompletionSummary] = useState(null)
  const [itemPhotos, setItemPhotos] = useState([])
  const [isPriceChangeOpen, setIsPriceChangeOpen] = useState(false)
  const [priceChangeRows, setPriceChangeRows] = useState([])
  const [priceChangeRequests, setPriceChangeRequests] = useState([])
  const [isSubmittingPriceChange, setIsSubmittingPriceChange] = useState(false)
  const [uploadingPhotoIndex, setUploadingPhotoIndex] = useState(null)
  const [isCompletingJob, setIsCompletingJob] = useState(false)
  const [awardReason, setAwardReason] = useState('')
  const [isAnsweringAward, setIsAnsweringAward] = useState(false)
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState('')
  const [error, setError] = useState('')
  const [hasOpenedInitialOrder, setHasOpenedInitialOrder] = useState(false)
  const providerIsVatSubject = Boolean(user?.service_provider?.is_vat_subject)

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
    const { name, value, files, type, checked } = event.target
    setBidForm((current) => ({
      ...current,
      [name]: files ? files[0] : type === 'checkbox' ? checked : value,
    }))
  }

  function handleLineItemChange(index, field, value) {
    const categoryOptions = getTradeActivityOptions(getOrderTradeGroup(selectedOrder))

    setBidForm((current) => ({
      ...current,
      line_items: current.line_items.map((item, itemIndex) => (
        itemIndex === index
          ? field === 'category'
            ? {
              ...item,
              category: value === ADD_SERVICE_OPTION_VALUE ? '' : value,
              code: value === ADD_SERVICE_OPTION_VALUE ? '' : value,
              is_custom: value === ADD_SERVICE_OPTION_VALUE
                ? true
                : Boolean(value && !categoryOptions.includes(value)),
            }
            : { ...item, [field]: value }
          : item
      )),
    }))
  }

  function hydrateBidForm(order, providerBid = null) {
    const draft = providerBid?.draft_payload
    const tradeGroup = getOrderTradeGroup(order)
    const quoteItems = draft?.line_items
      ?? ((order.quote_items ?? []).length > 0
        ? order.quote_items
        : [createQuoteLineItem(tradeGroup, { ...emptyLineItem, category: '', code: '', quantity: '', source: 'custom', is_custom: true })])

    return {
      ...initialBidForm,
      amount: draft?.amount ?? providerBid?.amount ?? '',
      currency: 'CHF',
      estimated_start_date: draft?.estimated_start_date ?? providerBid?.estimated_start_date ?? '',
      estimated_completion_date: draft?.estimated_completion_date ?? providerBid?.estimated_completion_date ?? '',
      notes: draft?.notes ?? providerBid?.notes ?? '',
      provider_reference: draft?.provider_reference ?? providerBid?.provider_reference ?? '',
      selected_inspection_slot: draft?.selected_inspection_slot ?? providerBid?.workflow_meta?.selected_slot_index ?? '',
      vat_included: Boolean(draft?.vat_included ?? providerBid?.workflow_meta?.vat_included),
      line_items: quoteItems.map((item, index) => createQuoteLineItem(tradeGroup, {
        ...item,
        id: item.id || `${providerBid?.id || order.id || 'new'}-${index}`,
        category: item.category ?? item.code ?? '',
        code: item.code ?? item.category ?? '',
        label: item.label ?? '',
        unit_price: draft ? item.unit_price : '',
        is_custom: item.is_custom ?? false,
      })),
    }
  }

  function addLineItem() {
    setBidForm((current) => ({
      ...current,
      line_items: [
        ...(current.line_items ?? []),
        createQuoteLineItem(getOrderTradeGroup(selectedOrder), {
          ...emptyLineItem,
          id: `custom-${Date.now()}`,
          category: '',
          code: '',
          quantity: '',
          source: 'custom',
          is_custom: true,
        }),
      ],
    }))
  }

  function removeLineItem(index) {
    setBidForm((current) => ({
      ...current,
      line_items: current.line_items.filter((_, itemIndex) => itemIndex !== index),
    }))
  }

  function openBidModal(order) {
    setSelectedOrder(order)
    setBidForm(hydrateBidForm(order, providerBidByOrderId[order.id]))
    setLastDraftSavedAt(providerBidByOrderId[order.id]?.draft_saved_at || '')
    setAssignmentMode('self')
    setTargetProviderEmail('')
    setAssignmentNotice('')
    setCompletionSummary(null)
    setError('')
    loadItemPhotos(order.id)
    loadPriceChangeRequests(order.id)
  }

  function closeModal() {
    setSelectedOrder(null)
    setBidForm(initialBidForm)
    setAssignmentMode('self')
    setTargetProviderEmail('')
    setAssignmentNotice('')
    setLastDraftSavedAt('')
    setCompletionSummary(null)
    setItemPhotos([])
    setPriceChangeRequests([])
    setIsPriceChangeOpen(false)
    setError('')
  }

  async function handleAssignProvider(targetEmail = '') {
    if (!selectedOrder) return

    setIsAssigning(true)
    setError('')
    setAssignmentNotice('')

    try {
      const response = await api.assignProviderOrder(selectedOrder.id, targetEmail ? { assigned_provider_email: targetEmail } : {})
      const assignedBid = {
        ...response.data,
        assigned_provider_email: response.data?.assigned_provider_email
          || targetEmail
          || providerLoginEmail,
      }
      setSubmittedBids((current) => [
        ...current.filter((bid) => bid.order_id !== selectedOrder.id),
        assignedBid,
      ])
      setBidForm(hydrateBidForm(selectedOrder, assignedBid))
      if (targetEmail) {
        setTargetProviderEmail('')
      }
      setAssignmentNotice(
        targetEmail
          ? t('Die Besichtigung wurde zugewiesen und die E-Mail wurde gesendet.')
          : t('Die Besichtigung wurde Ihnen erfolgreich zugewiesen.')
      )
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

    const selectedSlot = selectedInspectionSlots[Number(bidForm.selected_inspection_slot)]

    if (status === 'inspection_confirmed' && !selectedSlot) {
      setError(t('Bitte wählen Sie einen Besichtigungstermin aus.'))
      return
    }

    setIsSaving(true)
    setError('')

    try {
      const payload = status === 'inspection_confirmed'
        ? {
          status,
          workflow_meta: {
            selected_slot_index: Number(bidForm.selected_inspection_slot),
            selected_slot: {
              date: selectedSlot.date || '',
              time: selectedSlot.time || '',
              quote_due_date: selectedSlot.quote_due_date || '',
            },
          },
        }
        : { status }
      const response = await api.updateBid(providerBid.id, payload)
      const updatedBid = response.data
      setSubmittedBids((current) => current.map((bid) => (bid.id === updatedBid.id ? updatedBid : bid)))
      if (status === 'inspection_confirmed') {
        const preferredAppointment = {
          slot_index: Number(bidForm.selected_inspection_slot),
          slot: selectedSlot,
          confirmed_at: updatedBid.workflow_meta?.provider_last_action_at || updatedBid.submitted_at || '',
        }
        const applyPreferredAppointment = (order) => (
          order?.preferred_inspection_appointment
            ? order
            : { ...order, preferred_inspection_appointment: preferredAppointment }
        )

        setSelectedOrder((current) => (
          current?.id === selectedOrder.id ? applyPreferredAppointment(current) : current
        ))
        setOrders((current) => current.map((order) => (
          order.id === selectedOrder.id ? applyPreferredAppointment(order) : order
        )))
      }
    } catch (actionError) {
      setError(t(actionError.message))
    } finally {
      setIsSaving(false)
    }
  }

  async function submitBid() {
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
    payload.append('currency', 'CHF')

    if (isQuoteRequest) {
      const quoteLineItems = (bidForm.line_items ?? []).filter((item) => (
        item.category?.trim()
        && item.label?.trim()
        && item.unit?.trim()
        && Number(item.quantity || 0) > 0
        && Number(item.unit_price || 0) > 0
      ))

      quoteLineItems.forEach((item, index) => {
        const category = item.category.trim()

        payload.append(`line_items[${index}][category]`, category)
        payload.append(`line_items[${index}][label]`, item.label.trim())
        payload.append(`line_items[${index}][code]`, item.code || category)
        payload.append(`line_items[${index}][unit]`, item.unit.trim())
        payload.append(`line_items[${index}][quantity]`, Number(item.quantity || 0))
        payload.append(`line_items[${index}][unit_price]`, Number(item.unit_price || 0))
        payload.append(`line_items[${index}][is_custom]`, item.is_custom ? '1' : '0')
      })

      if (providerIsVatSubject) {
        payload.append('workflow_meta[vat_included]', bidForm.vat_included ? '1' : '0')
      }
    } else if (!isInspectionSignup) {
      payload.append('amount', Number(bidForm.amount))
    }

    if (bidForm.estimated_start_date) payload.append('estimated_start_date', bidForm.estimated_start_date)
    if (bidForm.estimated_completion_date) payload.append('estimated_completion_date', bidForm.estimated_completion_date)
    if (bidForm.notes) payload.append('notes', bidForm.notes)
    if (bidForm.provider_reference) payload.append('provider_reference', bidForm.provider_reference.trim())
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
        item.category?.trim()
        && item.label?.trim()
        && item.unit?.trim()
        && Number(item.quantity || 0) > 0
        && Number(item.unit_price || 0) > 0
      ))

      if (validLineItems.length === 0) {
        setError('Bitte erfassen Sie mindestens eine Position mit Kategorie, Service, Einheit, Menge und Preis.')
        setIsSaving(false)
        return
      }

    } else if (!isInspectionSignup && !bidForm.amount) {
      setError(t('Gebotsbetrag erforderlich.'))
      setIsSaving(false)
      return
    }

    // The two date fields are only shown when this is a real quote (same
    // condition as the form), so they are only mandatory there.
    const datesAreRequired = !isInspectionWorkflow(selectedOrder) || isQuoteRequest

    if (datesAreRequired && !bidForm.estimated_start_date) {
      setError(t('Bitte geben Sie ein voraussichtliches Startdatum ein.'))
      setIsSaving(false)
      return
    }

    if (datesAreRequired && !bidForm.estimated_completion_date) {
      setError(t('Bitte geben Sie ein voraussichtliches Fertigstellungsdatum ein.'))
      setIsSaving(false)
      return
    }

    if (
      bidForm.estimated_start_date
      && bidForm.estimated_completion_date
      && bidForm.estimated_completion_date < bidForm.estimated_start_date
    ) {
      setError(t('Das voraussichtliche Fertigstellungsdatum darf nicht vor dem Startdatum liegen.'))
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
  const activeAssignedProviderEmail = getAssignedProviderEmail(activeProviderBid)
  const isAssignedToMe = Boolean(activeAssignedProviderEmail) && activeAssignedProviderEmail === providerLoginEmail
  // The manager published a scope that differs from what this company
  // priced, so their old quote is parked until they send new prices.
  const requiresRequote = Boolean(activeProviderBid?.workflow_meta?.requires_requote)
  // The awarded provider closes the job themselves; that opens the client's
  // confidential rating and returns the invoicing summary.
  // The manager awarded this job and is waiting for the company to confirm.
  const isAwaitingMyAcceptance = activeProviderBid?.status === 'awarded_pending_acceptance'
  // Work is running: it can still be abandoned, with a substantial reason.
  const isRunningJob = ['accepted', 'approved'].includes(activeProviderBid?.status)
  // Someone else won.
  const lostToAnotherCompany = activeProviderBid?.status === 'rejected'
  const canMarkJobCompleted = Boolean(selectedOrder)
    && ['approved', 'accepted'].includes(activeProviderBid?.status)
    && !['completed', 'closed'].includes(String(selectedOrder?.status || '').toLowerCase())
  const requoteItemCount = Number(activeProviderBid?.workflow_meta?.requote_item_count ?? 0)
  const canSubmitCurrentOrder = selectedOrder
    ? selectedOrder.workflow_status === 'public_inspection_open' || isOrderQuoteRequest(selectedOrder)
    : false
  // Nothing in the quote is editable until somebody in the company has taken
  // the job on. Assign first, then fill in the offer.
  const canEditQuote = isAssignedToMe

  useEffect(() => {
    if (!selectedOrder || !activeProviderBid?.id || !isAssignedToMe) {
      return undefined
    }

    const intervalId = window.setInterval(async () => {
      try {
        const response = await api.saveBidDraft(activeProviderBid.id, {
          draft_payload: {
            amount: bidForm.amount,
            currency: 'CHF',
            vat_included: bidForm.vat_included,
            estimated_start_date: bidForm.estimated_start_date,
            estimated_completion_date: bidForm.estimated_completion_date,
            notes: bidForm.notes,
            provider_reference: bidForm.provider_reference,
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

  async function loadItemPhotos(orderId) {
    if (!orderId) {
      setItemPhotos([])
      return
    }

    try {
      const response = await api.getOrderPhotos(orderId)
      setItemPhotos(response.data ?? [])
    } catch {
      // Photos are supplementary; a failure here must not block the quote form.
      setItemPhotos([])
    }
  }

  async function handlePhotoSelected(event, lineItemIndex) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file || !selectedOrder) {
      return
    }

    setUploadingPhotoIndex(lineItemIndex)
    setError('')

    try {
      const formData = new FormData()
      formData.append('photo', file)
      formData.append('line_item_index', String(lineItemIndex))
      await api.uploadOrderPhoto(selectedOrder.id, formData)
      await loadItemPhotos(selectedOrder.id)
    } catch (uploadError) {
      setError(t(uploadError.message))
    } finally {
      setUploadingPhotoIndex(null)
    }
  }

  async function handleDeletePhoto(photoId) {
    if (!selectedOrder) {
      return
    }

    try {
      await api.deleteOrderPhoto(selectedOrder.id, photoId)
      await loadItemPhotos(selectedOrder.id)
    } catch (deleteError) {
      setError(t(deleteError.message))
    }
  }

  async function loadPriceChangeRequests(orderId) {
    if (!orderId) {
      setPriceChangeRequests([])
      return
    }

    try {
      const response = await api.getPriceChangeRequests(orderId)
      setPriceChangeRequests(response.data ?? [])
    } catch {
      setPriceChangeRequests([])
    }
  }

  /**
   * Seeds the change form with the items already in the awarded quote plus the
   * items the manager dropped after the inspection, so the provider can put the
   * omitted ones back in.
   */
  function openPriceChangeModal() {
    const quoted = (activeProviderBid?.line_items ?? []).map((item) => ({
      change_type: 'changed',
      label: item.label ?? '',
      unit: item.unit ?? '',
      quantity: Number(item.quantity ?? 0),
      original_unit_price: Number(item.unit_price ?? 0),
      unit_price: Number(item.unit_price ?? 0),
      reason: '',
      include: false,
    }))

    const quotedLabels = new Set(quoted.map((row) => String(row.label).toLowerCase()))
    const omitted = (activeProviderBid?.workflow_meta?.omitted_line_items ?? [])
      .filter((item) => !quotedLabels.has(String(item.label ?? '').toLowerCase()))
      .map((item) => ({
        change_type: 'added',
        label: item.label ?? '',
        unit: item.unit ?? '',
        quantity: Number(item.quantity ?? 0),
        original_unit_price: null,
        unit_price: Number(item.unit_price ?? 0),
        reason: '',
        include: false,
      }))

    setPriceChangeRows([...quoted, ...omitted])
    setIsPriceChangeOpen(true)
  }

  function updatePriceChangeRow(index, patch) {
    setPriceChangeRows((current) => current.map((row, rowIndex) => (
      rowIndex === index ? { ...row, ...patch } : row
    )))
  }

  function addPriceChangeRow() {
    setPriceChangeRows((current) => ([
      ...current,
      { change_type: 'added', label: '', unit: '', quantity: 1, original_unit_price: null, unit_price: 0, reason: '', include: true },
    ]))
  }

  async function handleSubmitPriceChange() {
    const selectedRows = priceChangeRows.filter((row) => row.include)

    if (selectedRows.length === 0) {
      setError(t('Bitte wählen Sie mindestens eine Position aus.'))
      return
    }

    // Every changed price and every added item needs its own reason.
    if (selectedRows.some((row) => !String(row.reason || '').trim())) {
      setError(t('Bitte begründen Sie jede Preisänderung und jede hinzugefügte Position.'))
      return
    }

    if (selectedRows.some((row) => !String(row.label || '').trim())) {
      setError(t('Bitte geben Sie für jede Position eine Bezeichnung an.'))
      return
    }

    setIsSubmittingPriceChange(true)
    setError('')

    try {
      const unchanged = priceChangeRows
        .filter((row) => !row.include && row.change_type === 'changed')
        .reduce((total, row) => total + (Number(row.quantity || 0) * Number(row.original_unit_price || 0)), 0)
      const changed = selectedRows
        .reduce((total, row) => total + (Number(row.quantity || 0) * Number(row.unit_price || 0)), 0)

      await api.createPriceChangeRequest(selectedOrder.id, {
        // `include` is a form-only flag and must not reach the API.
        items: selectedRows.map((row) => ({
          change_type: row.change_type,
          label: row.label,
          unit: row.unit,
          quantity: Number(row.quantity || 0),
          original_unit_price: row.original_unit_price === null ? null : Number(row.original_unit_price),
          unit_price: Number(row.unit_price || 0),
          reason: row.reason,
        })),
        requested_amount: Number((unchanged + changed).toFixed(2)),
      })

      setIsPriceChangeOpen(false)
      setPriceChangeRows([])
      await loadPriceChangeRequests(selectedOrder.id)
    } catch (submitError) {
      setError(t(submitError.message))
    } finally {
      setIsSubmittingPriceChange(false)
    }
  }

  async function handleAwardAnswer(action) {
    if (!selectedOrder) {
      return
    }

    if (action === 'cancel' && awardReason.trim().length < 20) {
      setError(t('Bitte geben Sie eine Begründung mit mindestens 20 Zeichen an.'))
      return
    }

    setIsAnsweringAward(true)
    setError('')

    try {
      if (action === 'accept') {
        await api.acceptAward(selectedOrder.id)
      } else if (action === 'decline') {
        await api.declineAward(selectedOrder.id, awardReason.trim() || null)
      } else {
        await api.cancelAward(selectedOrder.id, awardReason.trim())
      }

      setAwardReason('')
      await loadOrders()
      closeModal()
    } catch (awardError) {
      setError(t(awardError.message))
    } finally {
      setIsAnsweringAward(false)
    }
  }

  async function handleMarkJobCompleted() {
    if (!selectedOrder || isCompletingJob) {
      return
    }

    setIsCompletingJob(true)
    setError('')

    try {
      const response = await api.completeProviderOrder(selectedOrder.id)
      setCompletionSummary(response.data ?? null)
      await loadOrders()
    } catch (completeError) {
      setError(t(completeError.message))
    } finally {
      setIsCompletingJob(false)
    }
  }

  async function handleSaveDraft() {
    if (!activeProviderBid?.id || !isAssignedToMe) {
      return
    }

    setIsSavingDraft(true)

    try {
      const response = await api.saveBidDraft(activeProviderBid.id, {
        draft_payload: {
          amount: bidForm.amount,
          currency: 'CHF',
          vat_included: bidForm.vat_included,
          estimated_start_date: bidForm.estimated_start_date,
          estimated_completion_date: bidForm.estimated_completion_date,
          notes: bidForm.notes,
          provider_reference: bidForm.provider_reference,
          selected_inspection_slot: bidForm.selected_inspection_slot,
          line_items: bidForm.line_items,
        },
      })

      setLastDraftSavedAt(response.data?.draft_saved_at || '')
    } catch {
      // Manual draft saving should stay non-blocking.
    } finally {
      setIsSavingDraft(false)
    }
  }

  function isOrderQuoteRequest(order) {
    const providerBid = providerBidByOrderId[order.id]

    return order.workflow_status === 'published_for_quotes'
      || (
        order.workflow_status === 'inspection_signup_closed'
        && ['inspection_interest', 'inspection_confirmed'].includes(providerBid?.status)
      )
      || (
        order.workflow_type === 'inspection'
        && providerBid?.status === 'inspection_confirmed'
      )
  }

  function hasSubmittedQuote(order) {
    return ['submitted', 'shortlisted', 'approved', 'accepted', 'completed'].includes(providerBidByOrderId[order.id]?.status)
  }

  const filteredOrders = orders.filter((order) => {
    const providerBid = providerBidByOrderId[order.id]

    if (order.workflow_status === 'public_inspection_open' && providerBid && !getAssignedProviderEmail(providerBid)) {
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
  const selectedPreferredInspectionSlotIndex = getPreferredInspectionSlotIndex(selectedOrder)
  const selectedOwnInspectionSlotIndex = getInspectionSlotIndex(
    bidForm.selected_inspection_slot !== ''
      ? bidForm.selected_inspection_slot
      : activeProviderBid?.workflow_meta?.selected_slot_index
  )
  const selectedOnsiteContact = getOnsiteContact(selectedOrder)
  const selectedInvoiceRecipient = getInvoiceRecipient(selectedOrder)
  const selectedOrderCompleted = ['completed', 'closed'].includes(String(selectedOrder?.status || '').toLowerCase())
    || ['completed', 'closed'].includes(String(selectedOrder?.workflow_status || '').toLowerCase())
    || activeProviderBid?.status === 'completed'
  const selectedQuoteTradeGroup = getOrderTradeGroup(selectedOrder)
  const selectedQuoteCategoryOptions = getTradeActivityOptions(selectedQuoteTradeGroup)
  const selectedQuoteUnitOptions = getTradeUnitOptions(selectedQuoteTradeGroup)
  // Some sections only apply to inspections or to quote requests, so the step
  // numbers are assigned in render order rather than hard-coded. Reset on every
  // render; nextQuoteStep() is called once per section as it renders.
  const quoteStepCounter = { value: 0 }
  const nextQuoteStep = () => ++quoteStepCounter.value

  const quoteBidBreakdown = calculateQuoteVatBreakdown(
    bidForm.line_items ?? [],
    providerIsVatSubject,
    Boolean(bidForm.vat_included),
  )
  const selectedOnsiteName = [
    selectedOnsiteContact.first_name,
    selectedOnsiteContact.last_name,
  ].filter(Boolean).join(' ')
  const canChooseInspectionSlot = selectedOrderIsInspection && (
    selectedOrder?.workflow_status === 'public_inspection_open'
    || ['inspection_requested', 'inspection_interest'].includes(activeProviderBid?.status)
  )
  // Assignment is always available on a job that is still open to this provider:
  // inspection or order, awarded directly or published publicly, and whether or
  // not anyone from the company has picked it up yet.
  const canAssignJob = Boolean(selectedOrder) && !selectedOrderCompleted

  return (
    <PageContent
      title={t('Verfügbare Aufträge')}
      subtitle={t('Offene Aufträge, auf die Dienstleister Angebote abgeben können.')}
      breadcrumbs={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: t('Verfügbare Aufträge') },
      ]}
    >
      <div className="row g-3 mb-4 vergo-filter-bar">
        <div className="col-md-4">
          <div className="card vergo-job-stat-card h-100">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <div className="text-muted mb-1">{t('Offene Aufträge')}</div>
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
                  <div className="text-muted mb-1">{t('In Prüfung')}</div>
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
                  <div className="text-muted mb-1">{t('Ihre eingereichten Angebote')}</div>
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
                  placeholder={t('Nach Auftrag, Immobilie, Objekt oder Dienstleistungstyp suchen')}
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
          {isLoading ? <p className="text-muted mb-0">{t('Verfügbare Aufträge werden geladen...')}</p> : null}

          {!isLoading ? (
            <div className="row g-4">
              {filteredOrders.map((order) => {
                const providerBid = providerBidByOrderId[order.id]
                const isQuoteRequest = isOrderQuoteRequest(order)
                const cardDisplayStatus = getCardDisplayStatus(order, providerBid)
                const cardAction = getInspectionCardAction(providerBid, isQuoteRequest)
                // A colleague in the same company took this job on. It stays
                // listed for transparency but must not be opened or edited.
                const assignedEmail = getAssignedProviderEmail(providerBid)
                const isLockedByColleague = Boolean(assignedEmail) && assignedEmail !== providerLoginEmail

                return (
                  <div className="col-12" key={order.id}>
                    <div className={`card vergo-job-card h-100 border${isLockedByColleague ? ' vergo-job-card-locked' : ''}`}>
                      <div className="card-body p-4 p-lg-4">

                        <div className="d-flex align-items-start justify-content-between gap-4 flex-wrap">
                          <div className="vergo-job-card-main">
                            <div className="mb-3">
                              <span className="vergo-job-type-pill">
                                {getOptionLabel(JOB_TYPE_OPTIONS, order.service_type) || t('Allgemeiner Auftrag')}
                              </span>
                            </div>

                            <h4 className="vergo-job-card-title mb-2">{order.title}</h4>

                            <p className="vergo-job-card-description mb-0">
                              {order.description || t('Für diesen Auftrag wurde keine zusätzliche Beschreibung hinzugefügt.')}
                            </p>

                            <div className="mt-3 small text-muted">
                              {order.workflow_status === 'public_inspection_open'
                                ? t('Öffentliche Besichtigungsanfrage')
                                : `${t('Öffentliche Offertenanfrage')}${order.bid_deadline_at ? ` ${t('bis')} ${formatDateDisplay(order.bid_deadline_at)}` : ''}`}
                            </div>

                            {assignedEmail ? (
                              <div className="mt-2 small">
                                <i className="ti ti-user-check me-1"></i>
                                {isLockedByColleague
                                  ? `${t('In Bearbeitung durch')}: ${assignedEmail}`
                                  : `${t('Von Ihnen übernommen')}: ${assignedEmail}`}
                              </div>
                            ) : null}
                          </div>

                          <div className="d-flex align-items-start gap-2">
                            <span className={getStatusBadgeClass(cardDisplayStatus)}>
                              {t(formatStatusLabel(cardDisplayStatus))}
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
                              <span>{order.property_object?.name ?? t('Gesamte Immobilie / Nicht zugewiesen')}</span>
                            </div>

                            <div className="vergo-job-meta-item">
                              <i className="ti ti-calendar-due"></i>
                              <span>{formatDateDisplay(order.due_date)}</span>
                            </div>
                          </div>

                          {isLockedByColleague ? (
                            <button type="button" className="btn vergo-job-apply-btn" disabled>
                              {t('Von Kollege übernommen')}
                              <i className="ti ti-lock ms-2"></i>
                            </button>
                          ) : cardAction.submitted ? (
                            <button type="button" className="btn vergo-job-apply-btn vergo-job-apply-btn-submitted" disabled>
                              {t(cardAction.label)}
                              <i className="ti ti-check ms-2"></i>
                            </button>
                          ) : (
                            <button type="button" className="btn vergo-job-apply-btn" disabled={cardAction.disabled} onClick={() => openBidModal(order)}>
                              {t(cardAction.label)}
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
                    {t('Keine verfügbaren Aufträge gefunden.')}
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
            <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-xl vergo-provider-bid-dialog">
              <div className="modal-content rounded-1">
                <div className="modal-header border-bottom">
                  <h5 className="modal-title">{t('Auftrag bearbeiten')}</h5>
                  <button type="button" className="btn-close" onClick={closeModal}></button>
                </div>
                <form
                  onSubmit={handleSubmitBid}
                  onKeyDown={(event) => {
                    // The quote may only be sent by clicking the button, never
                    // by pressing Enter in one of the fields.
                    if (event.key === 'Enter' && event.target.tagName !== 'TEXTAREA') {
                      event.preventDefault()
                    }
                  }}
                >
                  <div className="modal-body">
                    <div className="border rounded-3 p-3 mb-3">
                      <div className="text-muted small text-uppercase fw-semibold mb-1">{t('Betreff')}</div>
                      <div className="fw-semibold fs-5">{selectedOrder.title}</div>
                      <div className="text-muted mt-2">
                        {selectedOrder.description || t('Für diesen Auftrag wurde keine zusätzliche Beschreibung hinzugefügt.')}
                      </div>
                    </div>

                    {requiresRequote ? (
                      <div className="alert alert-warning border mb-3">
                        <div className="fw-semibold mb-1">{t('Das Auftragsvolumen hat sich geändert')}</div>
                        <div className="small mb-2">
                          {requoteItemCount > 0
                            ? `${t('Die Bewirtschaftung hat den Leistungsumfang angepasst. Bitte reichen Sie eine neue Offerte für die')} ${requoteItemCount} ${t('aktuellen Positionen ein.')}`
                            : t('Die Bewirtschaftung hat den Leistungsumfang angepasst. Bitte reichen Sie eine neue Offerte ein.')}
                        </div>
                        <div className="small text-muted mb-2">
                          {t('Mengen und Einheiten sind bereits hinterlegt - Sie müssen nur Ihre Preise eintragen.')}
                        </div>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => document.getElementById('vergo-bid-form-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                        >
                          {t('Neue Preise eingeben')}
                        </button>
                      </div>
                    ) : null}

                    {isAwaitingMyAcceptance ? (
                      <div className="border rounded-3 p-3 mb-3">
                        <div className="fw-semibold mb-1">{t('Sie haben den Zuschlag erhalten')}</div>
                        <p className="text-muted small">
                          {t('Bitte bestätigen Sie den Auftrag, damit die Arbeit starten kann.')}
                        </p>
                        <input
                          className="form-control mb-2"
                          value={awardReason}
                          placeholder={t('Begründung bei Ablehnung (optional)')}
                          onChange={(event) => setAwardReason(event.target.value)}
                        />
                        <div className="d-flex gap-2 flex-wrap">
                          <button type="button" className="btn btn-success" disabled={isAnsweringAward}
                            onClick={() => handleAwardAnswer('accept')}>
                            {isAnsweringAward ? t('Wird gespeichert...') : t('Auftrag annehmen')}
                          </button>
                          <button type="button" className="btn btn-danger" disabled={isAnsweringAward}
                            onClick={() => handleAwardAnswer('decline')}>
                            {t('Auftrag ablehnen')}
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {lostToAnotherCompany ? (
                      <div className="alert alert-light border mb-3">
                        <span className="badge bg-light-danger text-danger rounded-pill px-3 py-2 me-2">
                          {t('Nicht erhalten')}
                        </span>
                        {t('Dieser Auftrag wurde an eine andere Firma vergeben.')}
                      </div>
                    ) : null}

                    {isRunningJob ? (
                      <div className="border rounded-3 p-3 mb-3">
                        <div className="fw-semibold mb-1">{t('Auftrag stornieren')}</div>
                        <p className="text-muted small">
                          {t('Eine Begründung von mindestens 20 Zeichen ist zwingend. Die Bewirtschaftung und der Eigentümer werden informiert.')}
                        </p>
                        <textarea
                          className="form-control mb-2"
                          rows="2"
                          value={awardReason}
                          placeholder={t('Warum können Sie den Auftrag nicht ausführen?')}
                          onChange={(event) => setAwardReason(event.target.value)}
                        ></textarea>
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                          <button type="button" className="btn btn-light-danger text-danger"
                            disabled={isAnsweringAward || awardReason.trim().length < 20}
                            onClick={() => handleAwardAnswer('cancel')}>
                            {isAnsweringAward ? t('Wird gespeichert...') : t('Auftrag stornieren')}
                          </button>
                          <span className="text-muted small">{awardReason.trim().length} / 20</span>
                        </div>
                      </div>
                    ) : null}

                    {canMarkJobCompleted || completionSummary ? (
                      <div className="border rounded-3 p-3 mb-3">
                        <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
                          <div>
                            <div className="fw-semibold">{t('Auftragsstatus')}</div>
                            <div className="text-muted small">
                              {completionSummary
                                ? t('Sie haben diesen Auftrag als abgeschlossen gemeldet.')
                                : t('Der Auftrag bleibt aktiv, bis Sie ihn als abgeschlossen melden.')}
                            </div>
                          </div>
                          <div className="d-flex gap-2 flex-wrap">
                            {canMarkJobCompleted ? (
                              <button type="button" className="btn btn-light-primary btn-sm" onClick={openPriceChangeModal}>
                                {t('Preisänderung beantragen')}
                              </button>
                            ) : null}
                            {canMarkJobCompleted && !completionSummary ? (
                              <button type="button" className="btn btn-primary btn-sm" disabled={isCompletingJob} onClick={handleMarkJobCompleted}>
                                {isCompletingJob ? t('Wird gemeldet...') : t('Auftrag als abgeschlossen melden')}
                              </button>
                            ) : null}
                          </div>
                        </div>

                        {priceChangeRequests.length > 0 ? (
                          <div className="mt-3 pt-3 border-top">
                            <div className="fw-semibold mb-2">{t('Preisänderungsanträge')}</div>
                            {priceChangeRequests.map((entry) => (
                              <div key={entry.id} className="d-flex justify-content-between align-items-center gap-2 small border rounded-3 px-3 py-2 mb-2">
                                <span>
                                  {(entry.items ?? []).length} {t('Positionen')} · {formatCurrencyAmount(Number(entry.requested_amount || 0), 'CHF')}
                                </span>
                                <span className={`badge rounded-pill px-3 py-2 ${
                                  entry.status === 'approved' ? 'bg-light-success text-success'
                                    : entry.status === 'rejected' ? 'bg-light-danger text-danger'
                                      : 'bg-light-warning text-warning'}`}>
                                  {t(entry.status === 'approved' ? 'Genehmigt' : entry.status === 'rejected' ? 'Abgelehnt' : 'In Prüfung')}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        {completionSummary ? (
                          <div className="mt-3 pt-3 border-top">
                            <div className="fw-semibold mb-2">{t('Zusammenfassung für Ihre Rechnung')}</div>
                            <div className="row g-3 small">
                              <div className="col-md-6">
                                <div className="text-muted">{t('Auftragsnummer')}</div>
                                <div className="fw-semibold">
                                  {completionSummary.order_number || '-'}
                                  {completionSummary.provider_reference ? ` (${completionSummary.provider_reference})` : ''}
                                </div>
                              </div>
                              <div className="col-md-6">
                                <div className="text-muted">{t('Liegenschaft')}</div>
                                <div className="fw-semibold">{completionSummary.property?.name || '-'}</div>
                                <div className="text-muted">
                                  {[completionSummary.property?.street, completionSummary.property?.postal_code, completionSummary.property?.city].filter(Boolean).join(', ') || '-'}
                                </div>
                              </div>
                              <div className="col-md-6">
                                <div className="text-muted">{t('Eigentümer')}</div>
                                <div className="fw-semibold">{completionSummary.owner?.name || '-'}</div>
                                <div className="text-muted">
                                  {[completionSummary.owner?.address, completionSummary.owner?.postal_code, completionSummary.owner?.city].filter(Boolean).join(', ') || '-'}
                                </div>
                              </div>
                              <div className="col-md-6">
                                <div className="text-muted">{t('Bewirtschaftung')}</div>
                                <div className="fw-semibold">{completionSummary.property_manager?.name || '-'}</div>
                                <div className="text-muted">
                                  {[completionSummary.property_manager?.address, completionSummary.property_manager?.postal_code, completionSummary.property_manager?.city].filter(Boolean).join(', ') || '-'}
                                </div>
                              </div>
                              <div className="col-12">
                                <div className="text-muted">{t('Rechnungsadresse')}</div>
                                <div className="fw-semibold">{completionSummary.billing_address?.name || '-'}</div>
                                <div className="text-muted">
                                  {[completionSummary.billing_address?.address, completionSummary.billing_address?.postal_code, completionSummary.billing_address?.city].filter(Boolean).join(', ') || '-'}
                                </div>
                                {completionSummary.billing_address?.email ? (
                                  <div className="text-muted">{completionSummary.billing_address.email}</div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {canAssignJob ? (
                      <div className="vergo-quote-section">
                        <div className="vergo-quote-section-head">
                          <span className="vergo-quote-step">{nextQuoteStep()}</span>
                          <div>
                            <h6 className="vergo-quote-section-title">{selectedOrderIsInspection ? t('Wer übernimmt die Besichtigung?') : t('Wer übernimmt den Auftrag?')}</h6>
                            <p className="vergo-quote-section-hint mb-0">{t('Nur die zuständige Person kann die Offerte bearbeiten.')}</p>
                          </div>
                        </div>
                        <div className="text-muted small mb-3">
                          {activeAssignedProviderEmail
                            ? `${t('Zugewiesen an')}: ${activeAssignedProviderEmail}`
                            : t('Noch niemand aus Ihrer Firma bearbeitet diesen Auftrag.')}
                          {lastDraftSavedAt ? ` · ${t('Automatisch gespeichert')}: ${lastDraftSavedAt}` : ''}
                        </div>
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
                        {assignmentNotice ? (
                          <div className="alert alert-success py-2 mt-3 mb-0">
                            {assignmentNotice}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="vergo-quote-section vergo-quote-section-muted">
                      <div className="vergo-quote-section-head">
                        <span className="vergo-quote-step">{nextQuoteStep()}</span>
                        <div>
                          <h6 className="vergo-quote-section-title">{t('Liegenschaft')}</h6>
                          <p className="vergo-quote-section-hint mb-0">{t('Angaben zum Objekt - nur zur Information.')}</p>
                        </div>
                      </div>
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
                        <div className="vergo-quote-section vergo-quote-section-muted">
                          <div className="vergo-quote-section-head">
                            <span className="vergo-quote-step">{nextQuoteStep()}</span>
                            <div>
                              <h6 className="vergo-quote-section-title">{t('Besichtigungstermine')}</h6>
                              <p className="vergo-quote-section-hint mb-0">{t('Wählen Sie den Termin, an dem Sie vor Ort sind.')}</p>
                            </div>
                          </div>
                          <div className="row g-3">
                            {[0, 1].map((slotIndex) => {
                              const slot = selectedInspectionSlots[slotIndex]
                              const isPreferredSlot = selectedPreferredInspectionSlotIndex === slotIndex
                              const isOwnSlot = selectedOwnInspectionSlotIndex === slotIndex

                              return (
                                <div className="col-md-6" key={slotIndex}>
                                  <div className={`bg-light rounded-3 p-3 h-100 vergo-inspection-slot-card${isPreferredSlot ? ' is-preferred' : ''}${isOwnSlot ? ' is-own' : ''}`}>
                                    <div className="d-flex align-items-start justify-content-between gap-2 mb-1">
                                      <div className="text-muted small">{t(`Termin ${slotIndex + 1}`)}</div>
                                      <div className="d-flex align-items-center justify-content-end gap-1 flex-wrap">
                                        {isPreferredSlot ? (
                                          <span className="vergo-inspection-slot-preferred-badge">
                                            <i className="ti ti-star-filled" aria-hidden="true"></i>
                                            {t('Preferred appointment')}
                                          </span>
                                        ) : null}
                                        {isOwnSlot ? (
                                          <span className="vergo-inspection-slot-own-badge">
                                            <i className="ti ti-check" aria-hidden="true"></i>
                                            {t('Your appointment')}
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>
                                    <div className="fw-semibold">{formatDateDisplay(slot?.date)}</div>
                                    <div className="text-muted">{formatTimeDisplay(slot?.time)}</div>
                                    <div className="text-muted small mt-2">
                                      {t('Offerte erstellen bis')}: {formatDateDisplay(slot?.quote_due_date)}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        {canChooseInspectionSlot ? (
                          <div className="border rounded-3 p-3 mb-3">
                            <label className="form-label">{t('Besichtigungstermin auswählen')}</label>
                            <select className="form-select" name="selected_inspection_slot" value={bidForm.selected_inspection_slot} onChange={handleBidChange}>
                              <option value="">{t('Termin auswählen')}</option>
                              {selectedInspectionSlots.map((slot, index) => {
                                const isPreferredSlot = selectedPreferredInspectionSlotIndex === index
                                const isOwnSlot = selectedOwnInspectionSlotIndex === index

                                return (
                                  <option key={`${slot.date}-${slot.time}-${index}`} value={index}>
                                    {isPreferredSlot ? '★ ' : ''}{formatDateDisplay(slot.date)} {formatTimeDisplay(slot.time)}{isPreferredSlot ? ` - ${t('Preferred appointment')}` : ''}{isOwnSlot ? ` - ${t('Your appointment')}` : ''}
                                  </option>
                                )
                              })}
                            </select>
                          </div>
                        ) : null}

                        <div className="vergo-quote-section vergo-quote-section-muted">
                          <div className="vergo-quote-section-head">
                            <span className="vergo-quote-step">{nextQuoteStep()}</span>
                            <div>
                              <h6 className="vergo-quote-section-title">{t('Kontakt vor Ort')}</h6>
                              <p className="vergo-quote-section-hint mb-0">{t('Ansprechperson für die Besichtigung.')}</p>
                            </div>
                          </div>
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

                    <div id="vergo-bid-form-anchor"></div>
                    {(!selectedOrderIsInspection || isOrderQuoteRequest(selectedOrder)) ? (
                      <div className="row">
                        {selectedOrder?.attachment_name ? (
                          <div className="col-12 mb-3">
                            <div className="border rounded-3 p-3">
                              <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
                                <div>
                                  <div className="text-muted small text-uppercase fw-semibold mb-1">{t('Anhang')}</div>
                                  <div className="fw-semibold">{selectedOrder.attachment_name}</div>
                                </div>
                                <button
                                  type="button"
                                  className="btn btn-light-primary btn-sm"
                                  onClick={() => api.downloadOrderAttachment(selectedOrder.id, selectedOrder.attachment_name)}
                                >
                                  {t('Anhang herunterladen')}
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : null}
                        <div className="col-12">
                          <fieldset className="row vergo-quote-fieldset" disabled={!canEditQuote}>
                        {selectedInvoiceRecipient && selectedOrderCompleted ? (
                          <div className="col-12 mb-3">
                            <div className="border rounded-3 p-3">
                              <div className="text-muted small text-uppercase fw-semibold mb-2">{t('Rechnungsversand')}</div>
                              <div className="row g-3">
                                <div className="col-md-4">
                                  <div className="text-muted small">{t('Empfänger')}</div>
                                  <div className="fw-semibold">
                                    {selectedInvoiceRecipient.recipient_type === 'manager_profile'
                                      ? t('Immobilienverwalter')
                                      : t('Dritte')}
                                  </div>
                                </div>
                                <div className="col-md-4">
                                  <div className="text-muted small">{t('Versandart')}</div>
                                  <div className="fw-semibold">{selectedInvoiceRecipient.delivery_method === 'mail' ? t('Post') : t('E-Mail')}</div>
                                </div>
                                {selectedInvoiceRecipient.email ? (
                                  <div className="col-md-4">
                                    <div className="text-muted small">{t('E-Mail für Rechnungen')}</div>
                                    <div className="fw-semibold">{selectedInvoiceRecipient.email}</div>
                                  </div>
                                ) : null}
                                {selectedInvoiceRecipient.company_name || selectedInvoiceRecipient.company_extra ? (
                                  <div className="col-md-6">
                                    <div className="text-muted small">{t('Firma')}</div>
                                    <div className="fw-semibold">{[selectedInvoiceRecipient.company_name, selectedInvoiceRecipient.company_extra].filter(Boolean).join(' / ') || '-'}</div>
                                  </div>
                                ) : null}
                                {selectedInvoiceRecipient.first_name || selectedInvoiceRecipient.last_name ? (
                                  <div className="col-md-6">
                                    <div className="text-muted small">{t('Name')}</div>
                                    <div className="fw-semibold">{[selectedInvoiceRecipient.first_name, selectedInvoiceRecipient.last_name].filter(Boolean).join(' ') || '-'}</div>
                                  </div>
                                ) : null}
                                {selectedInvoiceRecipient.address || selectedInvoiceRecipient.postal_code || selectedInvoiceRecipient.city ? (
                                  <div className="col-12">
                                    <div className="text-muted small">{t('Adresse')}</div>
                                    <div className="fw-semibold">
                                      {[selectedInvoiceRecipient.address, selectedInvoiceRecipient.postal_code, selectedInvoiceRecipient.city].filter(Boolean).join(', ') || '-'}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        ) : null}
                        {isOrderQuoteRequest(selectedOrder) && !canEditQuote ? (
                          <div className="col-12 mb-3">
                            <div className="alert alert-warning border mb-0">
                              <i className="ti ti-lock me-1"></i>
                              {t('Bitte übernehmen Sie den Auftrag zuerst. Erst danach können Sie Positionen und Preise bearbeiten.')}
                            </div>
                          </div>
                        ) : null}

                        {isOrderQuoteRequest(selectedOrder) ? (
                          <div className="col-12 mb-3">
                            <div className="vergo-quote-section-head">
                              <span className="vergo-quote-step">{nextQuoteStep()}</span>
                              <div>
                                <h6 className="vergo-quote-section-title">{t('Positionen und Preise')}</h6>
                                <p className="vergo-quote-section-hint mb-0">{t('Tragen Sie hier Ihre Preise ein. Die Summe wird automatisch berechnet.')}</p>
                              </div>
                            </div>
                            <div className="border rounded-3">
                              {(bidForm.line_items ?? []).map((item, index) => {
                                const usesCustomCategory = Boolean(item.is_custom || (item.category && !selectedQuoteCategoryOptions.includes(item.category)))

                                return (
                                  <div key={item.id || index} className="p-3 border-bottom vergo-provider-quote-line">
                                    <div className="row g-2 g-xl-3 align-items-start vergo-provider-quote-line-grid">
                                      <div className="col-lg-1 col-md-2 vergo-provider-quote-line-item-number">
                                        <label className="form-label mb-1">{t('Position')}</label>
                                        <input className="form-control text-center" value={index + 1} readOnly />
                                      </div>
                                      <div className="col-lg-3 col-md-5 vergo-provider-quote-line-category">
                                        <label className="form-label mb-1">{t('Kategorie')}</label>
                                        {usesCustomCategory ? (
                                          <>
                                            <input
                                              className="form-control"
                                              value={item.category || ''}
                                              onChange={(event) => handleLineItemChange(index, 'category', event.target.value)}
                                              placeholder={t('Kategorie eingeben')}
                                            />
                                            <button type="button" className="btn btn-link btn-sm p-0 mt-1" onClick={() => handleLineItemChange(index, 'category', '')}>
                                              {t('Aus Liste wählen')}
                                            </button>
                                          </>
                                        ) : (
                                          <select
                                            className="form-select"
                                            value={item.category || ''}
                                            onChange={(event) => handleLineItemChange(index, 'category', event.target.value)}
                                          >
                                            <option value="">{t('Kategorie auswählen')}</option>
                                            {selectedQuoteCategoryOptions.map((option) => (
                                              <option key={option} value={option}>{option}</option>
                                            ))}
                                            <option value={ADD_SERVICE_OPTION_VALUE}>{t('Service hinzufügen')}</option>
                                          </select>
                                        )}
                                      </div>
                                      <div className="col-lg-3 col-md-5 vergo-provider-quote-line-service">
                                        <label className="form-label mb-1">{t('Service')}</label>
                                        <input
                                          className="form-control"
                                          value={item.label}
                                          onChange={(event) => handleLineItemChange(index, 'label', event.target.value)}
                                          placeholder={t('Service beschreiben')}
                                        />
                                      </div>
                                      <div className="col-lg-2 col-md-4 vergo-provider-quote-line-unit">
                                        <label className="form-label mb-1">{t('Einheit')}</label>
                                        <select
                                          className="form-select"
                                          value={item.unit || ''}
                                          onChange={(event) => handleLineItemChange(index, 'unit', event.target.value)}
                                        >
                                          <option value="">{t('Einheit wählen')}</option>
                                          {item.unit && !selectedQuoteUnitOptions.includes(item.unit) ? (
                                            <option value={item.unit}>{item.unit}</option>
                                          ) : null}
                                          {selectedQuoteUnitOptions.map((option) => (
                                            <option key={option} value={option}>{option}</option>
                                          ))}
                                        </select>
                                      </div>
                                      <div className="col-lg-1 col-md-4 vergo-provider-quote-line-quantity">
                                        <label className="form-label mb-1">{t('Menge')}</label>
                                        <input
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          className="form-control"
                                          value={item.quantity}
                                          onChange={(event) => handleLineItemChange(index, 'quantity', event.target.value)}
                                        />
                                      </div>
                                      <div className="col-lg-2 col-md-4 vergo-provider-quote-line-price">
                                        <label className="form-label mb-1">{t('Einzelpreis')}</label>
                                        <input
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          className="form-control"
                                          value={item.unit_price}
                                          onChange={(event) => handleLineItemChange(index, 'unit_price', event.target.value)}
                                        />
                                      </div>
                                      <div className="col-lg-2 col-md-6 vergo-provider-quote-line-subtotal">
                                        <div className="text-muted small mb-1">{t('Zwischensumme')}</div>
                                        <div className="fw-semibold">
                                          {formatCurrencyAmount(Number(item.quantity || 0) * Number(item.unit_price || 0), bidForm.currency)}
                                        </div>
                                      </div>
                                      <div className="col-lg-1 col-md-6 vergo-provider-quote-line-remove">
                                        <button
                                          type="button"
                                          className="btn btn-light-danger btn-sm w-100"
                                          onClick={() => removeLineItem(index)}
                                          disabled={(bidForm.line_items ?? []).length <= 1}
                                          aria-label={t('Position entfernen')}
                                        >
                                          <i className="ti ti-trash"></i>
                                        </button>
                                      </div>
                                    </div>

                                    <div className="d-flex flex-wrap align-items-center gap-2 mt-2">
                                      {/* capture="environment" opens the camera on a phone; without it
                                          the same input is a normal file picker. */}
                                      <label className="btn btn-light-primary btn-sm mb-0">
                                        <i className="ti ti-camera me-1"></i>
                                        {t('Foto aufnehmen')}
                                        <input
                                          type="file"
                                          accept="image/*"
                                          capture="environment"
                                          className="d-none"
                                          onChange={(event) => handlePhotoSelected(event, index)}
                                        />
                                      </label>
                                      <label className="btn btn-light-primary btn-sm mb-0">
                                        <i className="ti ti-upload me-1"></i>
                                        {t('Foto hochladen')}
                                        <input
                                          type="file"
                                          accept="image/*"
                                          className="d-none"
                                          onChange={(event) => handlePhotoSelected(event, index)}
                                        />
                                      </label>
                                      {uploadingPhotoIndex === index ? (
                                        <span className="text-muted small">{t('Wird hochgeladen...')}</span>
                                      ) : null}

                                      {itemPhotos.filter((photo) => photo.line_item_index === index).map((photo) => (
                                        <span key={photo.id} className="badge bg-light-primary text-primary d-inline-flex align-items-center gap-2 px-2 py-2">
                                          <i className="ti ti-photo"></i>
                                          <span className="text-truncate" style={{ maxWidth: '140px' }}>{photo.name}</span>
                                          {photo.is_published ? (
                                            <i className="ti ti-eye" title={t('Von der Bewirtschaftung freigegeben')}></i>
                                          ) : null}
                                          <button
                                            type="button"
                                            className="btn-close btn-close-sm"
                                            aria-label={t('Foto entfernen')}
                                            onClick={() => handleDeletePhoto(photo.id)}
                                          ></button>
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )
                              })}
                              <div className="px-3 pb-3">
                                <div className="alert alert-light border small mb-0">
                                  <i className="ti ti-alert-circle me-1"></i>
                                  {t('Bitte laden Sie hier keine offiziellen Offerten Ihrer Firma hoch - nur Fotos zur jeweiligen Position.')}
                                </div>
                              </div>
                              <div className="p-3 border-bottom">
                                <button type="button" className="btn btn-light-primary btn-sm" onClick={addLineItem}>
                                  <i className="ti ti-plus me-1"></i>
                                  {t('Position hinzufügen')}
                                </button>
                              </div>
                              <div className="p-3">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                  <span className="fw-semibold">{t('Total')}</span>
                                  <span className="fw-semibold">{formatCurrencyAmount(quoteBidBreakdown.subtotal, bidForm.currency)}</span>
                                </div>
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                  <span className="text-muted">{t('MwSt.')} (8.1%)</span>
                                  <span className="text-muted">{formatCurrencyAmount(quoteBidBreakdown.vat, bidForm.currency)}</span>
                                </div>
                                <div className="d-flex justify-content-between align-items-center border-top pt-2">
                                  <span className="fw-semibold">{t('Gesamtsumme')}</span>
                                  <span className="fw-semibold">{formatCurrencyAmount(quoteBidBreakdown.total, bidForm.currency)}</span>
                                </div>
                              </div>
                            </div>
                            {providerIsVatSubject ? (
                              <div className="form-check mt-3">
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  id="bid-vat-included"
                                  name="vat_included"
                                  checked={Boolean(bidForm.vat_included)}
                                  onChange={handleBidChange}
                                />
                                <label className="form-check-label fw-semibold" htmlFor="bid-vat-included">
                                  {t('Preise inkl. MwSt.')}
                                </label>
                                <div className="form-text">
                                  {t('Nicht aktiviert bedeutet: Preise exkl. MwSt. Diese Einstellung gilt für alle Positionen.')}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="col-md-6 mb-3">
                            <label className="form-label">Betrag</label>
                            <input className="form-control" name="amount" value={bidForm.amount} onChange={handleBidChange} />
                          </div>
                        )}

                        <div className="col-12">
                          <div className="vergo-quote-section-head mt-2">
                            <span className="vergo-quote-step">{nextQuoteStep()}</span>
                            <div>
                              <h6 className="vergo-quote-section-title">{t('Termine und Angaben')}</h6>
                              <p className="vergo-quote-section-hint mb-0">{t('Wann können Sie starten und fertigstellen?')}</p>
                            </div>
                          </div>
                        </div>

                        <div className="col-md-6 mb-3">
                          <label className="form-label">{t('Voraussichtliches Startdatum')} *</label>
                          <input type="date" className="form-control" name="estimated_start_date" value={bidForm.estimated_start_date} min={getTodayDateValue()} onChange={handleBidChange} />
                        </div>
                        <div className="col-md-6 mb-3">
                          <label className="form-label">{t('Voraussichtliches Fertigstellungsdatum')} *</label>
                          <input type="date" className="form-control" name="estimated_completion_date" value={bidForm.estimated_completion_date} min={bidForm.estimated_start_date || getTodayDateValue()} onChange={handleBidChange} />
                        </div>
                        <div className="col-md-6 mb-3">
                          <label className="form-label">{t('Eigene Angebotsnummer')}</label>
                          <input
                            type="text"
                            className="form-control"
                            name="provider_reference"
                            maxLength="64"
                            value={bidForm.provider_reference}
                            onChange={handleBidChange}
                            placeholder={t('z. B. OFF-2026-042')}
                          />
                          <div className="form-text">{t('Optional. Nur für Sie sichtbar - Verwaltung und andere Firmen sehen diese Nummer nie.')}</div>
                        </div>
                        <div className="col-12 mb-0">
                          <label className="form-label">Notizen</label>
                          <textarea className="form-control" rows="4" name="notes" value={bidForm.notes} onChange={handleBidChange}></textarea>
                        </div>
                        <div className="col-12 mt-3">
                          <label className="form-label">{t('Angebotsanhang')}</label>
                          <input type="file" className="form-control" name="attachment" onChange={handleBidChange} />
                          <div className="form-text">{t('Optional. Laden Sie ein Angebot, einen Kostenvoranschlag oder eine unterstützende Datei bis zu 10 MB hoch.')}</div>
                        </div>
                          </fieldset>
                        </div>
                      </div>
                    ) : null}
                    {error ? <div className="alert alert-danger py-2 mt-3 mb-0">{error}</div> : null}

                    {isOrderQuoteRequest(selectedOrder) ? (
                      <div className="vergo-quote-total-bar mt-3">
                        <span className="text-muted">
                          {(bidForm.line_items ?? []).length} {t('Positionen')} · {t('inkl. MwSt.')}
                        </span>
                        <span className="vergo-quote-total-value">
                          {formatCurrencyAmount(quoteBidBreakdown.total, bidForm.currency)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-light-danger text-danger" onClick={closeModal}>{t('Abbrechen')}</button>
                    {canSubmitCurrentOrder && activeProviderBid?.id && isAssignedToMe ? (
                      <button type="button" className="btn btn-light-primary" disabled={isSavingDraft} onClick={handleSaveDraft}>
                        {isSavingDraft ? t('Wird gespeichert...') : t('Als Entwurf speichern')}
                      </button>
                    ) : null}
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
                        {isSaving ? t('Wird gespeichert...') : isOrderQuoteRequest(selectedOrder) ? t('Angebot einreichen') : t('Besichtigung bestätigen')}
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

      {isPriceChangeOpen ? (
        <div className="modal fade show d-block" tabIndex="-1" role="dialog" style={{ background: 'rgba(15, 23, 42, 0.45)' }}>
          <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <div>
                  <h5 className="modal-title">{t('Preisänderung beantragen')}</h5>
                  <p className="text-muted small mb-0">
                    {t('Für jede Preisänderung und jede hinzugefügte Position ist eine Begründung zwingend.')}
                  </p>
                </div>
                <button type="button" className="btn-close" aria-label={t('Schließen')} onClick={() => setIsPriceChangeOpen(false)}></button>
              </div>
              <div className="modal-body">
                <div className="table-responsive">
                  <table className="table align-middle mb-0">
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}></th>
                        <th>{t('Leistung')}</th>
                        <th style={{ width: '90px' }}>{t('Menge')}</th>
                        <th style={{ width: '120px' }}>{t('Bisher')}</th>
                        <th style={{ width: '130px' }}>{t('Neu')}</th>
                        <th>{t('Begründung')} *</th>
                      </tr>
                    </thead>
                    <tbody>
                      {priceChangeRows.map((row, index) => (
                        <tr key={index} className={row.change_type === 'added' ? 'table-light' : ''}>
                          <td>
                            <input
                              type="checkbox"
                              className="form-check-input"
                              checked={row.include}
                              onChange={(event) => updatePriceChangeRow(index, { include: event.target.checked })}
                            />
                          </td>
                          <td>
                            <input
                              className="form-control form-control-sm"
                              value={row.label}
                              onChange={(event) => updatePriceChangeRow(index, { label: event.target.value })}
                            />
                            {row.change_type === 'added' ? (
                              <span className="badge bg-light-primary text-primary mt-1">{t('Hinzugefügt')}</span>
                            ) : null}
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              className="form-control form-control-sm"
                              value={row.quantity}
                              onChange={(event) => updatePriceChangeRow(index, { quantity: event.target.value })}
                            />
                          </td>
                          <td className="text-muted">
                            {row.original_unit_price === null ? '-' : formatCurrencyAmount(Number(row.original_unit_price), 'CHF')}
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="0.05"
                              className="form-control form-control-sm"
                              value={row.unit_price}
                              onChange={(event) => updatePriceChangeRow(index, { unit_price: event.target.value })}
                            />
                          </td>
                          <td>
                            <input
                              className={`form-control form-control-sm${row.include && !String(row.reason || '').trim() ? ' is-invalid' : ''}`}
                              value={row.reason}
                              placeholder={t('Warum ändert sich das?')}
                              onChange={(event) => updatePriceChangeRow(index, { reason: event.target.value })}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button type="button" className="btn btn-light-primary btn-sm mt-3" onClick={addPriceChangeRow}>
                  <i className="ti ti-plus me-1"></i>
                  {t('Position hinzufügen')}
                </button>

                <div className="alert alert-warning border small mt-3 mb-0">
                  {t('Eigenmächtige Preisänderungen und zusätzliche Positionen senken Ihr VERGO-Ranking.')}
                </div>

                {error ? <div className="alert alert-danger py-2 mt-3 mb-0">{error}</div> : null}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setIsPriceChangeOpen(false)}>
                  {t('Abbrechen')}
                </button>
                <button type="button" className="btn btn-primary" disabled={isSubmittingPriceChange} onClick={handleSubmitPriceChange}>
                  {isSubmittingPriceChange ? t('Wird gesendet...') : t('Zur Genehmigung senden')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </PageContent>
  )
}

export default AvailableJobsPage
