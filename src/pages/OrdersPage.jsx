import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import PageContent from '../components/PageContent'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { confirmDelete, showDeleteSuccess } from '../lib/alerts'
import { api } from '../lib/api'
import { formatDateDisplay, formatDateTimeDisplay } from '../lib/dateFormat'
import { formatStatusLabel, getStatusBadgeClass } from '../lib/tableStatus'
import { ADD_SERVICE_OPTION_VALUE, JOB_TYPE_OPTIONS, TRADE_ACTIVITY_OPTIONS_BY_GROUP, TRADE_OBJECT_OPTIONS_BY_GROUP, createQuoteLineItem, getOptionLabel, getOrderFlowTypeLabel, lineItemQuantity, normalizeServiceTypeForApi } from '../lib/vergoOptions'

const initialForm = {
  property_id: '',
  property_object_id: '',
  requester_name: '',
  requester_email: '',
  title: '',
  service_type: '',
  trade_object: '',
  trade_activity: '',
  description: '',
  status: 'open',
  due_date: '',
}

const initialCompanyRequestForm = {
  company_name: '',
  contact_name: '',
  email: '',
  phone: '',
  canton: '',
  city: '',
  notes: '',
}

const COST_ESTIMATE_OPTIONS = [
  { value: '1-1000', label: '1 - 1000' },
  { value: '1001-5000', label: '1001 - 5000' },
  { value: '5001-10000', label: '5001 - 10000' },
  { value: '10001+', label: '10001+' },
]

const BID_PRIORITY_OPTIONS = [
  { value: 'lowest_price', label: 'Niedrigster Preis' },
  { value: 'fastest_turnaround', label: 'Schnellste Ausführung' },
  { value: 'high_quality_materials', label: 'Hochwertige Materialien' },
]

const SWISS_CANTONS = [
  { value: 'AG', label: 'AG - Aargau' },
  { value: 'AI', label: 'AI - Appenzell Innerrhoden' },
  { value: 'AR', label: 'AR - Appenzell Ausserrhoden' },
  { value: 'BE', label: 'BE - Bern' },
  { value: 'BL', label: 'BL - Basel-Landschaft' },
  { value: 'BS', label: 'BS - Basel-Stadt' },
  { value: 'FR', label: 'FR - Fribourg' },
  { value: 'GE', label: 'GE - Geneve' },
  { value: 'GL', label: 'GL - Glarus' },
  { value: 'GR', label: 'GR - Graubunden' },
  { value: 'JU', label: 'JU - Jura' },
  { value: 'LU', label: 'LU - Luzern' },
  { value: 'NE', label: 'NE - Neuchatel' },
  { value: 'NW', label: 'NW - Nidwalden' },
  { value: 'OW', label: 'OW - Obwalden' },
  { value: 'SG', label: 'SG - St. Gallen' },
  { value: 'SH', label: 'SH - Schaffhausen' },
  { value: 'SO', label: 'SO - Solothurn' },
  { value: 'SZ', label: 'SZ - Schwyz' },
  { value: 'TG', label: 'TG - Thurgau' },
  { value: 'TI', label: 'TI - Ticino' },
  { value: 'UR', label: 'UR - Uri' },
  { value: 'VD', label: 'VD - Vaud' },
  { value: 'VS', label: 'VS - Valais' },
  { value: 'ZG', label: 'ZG - Zug' },
  { value: 'ZH', label: 'ZH - Zurich' },
]

function getTodayDateValue() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

const TODAY_DATE = getTodayDateValue()

function getDateOffsetValue(offsetDays) {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

const MIN_BID_DEADLINE_DATE = getDateOffsetValue(2)
const TOMORROW_DATE = getDateOffsetValue(1)


const MANAGER_ORDER_STEPS = [
  { id: 1, label: 'Liegenschaft', helper: 'Objekte wählen', icon: 'ti ti-building-estate' },
  { id: 2, label: 'Ablauf', helper: 'Besichtigung oder Auftrag', icon: 'ti ti-git-branch' },
  { id: 3, label: 'Details', helper: 'Gewerk und Angaben', icon: 'ti ti-file-description' },
  { id: 4, label: 'Vergabe', helper: 'Anfrageart festlegen', icon: 'ti ti-badge-ad' },
  { id: 5, label: 'Firmen', helper: 'Anbieter auswählen', icon: 'ti ti-users' },
]

// The heading each wizard step opens with.
const MANAGER_STEP_HEADINGS = {
  1: { title: 'Liegenschaft wählen', helper: 'Wählen Sie die Liegenschaft und die dazugehörigen Objekte, für die der Auftrag erstellt werden soll.' },
  2: { title: 'Ablauf wählen', helper: 'Wählen Sie, ob eine Besichtigung geplant oder direkt ein Auftrag vergeben werden soll.' },
  3: { title: 'Details erfassen', helper: 'Wählen Sie das Gewerk und beschreiben Sie den Auftrag.' },
  4: { title: 'Anfrageart wählen', helper: 'Legen Sie fest, ob direkt bei ausgewählten Firmen angefragt oder öffentlich ausgeschrieben werden soll.' },
  5: { title: 'Firmen auswählen', helper: 'Wählen Sie die passenden Dienstleister für diese Anfrage aus.' },
}

function getInspectionQuoteGenerateStorageKey(orderId) {
  return `vergo.inspectionQuoteGenerate.${orderId}`
}

function readInspectionQuoteGenerateState(orderId) {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const value = window.sessionStorage.getItem(getInspectionQuoteGenerateStorageKey(orderId))

    if (!value) {
      return null
    }

    const parsed = JSON.parse(value)
    const quoteItems = Array.isArray(parsed?.quote_items) ? parsed.quote_items : []
    const quoteSourceBidIds = Array.isArray(parsed?.quote_source_bid_ids) ? parsed.quote_source_bid_ids : []

    return {
      source_order_id: parsed?.source_order_id ?? orderId,
      quote_items: quoteItems,
      quote_source_bid_ids: quoteSourceBidIds,
    }
  } catch {
    return null
  }
}

function clearInspectionQuoteGenerateState(orderId) {
  if (typeof window === 'undefined') {
    return
  }

  window.sessionStorage.removeItem(getInspectionQuoteGenerateStorageKey(orderId))
}

function getInitialManagerWizard(propertyId = '') {
  return {
    property_id: propertyId,
    selected_object_ids: [],
    flow_type: '',
    service_type: '',
    trade_object: '',
    trade_activity: '',
    title: '',
    description: '',
    inspection_date_1: '',
    inspection_time_1: '',
    inspection_quote_due_date_1: '',
    inspection_date_2: '',
    inspection_time_2: '',
    inspection_quote_due_date_2: '',
    has_second_inspection_option: false,
    onsite_company: '',
    onsite_first_name: '',
    onsite_last_name: '',
    onsite_phone: '',
    onsite_email: '',
    inspection_request_mode: '',
    inspection_provider_limit: '3',
    public_provider_limit: '3',
    completion_mode: 'fixed_date',
    due_date: '',
    attachment: null,
    award_mode: '',
    cost_estimate_range: '',
    bid_priority: '',
    bid_deadline_at: '',
    quote_item_source: 'manager',
    invoice_recipient_type: 'manager_profile',
    invoice_delivery_method: 'email',
    invoice_email: '',
    invoice_company_name: '',
    invoice_company_extra: '',
    invoice_first_name: '',
    invoice_last_name: '',
    invoice_address: '',
    invoice_postal_code: '',
    invoice_city: '',
    quote_items: [],
    source_inspection_order_id: '',
    source_inspection_quote_bid_ids: [],
    selected_provider_ids: [],
  }
}


function getOrderObjectLabel(order) {
  const objectCount = order?.property_object_ids?.length ?? 0

  if (objectCount > 1) {
    const leadLabel = order?.property_object?.address || order?.property_object?.name || '-'
    return `${leadLabel} +${objectCount - 1}`
  }

  return order?.property_object?.name || '-'
}



function isWeekendDate(value) {
  if (!value) {
    return false
  }

  const date = new Date(`${value}T00:00:00`)
  const day = date.getDay()

  return day === 0 || day === 6
}


function isPastDate(value) {
  return Boolean(value && value < TODAY_DATE)
}

// A time only counts as "past" relative to the date it sits on: 08:00 is fine
// tomorrow but not if today is already 15:42.
function isPastDateTime(dateValue, timeValue) {
  if (!dateValue || !timeValue) {
    return false
  }

  const [hours, minutes] = String(timeValue).split(':').map(Number)

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return false
  }

  const selected = new Date(`${dateValue}T00:00:00`)

  if (Number.isNaN(selected.getTime())) {
    return false
  }

  selected.setHours(hours, minutes, 0, 0)

  return selected.getTime() < Date.now()
}



function OrdersPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [searchParams, setSearchParams] = useSearchParams()
  const [orders, setOrders] = useState([])
  const [deletedOrders, setDeletedOrders] = useState([])
  const [properties, setProperties] = useState([])
  const [objects, setObjects] = useState([])
  const [form, setForm] = useState(initialForm)
  const [managerWizard, setManagerWizard] = useState(getInitialManagerWizard())
  // Photos the manager attaches to their own items. The order does not exist
  // yet while the wizard is open, so they are held here and uploaded the moment
  // it has been saved. Keyed by the item id.
  const [managerStep, setManagerStep] = useState(1)
  const [isCompanyRequestModalOpen, setIsCompanyRequestModalOpen] = useState(false)
  const [companyRequestForm, setCompanyRequestForm] = useState(initialCompanyRequestForm)
  const [isSubmittingCompanyRequest, setIsSubmittingCompanyRequest] = useState(false)
  const [filters, setFilters] = useState({
    search: '',
    status: '',
  })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingOrderId, setEditingOrderId] = useState(null)
  // When true, the wizard was launched from an inspection quote ("Auftrag generieren"):
  // Gewerk is fixed, the provider's line items are locked, and only the bid deadline is entered.
  const [generateLock, setGenerateLock] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingDeletedOrders, setIsLoadingDeletedOrders] = useState(false)
  const [restoringOrderId, setRestoringOrderId] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [duplicatePrompt, setDuplicatePrompt] = useState(null)
  const [duplicateExplanation, setDuplicateExplanation] = useState('')
  const [isSavingDuplicate, setIsSavingDuplicate] = useState(false)

  const canCreateOrders = Boolean(user?.permissions?.orders?.create)
  const canEditOrders = Boolean(user?.permissions?.orders?.edit)
  const canDeleteOrders = Boolean(user?.permissions?.orders?.delete)
  const canManageOrders = canCreateOrders || canEditOrders || canDeleteOrders
  const isAdmin = user?.role === 'admin'
  // Restoring a deleted order is an internal repair action - property managers
  // must not be able to bring an order back themselves.
  const canRecoverOrders = isAdmin || user?.role === 'employee'
  const showActionColumn = isAdmin || canEditOrders || canDeleteOrders
  const isManager = user?.role === 'manager'
  const isOwner = user?.role === 'owner'
  // The owner sees what was deleted on their own properties, but never gets a
  // restore button - that stays with Vergo staff.
  const canSeeDeletedOrders = canRecoverOrders || isOwner
  const isManagerOrderFlow = isManager

  async function loadData() {
    setIsLoading(true)
    setError('')

    try {
      const [ordersResponse, propertiesResponse, objectsResponse, deletedOrdersResponse] = await Promise.all([
        api.getOrders(),
        api.getProperties(),
        api.getPropertyObjects(),
        canSeeDeletedOrders ? api.getDeletedOrders() : Promise.resolve({ data: [] }),
      ])

      setOrders(ordersResponse.data ?? [])
      setDeletedOrders(deletedOrdersResponse.data ?? [])
      setProperties(propertiesResponse.data ?? [])
      setObjects(objectsResponse.data ?? [])
    } catch (loadError) {
      setError(t(loadError.message))
    } finally {
      setIsLoading(false)
    }
  }

  async function loadDeletedOrders() {
    if (!canSeeDeletedOrders) {
      return
    }

    setIsLoadingDeletedOrders(true)
    setError('')

    try {
      const response = await api.getDeletedOrders()
      setDeletedOrders(response.data ?? [])
    } catch (loadError) {
      setError(t(loadError.message))
    } finally {
      setIsLoadingDeletedOrders(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const managerPropertyOptions = useMemo(() => {
    if (!isManager) {
      return properties
    }

    const scopedPropertyId = String(user?.property?.id ?? '')

    if (!scopedPropertyId) {
      return properties
    }

    const scopedProperties = properties.filter((property) => String(property.id) === scopedPropertyId)

    return scopedProperties.length > 0 ? scopedProperties : [user.property].filter(Boolean)
  }, [isManager, properties, user?.property])

  const defaultManagerPropertyId = isManager
    ? String(managerPropertyOptions[0]?.id ?? user?.property?.id ?? '')
    : ''

  useEffect(() => {
    if (isManager && managerPropertyOptions.length > 0 && !form.property_id) {
      setForm((current) => ({
        ...current,
        property_id: defaultManagerPropertyId,
      }))
    }
  }, [defaultManagerPropertyId, form.property_id, isManager, managerPropertyOptions.length])

  useEffect(() => {
    if (isManager && managerPropertyOptions.length > 0 && !managerWizard.property_id) {
      setManagerWizard((current) => ({
        ...current,
        property_id: defaultManagerPropertyId,
      }))
    }
  }, [defaultManagerPropertyId, isManager, managerPropertyOptions.length, managerWizard.property_id])

  useEffect(() => {
    const shouldOpenCreate = searchParams.get('open') === 'create'

    if (!shouldOpenCreate || !canCreateOrders || isModalOpen || isLoading) {
      return
    }

    openCreateModal()

    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('open')
    setSearchParams(nextParams, { replace: true })
  }, [canCreateOrders, defaultManagerPropertyId, isLoading, isModalOpen, searchParams, setSearchParams, properties.length])

  useEffect(() => {
    const generateFromId = searchParams.get('generate-from')

    if (!generateFromId || !canCreateOrders || isModalOpen || isLoading) {
      return
    }

    let cancelled = false

    async function startGenerateFromInspection() {
      try {
        const response = await api.getOrder(generateFromId)
        const source = response?.data

        if (cancelled || !source) {
          return
        }

        const resolvedPropertyId = String(source.property_id ?? defaultManagerPropertyId ?? properties[0]?.id ?? '')
        const baseWizard = getInitialManagerWizard(resolvedPropertyId)
        const objectIds = (Array.isArray(source.property_object_ids) && source.property_object_ids.length > 0
          ? source.property_object_ids
          : (source.property_object_id ? [source.property_object_id] : [])).map(Number)
        const sourceTradeGroup = source.workflow_meta?.detail_catalog?.trade_group || source.service_type || ''
        const generatedQuoteState = readInspectionQuoteGenerateState(generateFromId)
        const sourceQuoteItems = (generatedQuoteState?.quote_items ?? []).length > 0
          ? generatedQuoteState.quote_items
          : (source.quote_items ?? [])
        const quoteItems = sourceQuoteItems.map((item, index) => createQuoteLineItem(sourceTradeGroup, {
          ...item,
          id: `gen-${index}`,
          category: item.category ?? item.code ?? '',
          source: 'provider',
          // An empty category always opens on the list, whatever a draft stored.
          is_custom: item.category ? (item.is_custom ?? false) : false,
        }))

        setEditingOrderId(null)
        setError('')
        setForm({ ...initialForm, property_id: resolvedPropertyId })
        setManagerWizard({
          ...baseWizard,
          property_id: resolvedPropertyId,
          selected_object_ids: objectIds,
          flow_type: 'direct_order',
          service_type: source.service_type ?? '',
          title: source.title ?? '',
          description: source.description ?? '',
          completion_mode: 'asap',
          award_mode: 'request_quotes',
          quote_item_source: 'manager',
          quote_items: quoteItems,
          source_inspection_order_id: Number(generatedQuoteState?.source_order_id ?? source.id),
          source_inspection_quote_bid_ids: generatedQuoteState?.quote_source_bid_ids ?? [],
        })
        setManagerStep(3)
        setGenerateLock(true)
        setIsModalOpen(true)
      } catch (generateError) {
        if (!cancelled) {
          setError(t(generateError.message))
        }
      } finally {
        if (!cancelled) {
          const nextParams = new URLSearchParams(searchParams)
          nextParams.delete('generate-from')
          setSearchParams(nextParams, { replace: true })
          clearInspectionQuoteGenerateState(generateFromId)
        }
      }
    }

    startGenerateFromInspection()

    return () => {
      cancelled = true
    }
  }, [canCreateOrders, defaultManagerPropertyId, isLoading, isModalOpen, searchParams, setSearchParams, properties, user, t])

  useEffect(() => {
    if (isModalOpen) {
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
  }, [isModalOpen])

  function handleChange(event) {
    const { name, value } = event.target

    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === 'property_id' ? { property_object_id: '' } : {}),
      ...(name === 'service_type' ? { trade_object: '', trade_activity: '' } : {}),
      ...(name === 'trade_object' ? { trade_activity: '' } : {}),
    }))
  }











  /**
   * Sends the held photos once the order has an id. The item's position in the
   * list is what ties a photo to a line item.
   */




  function handleFilterChange(event) {
    const { name, value } = event.target

    setFilters((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const availableObjects = useMemo(() => {
    if (!form.property_id) {
      return []
    }

    return objects.filter((item) => String(item.property_id) === String(form.property_id))
  }, [form.property_id, objects])

  const managerAvailableObjects = useMemo(() => {
    if (!managerWizard.property_id) {
      return []
    }

    return objects.filter((item) => String(item.property_id) === String(managerWizard.property_id))
  }, [managerWizard.property_id, objects])


  const availableTradeObjects = useMemo(
    () => TRADE_OBJECT_OPTIONS_BY_GROUP[form.service_type] ?? [],
    [form.service_type],
  )

  const availableTradeActivities = useMemo(
    () => TRADE_ACTIVITY_OPTIONS_BY_GROUP[form.service_type] ?? [],
    [form.service_type],
  )

  useEffect(() => {
    if (isManagerOrderFlow && managerAvailableObjects.length === 1 && managerWizard.selected_object_ids.length === 0) {
      setManagerWizard((current) => ({
        ...current,
        selected_object_ids: [managerAvailableObjects[0].id],
      }))
    }
  }, [isManagerOrderFlow, managerAvailableObjects, managerWizard.selected_object_ids.length])

  function openCreateModal() {
    setEditingOrderId(null)
    setError('')
    setForm({
      ...initialForm,
      property_id: defaultManagerPropertyId,
    })
    setManagerWizard(getInitialManagerWizard(defaultManagerPropertyId))
    setManagerStep(1)
    setGenerateLock(false)
    setIsModalOpen(true)
  }


  function closeCompanyRequestModal() {
    setIsCompanyRequestModalOpen(false)
    setCompanyRequestForm(initialCompanyRequestForm)
  }

  function handleCompanyRequestChange(event) {
    const { name, value } = event.target

    setCompanyRequestForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  async function handleSubmitCompanyRequest(event) {
    event.preventDefault()
    setIsSubmittingCompanyRequest(true)
    setError('')

    try {
      await api.createCompanyAdditionRequest({
        property_id: Number(managerWizard.property_id),
        ...companyRequestForm,
      })

      closeCompanyRequestModal()
    } catch (requestError) {
      setError(t(requestError.message))
    } finally {
      setIsSubmittingCompanyRequest(false)
    }
  }



  function validateManagerStep(step = managerStep) {
    if (step === 1) {
      if (!managerWizard.property_id) {
        setError(t('Bitte wählen Sie eine Liegenschaft aus.'))
        return false
      }

      if (managerAvailableObjects.length > 0 && managerWizard.selected_object_ids.length === 0) {
        setError(t('Bitte wählen Sie mindestens ein Objekt aus.'))
        return false
      }
    }

    if (step === 2 && !managerWizard.flow_type) {
      setError(t('Bitte wählen Sie zwischen Besichtigung und Auftragserteilung.'))
      return false
    }

    if (step === 3) {
      if (!managerWizard.service_type) {
        setError(t('Bitte wählen Sie ein Gewerk aus.'))
        return false
      }

      if (!managerWizard.title.trim()) {
        setError(t('Bitte geben Sie eine Kurzbeschreibung ein.'))
        return false
      }

      if (managerWizard.flow_type === 'inspection') {
        if (!managerWizard.inspection_date_1) {
          setError(t('Bitte geben Sie das Besichtigungsdatum 1 an.'))
          return false
        }

        if (!managerWizard.inspection_time_1) {
          setError(t('Bitte geben Sie die Uhrzeit für Besichtigung 1 an.'))
          return false
        }

        if (!managerWizard.inspection_quote_due_date_1) {
          setError(t('Bitte geben Sie an, bis wann die Offerte für den ersten Termin erstellt werden soll.'))
          return false
        }

        if (managerWizard.inspection_quote_due_date_1 < managerWizard.inspection_date_1) {
          setError(t('Die Offertfrist für den ersten Termin darf nicht vor dem Besichtigungsdatum liegen.'))
          return false
        }

        if (managerWizard.has_second_inspection_option && !managerWizard.inspection_date_2) {
          setError(t('Bitte geben Sie das Besichtigungsdatum 2 an.'))
          return false
        }

        if (managerWizard.has_second_inspection_option && !managerWizard.inspection_time_2) {
          setError(t('Bitte geben Sie die Uhrzeit für Besichtigung 2 an.'))
          return false
        }

        if (managerWizard.has_second_inspection_option && !managerWizard.inspection_quote_due_date_2) {
          setError(t('Bitte geben Sie an, bis wann die Offerte für den zweiten Termin erstellt werden soll.'))
          return false
        }

        if (managerWizard.has_second_inspection_option && managerWizard.inspection_quote_due_date_2 < managerWizard.inspection_date_2) {
          setError(t('Die Offertfrist für den zweiten Termin darf nicht vor dem Besichtigungsdatum liegen.'))
          return false
        }

        if (isPastDate(managerWizard.inspection_date_1) || isPastDate(managerWizard.inspection_date_2)) {
          setError(t('Bitte wählen Sie kein Datum in der Vergangenheit.'))
          return false
        }

        if (
          isPastDateTime(managerWizard.inspection_date_1, managerWizard.inspection_time_1)
          || (managerWizard.has_second_inspection_option
            && isPastDateTime(managerWizard.inspection_date_2, managerWizard.inspection_time_2))
        ) {
          setError(t('Bitte wählen Sie eine Uhrzeit in der Zukunft.'))
          return false
        }

        if (!managerWizard.onsite_first_name.trim() || !managerWizard.onsite_last_name.trim()) {
          setError(t('Bitte hinterlegen Sie eine Kontaktperson vor Ort.'))
          return false
        }

        if (!managerWizard.onsite_phone.trim() || !managerWizard.onsite_email.trim()) {
          setError(t('Bitte hinterlegen Sie Telefon und E-Mail der Kontaktperson.'))
          return false
        }
      }

      if (managerWizard.flow_type === 'direct_order' && managerWizard.completion_mode === 'fixed_date' && !managerWizard.due_date) {
        setError(t('Bitte geben Sie ein gewünschtes Ausführungsdatum an.'))
        return false
      }

      if (managerWizard.flow_type === 'direct_order' && managerWizard.completion_mode === 'fixed_date' && isPastDate(managerWizard.due_date)) {
        setError(t('Bitte wählen Sie kein Datum in der Vergangenheit.'))
        return false
      }

      if (managerWizard.flow_type === 'direct_order' && managerWizard.invoice_recipient_type === 'third_party') {
        if (!managerWizard.invoice_first_name.trim() || !managerWizard.invoice_last_name.trim()) {
          setError(t('Bitte hinterlegen Sie Vor- und Nachnamen für den Rechnungsempfänger.'))
          return false
        }

        if (!managerWizard.invoice_address.trim() || !managerWizard.invoice_postal_code.trim() || !managerWizard.invoice_city.trim()) {
          setError(t('Bitte hinterlegen Sie Adresse, PLZ und Ort für den Rechnungsempfänger.'))
          return false
        }

        if (managerWizard.invoice_delivery_method === 'email') {
          if (!managerWizard.invoice_email.trim()) {
            setError(t('Bitte geben Sie die E-Mail-Adresse für den Rechnungsversand ein.'))
            return false
          }

          const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

          if (!emailPattern.test(managerWizard.invoice_email.trim())) {
            setError(t('Bitte geben Sie eine gültige Rechnungs-E-Mail-Adresse ein.'))
            return false
          }
        }
      }
    }

    if (step === 4) {
      if (managerWizard.flow_type === 'inspection' && !managerWizard.inspection_request_mode) {
        setError(t('Bitte wählen Sie direkte Besichtigungsanfrage oder öffentliche Ausschreibung.'))
        return false
      }

      if (managerWizard.flow_type === 'inspection') {
        const providerLimit = Number(managerWizard.inspection_provider_limit || managerWizard.public_provider_limit || 0)

        if (providerLimit < 1 || providerLimit > 10) {
          setError(t('Bitte wählen Sie eine Anzahl Dienstleister zwischen 1 und 10.'))
          return false
        }
      }

      if (managerWizard.flow_type === 'direct_order' && managerWizard.selected_provider_ids.length > 0) {
        setManagerWizard((current) => ({ ...current, selected_provider_ids: [] }))
      }

      if (
        managerWizard.flow_type === 'inspection'
        && managerWizard.inspection_request_mode === 'public'
        && Number(managerWizard.public_provider_limit || managerWizard.inspection_provider_limit || 0) < 1
      ) {
        setError(t('Bitte geben Sie an, wie viele Dienstleister sich maximal anmelden dürfen.'))
        return false
      }

      if (managerWizard.flow_type === 'direct_order') {
        if (!managerWizard.bid_deadline_at) {
          setError(t('Bitte geben Sie eine Angebotsfrist an.'))
          return false
        }

        if (managerWizard.bid_deadline_at <= TODAY_DATE) {
          setError(t('Bitte wählen Sie eine Angebotsfrist nach heute.'))
          return false
        }

        if (isWeekendDate(managerWizard.bid_deadline_at)) {
          setError(t('Bitte wählen Sie für die Angebotsfrist keinen Samstag oder Sonntag.'))
          return false
        }

        if (managerWizard.quote_item_source !== 'provider') {
          const quoteItems = managerWizard.quote_items ?? []
          const hasQuoteItems = quoteItems.length > 0
          const hasInvalidQuoteItem = quoteItems.some((item) => (
            !String(item.category || '').trim()
            || !String(item.label || '').trim()
            || !String(item.unit || '').trim()
            || lineItemQuantity(item) <= 0
          ))

          if (!hasQuoteItems || hasInvalidQuoteItem) {
            setError(t('Bitte erfassen Sie für jede Position Kategorie, Service, Einheit und Menge.'))
            return false
          }
        }
      }
    }

    if (step === 5) {
      const requiresProviderSelection = managerWizard.flow_type === 'inspection' && managerWizard.inspection_request_mode === 'direct'
      const requiredProviderCount = Math.min(10, Math.max(1, Number(managerWizard.inspection_provider_limit || 1)))

      const normalizedSelectedProviderIds = (managerWizard.selected_provider_ids ?? []).filter(Boolean)

      if (requiresProviderSelection && normalizedSelectedProviderIds.length !== requiredProviderCount) {
        setError(t(`Bitte wählen Sie genau ${requiredProviderCount} Firmen aus der Liste aus.`))
        return false
      }
    }

    setError('')
    return true
  }

  function handleManagerNextStep() {
    if (!validateManagerStep()) {
      return
    }

    // In generate-from-inspection mode the flow ends at step 4 (enter deadline → post).
    setManagerStep((current) => Math.min(current + 1, generateLock ? 4 : 5))
  }





  async function handleSubmitDuplicateExplanation() {
    if (!duplicatePrompt || duplicateExplanation.trim().length < 5) {
      return
    }

    setIsSavingDuplicate(true)

    try {
      const best = duplicatePrompt.matches[0]

      await api.explainOrderDuplicate(duplicatePrompt.order.id, {
        duplicate_of_order_id: best.order_id,
        similarity: best.similarity,
        reason: best.reason,
        explanation: duplicateExplanation.trim(),
      })

      setDuplicatePrompt(null)
      setDuplicateExplanation('')
    } catch (explainError) {
      setError(t(explainError.message))
    } finally {
      setIsSavingDuplicate(false)
    }
  }




  async function handleSubmit(event) {
    event.preventDefault()

    if (isManagerOrderFlow) {
      if (managerStep < 5) {
        handleManagerNextStep()
      }

      return
    }

    setIsSaving(true)
    setError('')

    if (!form.property_id) {
      setError(t('Bitte wählen Sie eine Immobilie aus.'))
      setIsSaving(false)
      return
    }

    if (!form.title.trim()) {
      setError(t('Ein Auftragstitel ist erforderlich.'))
      setIsSaving(false)
      return
    }

    if (!form.service_type) {
      setError(t('Bitte wählen Sie einen Auftragstyp aus.'))
      setIsSaving(false)
      return
    }

    if (availableObjects.length > 0 && !form.property_object_id) {
      setError(t('Bitte wählen Sie ein Immobilienobjekt für diesen Auftrag aus.'))
      setIsSaving(false)
      return
    }

    if (!isManager && form.requester_email.trim()) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

      if (!emailPattern.test(form.requester_email.trim())) {
        setError(t('Bitte geben Sie eine gültige E-Mail-Adresse des Anfragenden ein.'))
        setIsSaving(false)
        return
      }
    }

    if (isPastDate(form.due_date)) {
      setError(t('Bitte wählen Sie kein Datum in der Vergangenheit.'))
      setIsSaving(false)
      return
    }

    try {
      const payload = {
        ...form,
        property_id: Number(form.property_id),
        property_object_id: form.property_object_id ? Number(form.property_object_id) : null,
        requester_name: form.requester_name || null,
        requester_email: form.requester_email || null,
        service_type: normalizeServiceTypeForApi(form.service_type),
        trade_object: form.trade_object || null,
        trade_activity: form.trade_activity || null,
        description: form.description || null,
        due_date: form.due_date || null,
        workflow_meta: {
          detail_catalog: {
            trade_group: form.service_type || null,
            trade_object: form.trade_object || null,
            trade_activity: form.trade_activity || null,
          },
        },
      }

      if (editingOrderId) {
        const response = await api.updateOrder(editingOrderId, payload)
        setOrders((current) => current.map((order) => (
          order.id === editingOrderId ? response.data : order
        )))
      } else {
        const response = await api.createOrder(payload)
        setOrders((current) => [response.data, ...current])
      }

      handleCloseModal()
    } catch (saveError) {
      setError(t(saveError.message))
    } finally {
      setIsSaving(false)
    }
  }

  function handleCloseModal() {
    setEditingOrderId(null)
    setIsCompanyRequestModalOpen(false)
    setCompanyRequestForm(initialCompanyRequestForm)
    setForm({
      ...initialForm,
      property_id: defaultManagerPropertyId,
    })
    setManagerWizard(getInitialManagerWizard(defaultManagerPropertyId))
    setManagerStep(1)
    setGenerateLock(false)
    setError('')
    setIsModalOpen(false)
  }

  async function handleDelete(orderId) {
    const shouldDelete = await confirmDelete('order')

    if (!shouldDelete) {
      return
    }

    try {
      await api.deleteOrder(orderId)
      setOrders((current) => current.filter((order) => order.id !== orderId))
      showDeleteSuccess('order')

      if (editingOrderId === orderId) {
        handleCloseModal()
      }
    } catch (deleteError) {
      setError(t(deleteError.message))
    }
  }

  async function handleRestore(orderId) {
    setRestoringOrderId(orderId)
    setError('')

    try {
      const response = await api.restoreOrder(orderId)
      setDeletedOrders((current) => current.filter((order) => order.id !== orderId))
      setOrders((current) => [response.data, ...current])
    } catch (restoreError) {
      setError(t(restoreError.message))
    } finally {
      setRestoringOrderId(null)
    }
  }

  const filteredOrders = orders.filter((order) => {
    const searchValue = [
      order.title,
      getOptionLabel(JOB_TYPE_OPTIONS, order.service_type),
      order.requester_name,
      order.requester_email,
      order.property?.li_number,
      order.property?.title,
      order.property_object?.name,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    const searchMatch = !filters.search || searchValue.includes(filters.search.toLowerCase())
    const statusMatch = !filters.status || String(order.status || '').toLowerCase() === filters.status.toLowerCase()

    return searchMatch && statusMatch
  })

  // Finished work moves out of the working list into its own section. A site
  // inspection that a tender was raised from is completed automatically, so it
  // lands here without the manager having to do anything.
  // "As soon as possible" is a real answer to the deadline question, so it is
  // shown as such instead of leaving the column empty.
  const getDueDateLabel = (order) => {
    if (order?.due_date) {
      return formatDateDisplay(order.due_date)
    }

    return order?.workflow_meta?.assignment?.completion_mode === 'asap'
      ? t('So schnell wie möglich')
      : '-'
  }

  const isCompletedOrder = (order) => ['completed', 'closed'].includes(String(order.status || '').toLowerCase())
  // A cancelled order is neither running nor finished, so it gets its own
  // section rather than sitting in the working list.
  const isCancelledOrder = (order) => String(order.status || '').toLowerCase() === 'cancelled'
    || Boolean(order.cancelled_at)
  const activeOrders = filteredOrders.filter((order) => !isCompletedOrder(order) && !isCancelledOrder(order))
  const completedOrders = filteredOrders.filter((order) => isCompletedOrder(order) && !isCancelledOrder(order))
  const cancelledOrders = filteredOrders.filter(isCancelledOrder)

  return (
    <PageContent
      title={t('Aufträge')}
      subtitle={
        isOwner
          ? t('Überprüfen Sie die vorausgewählten Aufträge und die endgültigen Entscheidungen des Eigentümers für Ihre zugewiesenen Immobilien.')
          : canCreateOrders
            ? t('Erstellen und verwalten Sie Aufträge für Immobilien, bevor Anbieter mit dem Bieten beginnen.')
            : isManager
              ? t('Prüfen Sie alle Aufträge Ihrer zugewiesenen Immobilie und verfolgen Sie den aktuellen Stand.')
              : t('Nur-Lese-Ansicht des Auftragsablaufs auf der gesamten Plattform.')
      }
      breadcrumbs={[
        { label: t('Dashboard'), href: '/dashboard' },
        { label: t('Aufträge') },
      ]}
      variant="orders"
    >
      <div className="row g-3 mb-4 mx-0 vergo-orders-filters vergo-filter-bar vergo-filter-bar-compact">
        <div className="col-xl-6 col-lg-6 col-md-12">
          <div className="vergo-search-input-wrap">
            <i className="ti ti-search vergo-search-input-icon" aria-hidden="true"></i>
            <input
              aria-label={t('Suche')}
              className="form-control"
              name="search"
              value={filters.search}
              onChange={handleFilterChange}
              placeholder={t('Nach Titel, Immobilie, Objekt, Anfragendem oder Auftragstyp suchen')}
            />
          </div>
        </div>

        <div className="col-xl-3 col-lg-3 col-md-12">
          <div className="vergo-select-input-wrap">
            <i className="ti ti-adjustments vergo-select-input-icon" aria-hidden="true"></i>
            <select aria-label={t('Status')} className="form-select" name="status" value={filters.status} onChange={handleFilterChange}>
              <option value="">{t('All Status')}</option>
              <option value="draft">{t('Entwurf')}</option>
              <option value="open">{t('Offen')}</option>
              <option value="in_review">{t('In Prüfung')}</option>
              <option value="awaiting_owner_approval">{t('Warten auf Eigentümerfreigabe')}</option>
              <option value="approved">{t('Genehmigt')}</option>
              <option value="completed">{t('Abgeschlossen')}</option>
            </select>
          </div>
        </div>

        <div className="col-xl-3 col-lg-3 col-md-12">
          <div className="d-flex justify-content-lg-end gap-2 flex-nowrap vergo-action-buttons">
            <button
              type="button"
              className="btn btn-light-primary text-nowrap"
              onClick={() => setFilters({ search: '', status: '' })}
            >
              <i className="ti ti-refresh me-1" aria-hidden="true"></i>
              {t('Zurücksetzen')}
            </button>

            {canCreateOrders ? (
              <Link to="/order-create" className="btn btn-primary text-nowrap">
                <i className="ti ti-plus me-1"></i>
                {t('Auftrag erfassen')}
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-body p-4">
              <div className="vergo-section-head">
                <h5>{t('Aktive Aufträge')}</h5>
                <p>{t('Laufende Aufträge, die sich in Bearbeitung oder Prüfung befinden.')}</p>
              </div>

              {isLoading ? <p className="text-muted mb-0">{t('Aufträge werden geladen...')}</p> : null}
              {!isLoading && error && !canManageOrders ? <div className="alert alert-danger py-2">{error}</div> : null}

              {!isLoading ? (
                <div className="table-responsive rounded-2 mb-0 vergo-table-scroll">
                  <table className="table border-none text-nowrap customize-table mb-0 align-middle">
                    <thead className="text-dark fs-4">
                      <tr>
                        <th><h6 className="fs-4 fw-semibold mb-0">{t('Titel')}</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">{t('Immobilie')}</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">{t('Objekt')}</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">{t('Typ')}</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">{t('Anfragender')}</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">{t('Fälligkeitsdatum (spätestens bis)')}</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">{t('Status')}</h6></th>
                        {showActionColumn ? <th width="170"><h6 className="fs-4 fw-semibold mb-0">{t('Aktion')}</h6></th> : null}
                      </tr>
                    </thead>

                    <tbody>
                      {activeOrders.map((order) => (
                        <tr key={order.id}>
                          <td>
                            <div className="fw-semibold">{order.title}</div>
                            <div className="text-muted">{getOptionLabel(JOB_TYPE_OPTIONS, order.service_type)}</div>
                          </td>

                          <td>
                            <div className="fw-semibold">{order.property?.li_number ?? '-'}</div>
                            <div className="text-muted">{order.property?.title ?? '-'}</div>
                          </td>

                          <td>{getOrderObjectLabel(order)}</td>

                          <td>
                            <span className={`vergo-type-pill${getOrderFlowTypeLabel(order) === 'Besichtigung' ? ' is-inspection' : ''}`}>
                              {t(getOrderFlowTypeLabel(order))}
                            </span>
                          </td>

                          <td>
                            <div>{order.requester_name || '-'}</div>
                            <div className="text-muted">{order.requester_email || '-'}</div>
                          </td>

                          <td>{getDueDateLabel(order)}</td>

                          <td>
                            <span className={getStatusBadgeClass(order.status)}>
                              {t(formatStatusLabel(order.status))}
                            </span>
                          </td>

                          {showActionColumn ? (
                            <td>
                              <div className="table-action-group">
                                <Link
                                  to={`/orders/${order.id}`}
                                  className="table-action-btn table-action-edit"
                                  title={t('Auftragsdetails anzeigen')}
                                >
                                  <i className="ti ti-eye"></i>
                                </Link>

                                {isManager && order.status === 'draft' && String(order.requester_email || '').toLowerCase() === String(user?.email || '').toLowerCase() ? (
                                  <Link
                                    to={`/order-create?edit=${order.id}`}
                                    className="table-action-btn table-action-edit"
                                    title={t('Entwurf bearbeiten')}
                                  >
                                    <i className="ti ti-pencil"></i>
                                  </Link>
                                ) : null}

                                {canDeleteOrders ? (
                                  <>
                                    {canDeleteOrders && String(order.requester_email || '').toLowerCase() === String(user?.email || '').toLowerCase() ? (
                                      <button
                                        type="button"
                                        className="table-action-btn table-action-delete"
                                        onClick={() => handleDelete(order.id)}
                                        title={t('Auftrag löschen')}
                                      >
                                        <i className="ti ti-trash"></i>
                                      </button>
                                    ) : null}
                                  </>
                                ) : null}
                              </div>
                            </td>
                          ) : null}
                        </tr>
                      ))}

                      {activeOrders.length === 0 ? (
                        <tr>
                          <td colSpan={showActionColumn ? 8 : 7} className="text-center text-muted py-4">
                            {t('Keine Aufträge gefunden.')}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-body p-4">
              <div className="mb-3">
                <h5 className="fw-semibold mb-1">{t('Abgeschlossene Aufträge')}</h5>
                <div className="text-muted small">
                  {t('Erledigte Aufträge und Besichtigungen, aus denen bereits ein Auftrag entstanden ist.')}
                </div>
              </div>

              <div className="table-responsive rounded-2 mb-0 vergo-table-scroll">
                <table className="table border text-nowrap customize-table mb-0 align-middle">
                  <thead className="text-dark fs-4">
                    <tr>
                      <th><h6 className="fs-4 fw-semibold mb-0">{t('Titel')}</h6></th>
                      <th><h6 className="fs-4 fw-semibold mb-0">{t('Immobilie')}</h6></th>
                      <th><h6 className="fs-4 fw-semibold mb-0">{t('Objekt')}</h6></th>
                      <th><h6 className="fs-4 fw-semibold mb-0">{t('Typ')}</h6></th>
                      <th><h6 className="fs-4 fw-semibold mb-0">{t('Status')}</h6></th>
                      <th width="90"><h6 className="fs-4 fw-semibold mb-0">{t('Aktion')}</h6></th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedOrders.map((order) => (
                      <tr key={order.id}>
                        <td>
                          <div className="fw-semibold">{order.title}</div>
                          <div className="text-muted">{getOptionLabel(JOB_TYPE_OPTIONS, order.service_type)}</div>
                        </td>
                        <td>
                          <div className="fw-semibold">{order.property?.li_number ?? '-'}</div>
                          <div className="text-muted">{order.property?.title ?? '-'}</div>
                        </td>
                        <td>{getOrderObjectLabel(order)}</td>
                        <td>
                          <span className={`vergo-type-pill${getOrderFlowTypeLabel(order) === 'Besichtigung' ? ' is-inspection' : ''}`}>
                            {t(getOrderFlowTypeLabel(order))}
                          </span>
                        </td>
                        <td>
                          <span className={getStatusBadgeClass(order.status)}>
                            {t(formatStatusLabel(order.status))}
                          </span>
                        </td>
                        <td>
                          <div className="table-action-group">
                            <Link
                              to={`/orders/${order.id}`}
                              className="table-action-btn table-action-view"
                              title={t('Auftrag ansehen')}
                            >
                              <i className="ti ti-eye"></i>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {completedOrders.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center text-muted py-4">
                          {t('Noch keine abgeschlossenen Aufträge vorhanden.')}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-body p-4">
              <div className="mb-3">
                <h5 className="fw-semibold mb-1">{t('Stornierte Aufträge')}</h5>
                <div className="text-muted small">
                  {t('Aufträge, die storniert wurden, mit der jeweils angegebenen Begründung.')}
                </div>
              </div>

              <div className="table-responsive rounded-2 mb-0 vergo-table-scroll">
                <table className="table border text-nowrap customize-table mb-0 align-middle">
                  <thead className="text-dark fs-4">
                    <tr>
                      <th><h6 className="fs-4 fw-semibold mb-0">{t('Titel')}</h6></th>
                      <th><h6 className="fs-4 fw-semibold mb-0">{t('Immobilie')}</h6></th>
                      <th><h6 className="fs-4 fw-semibold mb-0">{t('Objekt')}</h6></th>
                      <th><h6 className="fs-4 fw-semibold mb-0">{t('Typ')}</h6></th>
                      <th><h6 className="fs-4 fw-semibold mb-0">{t('Begründung')}</h6></th>
                      <th width="90"><h6 className="fs-4 fw-semibold mb-0">{t('Aktion')}</h6></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cancelledOrders.map((order) => (
                      <tr key={order.id}>
                        <td>
                          <div className="fw-semibold">{order.title}</div>
                          <div className="text-muted">{getOptionLabel(JOB_TYPE_OPTIONS, order.service_type)}</div>
                        </td>
                        <td>
                          <div className="fw-semibold">{order.property?.li_number ?? '-'}</div>
                          <div className="text-muted">{order.property?.title ?? '-'}</div>
                        </td>
                        <td>{getOrderObjectLabel(order)}</td>
                        <td>
                          <span className={`vergo-type-pill${getOrderFlowTypeLabel(order) === 'Besichtigung' ? ' is-inspection' : ''}`}>
                            {t(getOrderFlowTypeLabel(order))}
                          </span>
                        </td>
                        <td style={{ whiteSpace: 'normal', minWidth: '220px' }}>
                          {order.cancellation_reason || '-'}
                        </td>
                        <td>
                          <div className="table-action-group">
                            <Link
                              to={`/orders/${order.id}`}
                              className="table-action-btn table-action-view"
                              title={t('Auftrag ansehen')}
                            >
                              <i className="ti ti-eye"></i>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {cancelledOrders.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center text-muted py-4">
                          {t('Keine stornierten Aufträge vorhanden.')}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {canSeeDeletedOrders ? (
        <div className="row">
          <div className="col-12">
            <div className="card">
              <div className="card-body p-4">
                <div className="d-flex align-items-center justify-content-between gap-3 mb-3">
                  <div>
                    <h5 className="fw-semibold mb-1">{t('Gelöschte Aufträge')}</h5>
                    <div className="text-muted small">
                      {canRecoverOrders
                        ? t('Gelöschte Aufträge werden hier wiederhergestellt, ohne ein Datenbank-Backup einzuspielen.')
                        : t('Aufträge, die auf Ihren Liegenschaften gelöscht wurden.')}
                    </div>
                  </div>
                  <button type="button" className="btn btn-light-primary btn-sm" onClick={loadDeletedOrders} disabled={isLoadingDeletedOrders}>
                    <i className="ti ti-refresh me-1"></i>
                    {t('Aktualisieren')}
                  </button>
                </div>

                {isLoadingDeletedOrders ? <p className="text-muted mb-0">{t('Gelöschte Aufträge werden geladen...')}</p> : null}

                {!isLoadingDeletedOrders ? (
                  <div className="table-responsive rounded-2 mb-0 vergo-table-scroll">
                    <table className="table border-none text-nowrap customize-table mb-0 align-middle">
                      <thead className="text-dark fs-4">
                        <tr>
                          <th><h6 className="fs-4 fw-semibold mb-0">{t('Titel')}</h6></th>
                          <th><h6 className="fs-4 fw-semibold mb-0">{t('Immobilie')}</h6></th>
                          <th><h6 className="fs-4 fw-semibold mb-0">{t('Anfragender')}</h6></th>
                          <th><h6 className="fs-4 fw-semibold mb-0">{t('Gelöscht am')}</h6></th>
                          <th width="120"><h6 className="fs-4 fw-semibold mb-0">{t('Aktion')}</h6></th>
                        </tr>
                      </thead>
                      <tbody>
                        {deletedOrders.map((order) => (
                          <tr key={order.id}>
                            <td>
                              <div className="fw-semibold">{order.title}</div>
                              <div className="text-muted">{getOptionLabel(JOB_TYPE_OPTIONS, order.service_type)}</div>
                            </td>
                            <td>
                              <div className="fw-semibold">{order.property?.li_number ?? '-'}</div>
                              <div className="text-muted">{order.property?.title ?? '-'}</div>
                            </td>
                            <td>
                              <div>{order.requester_name || '-'}</div>
                              <div className="text-muted">{order.requester_email || '-'}</div>
                            </td>
                            <td>{formatDateTimeDisplay(order.deleted_at)}</td>
                            <td>
                              {canRecoverOrders ? (
                                <button
                                  type="button"
                                  className="btn btn-light-primary btn-sm"
                                  disabled={restoringOrderId === order.id}
                                  onClick={() => handleRestore(order.id)}
                                >
                                  {restoringOrderId === order.id ? t('Wird wiederhergestellt...') : t('Wiederherstellen')}
                                </button>
                              ) : (
                                <span className="text-muted">-</span>
                              )}
                            </td>
                          </tr>
                        ))}

                        {deletedOrders.length === 0 ? (
                          <tr>
                            <td colSpan="5" className="text-center text-muted py-4">
                              {t('Keine gelöschten Aufträge vorhanden.')}
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {canManageOrders ? (
        <>
          {/* The manager wizard takes over the whole page - the client asked for
              order entry to run page by page rather than in a pop-up. Every
              other order form stays the small modal it was. */}
          <div
            className={isManagerOrderFlow
              ? `vergo-wizard-page${isModalOpen ? ' is-open' : ''}`
              : `modal fade ${isModalOpen ? 'show' : ''}`}
            style={isManagerOrderFlow ? undefined : { display: isModalOpen ? 'block' : 'none' }}
            tabIndex="-1"
            aria-hidden={!isModalOpen}
          >
            <div className={isManagerOrderFlow ? 'vergo-wizard-shell' : 'modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg'}>
              <div className={isManagerOrderFlow ? 'vergo-wizard-inner' : 'modal-content rounded-1'}>
                {isManagerOrderFlow ? (
                  <div className="vergo-wizard-head">
                    <button type="button" className="vergo-wizard-back" onClick={handleCloseModal}>
                      <i className="ti ti-arrow-left"></i>
                      <span>{t('Zurück zur Übersicht')}</span>
                    </button>
                    <h1>{editingOrderId ? t('Auftrag bearbeiten') : t('Auftrag erfassen')}</h1>
                    <p>{t('Schritt')} {managerStep} {t('von')} {MANAGER_ORDER_STEPS.length}</p>
                  </div>
                ) : (
                  <div className="modal-header border-bottom">
                    <div>
                      <h5 className="modal-title mb-1">
                        {editingOrderId ? t('Auftrag bearbeiten') : t('Auftrag erstellen')}
                      </h5>
                    </div>
                    <button type="button" className="btn-close" aria-label={t('Schließen')} onClick={handleCloseModal}></button>
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  <div className={isManagerOrderFlow ? 'vergo-wizard-body' : 'modal-body'}>
                    <div className="row">
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">{t('Immobilie')}</label>
                          <select
                            className="form-select"
                            name="property_id"
                            value={form.property_id}
                            onChange={handleChange}
                            disabled={isManager}
                          >
                            <option value="">{t('Immobilie auswählen')}</option>
                            {(isManager ? managerPropertyOptions : properties).map((property) => (
                              <option key={property.id} value={property.id}>
                                {property.li_number ?? property.id} - {property.title ?? property.name ?? ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">{t('Immobilienobjekt')}</label>
                          <select
                            className="form-select"
                            name="property_object_id"
                            value={form.property_object_id}
                            onChange={handleChange}
                          >
                            <option value="">{t('Objekt auswählen')}</option>
                            {availableObjects.map((object) => (
                              <option key={object.id} value={object.id}>
                                {object.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">{t('Auftragstitel')}</label>
                          <input className="form-control" name="title" value={form.title} onChange={handleChange} />
                        </div>
                      </div>

                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">{t('Auftragstyp')}</label>
                          <select className="form-select" name="service_type" value={form.service_type} onChange={handleChange}>
                            <option value="">{t('Auftragstyp auswählen')}</option>
                            {JOB_TYPE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {t(option.label)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">{t('Objekt / Bauteil')}</label>
                          <select className="form-select" name="trade_object" value={form.trade_object} onChange={handleChange} disabled={!form.service_type}>
                            <option value="">{t('Objekt / Bauteil auswählen')}</option>
                            {availableTradeObjects.map((option) => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">{t('Tätigkeit')}</label>
                          <select className="form-select" name="trade_activity" value={form.trade_activity} onChange={handleChange} disabled={!form.service_type}>
                            <option value="">{t('Tätigkeit auswählen')}</option>
                            {availableTradeActivities.map((option) => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">{t('Fälligkeitsdatum (spätestens bis)')}</label>
                          <input type="date" className="form-control" name="due_date" value={form.due_date} min={TODAY_DATE} onChange={handleChange} />
                        </div>
                      </div>

                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">{t('Status')}</label>
                          <input className="form-control" value={t(formatStatusLabel(form.status || 'open'))} readOnly />
                        </div>
                      </div>

                      <div className="col-12">
                        <div className="mb-0">
                          <label className="form-label">{t('Beschreibung')}</label>
                          <textarea className="form-control" rows="4" name="description" value={form.description} onChange={handleChange}></textarea>
                        </div>
                      </div>
                    </div>

                    {error ? <div className="alert alert-danger py-2 mt-3 mb-0">{error}</div> : null}
                  </div>

                  <div className={isManagerOrderFlow ? 'vergo-wizard-footer' : 'modal-footer'}>
                      <button type="button" className="btn btn-light" onClick={handleCloseModal}>
                        {t('Abbrechen')}
                      </button>
                      <button type="submit" className="btn btn-primary" disabled={isSaving}>
                        {isSaving ? t('Wird gespeichert...') : editingOrderId ? t('Auftrag aktualisieren') : t('Auftrag erstellen')}
                      </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
          {isCompanyRequestModalOpen ? (
            <div
              className="modal fade show"
              style={{ display: 'block' }}
              tabIndex="-1"
              aria-hidden="false"
            >
              <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content rounded-1">
                  <div className="modal-header border-bottom">
                    <h5 className="modal-title">{t('Erfassung anfragen')}</h5>
                    <button type="button" className="btn-close" aria-label={t('Schließen')} onClick={closeCompanyRequestModal}></button>
                  </div>

                  <form onSubmit={handleSubmitCompanyRequest}>
                    <div className="modal-body">
                      <div className="row g-3">
                        <div className="col-12">
                          <label className="form-label">{t('Firmenname')}</label>
                          <input className="form-control" name="company_name" value={companyRequestForm.company_name} onChange={handleCompanyRequestChange} required />
                        </div>
                        <div className="col-12">
                          <label className="form-label">{t('Kontaktperson')}</label>
                          <input className="form-control" name="contact_name" value={companyRequestForm.contact_name} onChange={handleCompanyRequestChange} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">{t('E-Mail')}</label>
                          <input type="email" className="form-control" name="email" value={companyRequestForm.email} onChange={handleCompanyRequestChange} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">{t('Telefon')}</label>
                          <input className="form-control" name="phone" value={companyRequestForm.phone} onChange={handleCompanyRequestChange} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">{t('Kanton')}</label>
                          <select className="form-select" name="canton" value={companyRequestForm.canton} onChange={handleCompanyRequestChange}>
                            <option value="">{t('Alle Kantone')}</option>
                            {SWISS_CANTONS.map((canton) => (
                              <option key={canton.value} value={canton.value}>{canton.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">{t('Ort')}</label>
                          <input className="form-control" name="city" value={companyRequestForm.city} onChange={handleCompanyRequestChange} />
                        </div>
                        <div className="col-12">
                          <label className="form-label">{t('Notizen')}</label>
                          <textarea className="form-control" rows="4" name="notes" value={companyRequestForm.notes} onChange={handleCompanyRequestChange}></textarea>
                        </div>
                      </div>
                    </div>

                    <div className="modal-footer">
                      <button type="button" className="btn btn-light" onClick={closeCompanyRequestModal}>
                        {t('Abbrechen')}
                      </button>
                      <button type="submit" className="btn btn-primary" disabled={isSubmittingCompanyRequest}>
                        {isSubmittingCompanyRequest ? t('Wird gespeichert...') : t('Anfrage senden')}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          ) : null}
          {/* The manager wizard is a page, not a dialog, so it gets no backdrop. */}
          {isModalOpen && !isManagerOrderFlow ? <div className="modal-backdrop fade show"></div> : null}
          {isCompanyRequestModalOpen ? <div className="modal-backdrop fade show"></div> : null}
        </>
      ) : null}

      {duplicatePrompt ? (
        <div className="modal fade show d-block" tabIndex="-1" role="dialog" style={{ background: 'rgba(15, 23, 42, 0.45)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <div>
                  <h5 className="modal-title">{t('Möglicher doppelter Auftrag')}</h5>
                  <p className="text-muted small mb-0">
                    {t('Für diese Liegenschaft existiert bereits ein sehr ähnlicher Auftrag. Bitte begründen Sie, warum ein separater Auftrag nötig ist.')}
                  </p>
                </div>
              </div>
              <div className="modal-body">
                {duplicatePrompt.matches.map((match) => (
                  <div key={match.order_id} className="border rounded-3 p-3 mb-2">
                    <div className="d-flex justify-content-between gap-2 flex-wrap">
                      <div>
                        <div className="fw-semibold">{match.order_number} · {match.title}</div>
                        <div className="text-muted small">
                          {t(match.reason === 'cancelled_recreated' ? 'Nach Absage neu erstellt' : 'Ähnlicher laufender Auftrag')}
                          {match.cancellation_reason ? ` · ${match.cancellation_reason}` : ''}
                        </div>
                      </div>
                      <span className="badge bg-light-warning text-warning rounded-pill px-3 py-2 align-self-start">
                        {Math.round(match.similarity * 100)}% {t('Ähnlichkeit')}
                      </span>
                    </div>
                  </div>
                ))}

                <label className="form-label mt-2">{t('Begründung')} *</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={duplicateExplanation}
                  placeholder={t('Warum wurde dies nicht in einem Auftrag zusammengefasst?')}
                  onChange={(event) => setDuplicateExplanation(event.target.value)}
                ></textarea>
                <div className="form-text">
                  {t('Der Eigentümer kann diese Begründung einsehen.')}
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={isSavingDuplicate || duplicateExplanation.trim().length < 5}
                  onClick={handleSubmitDuplicateExplanation}
                >
                  {isSavingDuplicate ? t('Wird gespeichert...') : t('Begründung speichern')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </PageContent>
  )
}

export default OrdersPage
