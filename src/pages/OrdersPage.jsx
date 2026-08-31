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
import {
  ADD_SERVICE_OPTION_VALUE,
  createQuoteLineItem,
  getTradeActivityOptions,
  getTradeUnitOptions,
  getOptionLabel,
  JOB_TYPE_OPTIONS,
  TRADE_ACTIVITY_OPTIONS_BY_GROUP,
  TRADE_OBJECT_OPTIONS_BY_GROUP,
  normalizeServiceTypeForApi,
} from '../lib/vergoOptions'

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

function getQuoteDeadlineWarning(value) {
  if (!value) {
    return ''
  }

  if (isWeekendDate(value)) {
    return 'Bitte wählen Sie für die Angebotsfrist keinen Samstag oder Sonntag.'
  }

  if (value === TOMORROW_DATE) {
    return 'Die Angebotsfrist ist möglicherweise zu kurz. Wir empfehlen, die Frist zu verlängern.'
  }

  return ''
}

const MANAGER_ORDER_STEPS = [
  { id: 1, label: 'Liegenschaft', helper: 'Objekte wählen', icon: 'ti ti-building-estate' },
  { id: 2, label: 'Ablauf', helper: 'Besichtigung oder Auftrag', icon: 'ti ti-git-branch' },
  { id: 3, label: 'Details', helper: 'Gewerk und Angaben', icon: 'ti ti-file-description' },
  { id: 4, label: 'Vergabe', helper: 'Anfrageart festlegen', icon: 'ti ti-badge-ad' },
  { id: 5, label: 'Firmen', helper: 'Anbieter auswählen', icon: 'ti ti-users' },
]

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

function getPropertyObjectLabel(object) {
  return object?.address || object?.name || `Objekt ${object?.id ?? ''}`.trim()
}

function getOrderObjectLabel(order) {
  const objectCount = order?.property_object_ids?.length ?? 0

  if (objectCount > 1) {
    const leadLabel = order?.property_object?.address || order?.property_object?.name || '-'
    return `${leadLabel} +${objectCount - 1}`
  }

  return order?.property_object?.name || '-'
}

function getQuoteServiceOptions(serviceType) {
  return getTradeActivityOptions(serviceType)
}

function serializeManagerWizardDraft(wizard, currentStep, providerCantonFilter) {
  return {
    ...wizard,
    attachment: null,
    current_step: currentStep,
    provider_canton_filter: providerCantonFilter,
  }
}

function isWeekendDate(value) {
  if (!value) {
    return false
  }

  const date = new Date(`${value}T00:00:00`)
  const day = date.getDay()

  return day === 0 || day === 6
}

function isOutsideBusinessHours(value) {
  return Boolean(value && (value < '05:00' || value > '19:00'))
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


function getOrderFlowTypeLabel(order) {
  const isInspection = order?.workflow_type === 'inspection'
    || order?.workflow_meta?.flow_type === 'inspection'
    || (order?.workflow_meta?.inspection?.preferred_slots ?? []).length > 0
    || ['inspection_requested', 'public_inspection_open', 'inspection_signup_closed', 'inspection_company_selected'].includes(order?.workflow_status)

  return isInspection ? 'Besichtigung' : 'Auftrag'
}

function buildManagerWorkflowMeta(wizard, selectedObjects) {
  return {
    flow_type: wizard.flow_type,
    detail_catalog: {
      trade_group: wizard.service_type || null,
      trade_object: null,
      trade_activity: null,
    },
    property_object_ids: selectedObjects.map((object) => object.id),
    property_objects: selectedObjects.map((object) => ({
      id: object.id,
      label: getPropertyObjectLabel(object),
      postal_code: object.postal_code || null,
      city: object.city || null,
    })),
    inspection: wizard.flow_type === 'inspection'
      ? {
        preferred_slots: [
          wizard.inspection_date_1 || wizard.inspection_time_1 || wizard.inspection_quote_due_date_1
            ? {
              date: wizard.inspection_date_1 || null,
              time: wizard.inspection_time_1 || null,
              quote_due_date: wizard.inspection_quote_due_date_1 || null,
            }
            : null,
          wizard.has_second_inspection_option && (wizard.inspection_date_2 || wizard.inspection_time_2 || wizard.inspection_quote_due_date_2)
            ? {
              date: wizard.inspection_date_2 || null,
              time: wizard.inspection_time_2 || null,
              quote_due_date: wizard.inspection_quote_due_date_2 || null,
            }
            : null,
        ].filter(Boolean),
        onsite_contact: {
          company: wizard.onsite_company || null,
          first_name: wizard.onsite_first_name || null,
          last_name: wizard.onsite_last_name || null,
          phone: wizard.onsite_phone || null,
          email: wizard.onsite_email || null,
        },
        request_mode: wizard.inspection_request_mode || null,
        provider_limit: Math.min(10, Math.max(1, Number(wizard.inspection_provider_limit || wizard.public_provider_limit || 3))),
        public_provider_limit: wizard.inspection_request_mode === 'public'
          ? Math.min(10, Math.max(1, Number(wizard.public_provider_limit || wizard.inspection_provider_limit || 3)))
          : null,
      }
      : null,
    assignment: wizard.flow_type === 'direct_order'
      ? {
        completion_mode: wizard.completion_mode,
        award_mode: 'request_quotes',
        quote_item_source: wizard.quote_item_source || 'manager',
        source_inspection_order_id: wizard.source_inspection_order_id || null,
        source_inspection_quote_bid_ids: wizard.source_inspection_quote_bid_ids ?? [],
        cost_estimate_range: null,
        bid_priority: null,
        bid_deadline_at: wizard.bid_deadline_at || null,
        invoice_recipient: {
          recipient_type: wizard.invoice_recipient_type || 'manager_profile',
          delivery_method: wizard.invoice_recipient_type === 'third_party'
            ? wizard.invoice_delivery_method || 'email'
            : null,
          email: wizard.invoice_recipient_type === 'third_party' && wizard.invoice_delivery_method === 'email'
            ? wizard.invoice_email || null
            : null,
          company_name: wizard.invoice_recipient_type === 'third_party'
            ? wizard.invoice_company_name || null
            : null,
          company_extra: wizard.invoice_recipient_type === 'third_party'
            ? wizard.invoice_company_extra || null
            : null,
          first_name: wizard.invoice_recipient_type === 'third_party'
            ? wizard.invoice_first_name || null
            : null,
          last_name: wizard.invoice_recipient_type === 'third_party'
            ? wizard.invoice_last_name || null
            : null,
          address: wizard.invoice_recipient_type === 'third_party'
            ? wizard.invoice_address || null
            : null,
          postal_code: wizard.invoice_recipient_type === 'third_party'
            ? wizard.invoice_postal_code || null
            : null,
          city: wizard.invoice_recipient_type === 'third_party'
            ? wizard.invoice_city || null
            : null,
        },
      }
      : null,
    provider_selection: {
      selected_provider_ids: wizard.flow_type === 'direct_order'
        ? []
        : wizard.selected_provider_ids
        .filter((id) => id !== null && id !== undefined && id !== '')
        .map((id) => Number(id)),
      manual_provider: null,
    },
  }
}

function OrdersPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [searchParams, setSearchParams] = useSearchParams()
  const [orders, setOrders] = useState([])
  const [deletedOrders, setDeletedOrders] = useState([])
  const [properties, setProperties] = useState([])
  const [objects, setObjects] = useState([])
  const [serviceProviders, setServiceProviders] = useState([])
  const [form, setForm] = useState(initialForm)
  const [managerWizard, setManagerWizard] = useState(getInitialManagerWizard())
  const [managerStep, setManagerStep] = useState(1)
  const [providerCantonFilter, setProviderCantonFilter] = useState('')
  const [isCompanyRequestModalOpen, setIsCompanyRequestModalOpen] = useState(false)
  const [companyRequestForm, setCompanyRequestForm] = useState(initialCompanyRequestForm)
  const [companyRequestSuccess, setCompanyRequestSuccess] = useState('')
  const [isSubmittingCompanyRequest, setIsSubmittingCompanyRequest] = useState(false)
  const [existingAttachmentName, setExistingAttachmentName] = useState('')
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
  const canRecoverOrders = isAdmin || user?.role === 'employee' || canDeleteOrders
  const showActionColumn = isAdmin || canEditOrders || canDeleteOrders
  const isManager = user?.role === 'manager'
  const isOwner = user?.role === 'owner'
  const isManagerOrderFlow = isManager

  async function loadData() {
    setIsLoading(true)
    setError('')

    try {
      const [ordersResponse, propertiesResponse, objectsResponse, serviceProvidersResponse, deletedOrdersResponse] = await Promise.all([
        api.getOrders(),
        api.getProperties(),
        api.getPropertyObjects(),
        api.getServiceProviders(),
        canRecoverOrders ? api.getDeletedOrders() : Promise.resolve({ data: [] }),
      ])

      setOrders(ordersResponse.data ?? [])
      setDeletedOrders(deletedOrdersResponse.data ?? [])
      setProperties(propertiesResponse.data ?? [])
      setObjects(objectsResponse.data ?? [])
      setServiceProviders(serviceProvidersResponse.data ?? [])
    } catch (loadError) {
      setError(t(loadError.message))
    } finally {
      setIsLoading(false)
    }
  }

  async function loadDeletedOrders() {
    if (!canRecoverOrders) {
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
          is_custom: item.is_custom ?? true,
        }))

        setEditingOrderId(null)
        setError('')
        setCompanyRequestSuccess('')
        setExistingAttachmentName('')
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
        setProviderCantonFilter('')
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

  function handleManagerWizardChange(event) {
    const { name, value } = event.target

    setManagerWizard((current) => ({
      ...current,
      [name]: value,
      ...(name === 'property_id' ? { selected_object_ids: [] } : {}),
      ...(name === 'service_type'
        ? {
          trade_object: '',
          trade_activity: '',
        }
        : {}),
      ...(name === 'trade_object'
        ? {
          trade_activity: '',
        }
        : {}),
      // Switching to a public tender drops any company picked earlier, so a
      // stale selection can never be submitted with a public request.
      ...(name === 'inspection_request_mode' && value === 'public'
        ? {
          selected_provider_ids: [],
        }
        : {}),
      ...(name === 'flow_type'
        ? {
          inspection_request_mode: '',
          inspection_provider_limit: '3',
          public_provider_limit: '3',
          inspection_date_1: '',
          inspection_time_1: '',
          inspection_quote_due_date_1: '',
          inspection_date_2: '',
          inspection_time_2: '',
          inspection_quote_due_date_2: '',
          has_second_inspection_option: false,
          attachment: null,
          award_mode: value === 'direct_order' ? 'request_quotes' : '',
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
        : {}),
      ...(name === 'inspection_provider_limit'
        ? {
          selected_provider_ids: current.selected_provider_ids.slice(0, Math.min(10, Math.max(1, Number(value || 1)))),
          public_provider_limit: value,
        }
        : {}),
      ...(name === 'inspection_request_mode' && value === 'public'
        ? {
          selected_provider_ids: [],
        }
        : {}),
      ...(name === 'award_mode' && value === 'request_quotes'
        ? {
          selected_provider_ids: [],
          quote_items: seedQuoteItemsForTrade(current.service_type),
        }
        : {}),
      ...(name === 'quote_item_source' && value === 'provider'
        ? {
          quote_items: [],
        }
        : {}),
      ...(name === 'quote_item_source' && value === 'manager' && (current.quote_items ?? []).length === 0
        ? {
          quote_items: seedQuoteItemsForTrade(current.service_type),
        }
        : {}),
      ...(name === 'invoice_recipient_type' && value === 'manager_profile'
        ? {
          invoice_delivery_method: 'email',
          invoice_email: '',
          invoice_company_name: '',
          invoice_company_extra: '',
          invoice_first_name: '',
          invoice_last_name: '',
          invoice_address: '',
          invoice_postal_code: '',
          invoice_city: '',
        }
        : {}),
      ...(name === 'invoice_delivery_method' && value === 'mail'
        ? {
          invoice_email: '',
        }
        : {}),
      ...(name === 'has_second_inspection_option' && value !== 'true'
        ? {
          inspection_date_2: '',
          inspection_time_2: '',
          inspection_quote_due_date_2: '',
        }
        : {}),
    }))
  }

  function handleManagerWizardFileChange(event) {
    const { name, files } = event.target

    setManagerWizard((current) => ({
      ...current,
      [name]: files?.[0] ?? null,
    }))
  }

  function enableSecondInspectionOption() {
    setManagerWizard((current) => ({
      ...current,
      has_second_inspection_option: true,
    }))
  }

  function removeSecondInspectionOption() {
    setManagerWizard((current) => ({
      ...current,
      has_second_inspection_option: false,
      inspection_date_2: '',
      inspection_time_2: '',
      inspection_quote_due_date_2: '',
    }))
  }

  function seedQuoteItemsForTrade(serviceType) {
    const services = getQuoteServiceOptions(serviceType)

    return [
      createQuoteLineItem(serviceType, {
        id: `${serviceType || 'custom'}-0-${Date.now()}`,
        category: services[0] || '',
        code: services[0] || '',
        label: '',
        quantity: 1,
        source: 'catalog',
        is_custom: false,
      }),
    ]
  }

  function handleManagerServiceTypeChange(value) {
    setManagerWizard((current) => ({
      ...current,
      service_type: value,
      trade_object: '',
      trade_activity: '',
      quote_items: current.award_mode === 'request_quotes'
        ? seedQuoteItemsForTrade(value)
        : current.quote_items,
    }))
  }

  function addQuoteItem() {
    setManagerWizard((current) => ({
      ...current,
      quote_items: [
        ...(current.quote_items ?? []),
        createQuoteLineItem(current.service_type, {
          id: `custom-${Date.now()}`,
          category: '',
          code: '',
          label: '',
          quantity: 1,
          source: 'custom',
          is_custom: true,
        }),
      ],
    }))
  }

  function updateQuoteItem(itemId, field, value) {
    setManagerWizard((current) => ({
      ...current,
      quote_items: (current.quote_items ?? []).map((item) => (
        item.id === itemId
          ? field === 'category'
            ? {
              ...item,
              category: value === ADD_SERVICE_OPTION_VALUE ? '' : value,
              code: value === ADD_SERVICE_OPTION_VALUE ? '' : value,
              is_custom: value === ADD_SERVICE_OPTION_VALUE
                ? true
                : Boolean(value && !getQuoteServiceOptions(current.service_type).includes(value)),
            }
            : {
              ...item,
              [field]: field === 'quantity' ? Number(value || 0) : value,
            }
          : item
      )),
    }))
  }

  function removeQuoteItem(itemId) {
    setManagerWizard((current) => ({
      ...current,
      quote_items: (current.quote_items ?? []).filter((item) => item.id !== itemId),
    }))
  }

  function toggleManagerObjectSelection(objectId) {
    setManagerWizard((current) => {
      const exists = current.selected_object_ids.includes(objectId)

      return {
        ...current,
        selected_object_ids: exists
          ? current.selected_object_ids.filter((id) => id !== objectId)
          : [...current.selected_object_ids, objectId],
      }
    })
  }

  function toggleProviderSelection(providerId) {
    setManagerWizard((current) => {
      const normalizedProviderId = String(providerId)
      const exists = current.selected_provider_ids.includes(normalizedProviderId)

      return {
        ...current,
        selected_provider_ids: exists
          ? current.selected_provider_ids.filter((id) => id !== normalizedProviderId)
          : [...current.selected_provider_ids, normalizedProviderId].slice(
            0,
            current.flow_type === 'inspection' && current.inspection_request_mode === 'direct'
              ? Math.min(10, Math.max(1, Number(current.inspection_provider_limit || 1)))
              : undefined,
          ),
      }
    })
  }

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

  const selectedManagerObjects = useMemo(() => (
    managerAvailableObjects.filter((item) => managerWizard.selected_object_ids.includes(item.id))
  ), [managerAvailableObjects, managerWizard.selected_object_ids])

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
    setCompanyRequestSuccess('')
    setExistingAttachmentName('')
    setForm({
      ...initialForm,
      property_id: defaultManagerPropertyId,
    })
    setManagerWizard(getInitialManagerWizard(defaultManagerPropertyId))
    setManagerStep(1)
    setGenerateLock(false)
    setProviderCantonFilter('')
    setIsModalOpen(true)
  }

  function openCompanyRequestModal() {
    setCompanyRequestForm((current) => ({
      ...initialCompanyRequestForm,
      canton: current.canton || providerCantonFilter || '',
      city: current.city || '',
    }))
    setIsCompanyRequestModalOpen(true)
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

      setCompanyRequestSuccess(t('Ihre Firmenanfrage wurde an das Vergo-Team gesendet.'))
      closeCompanyRequestModal()
    } catch (requestError) {
      setError(t(requestError.message))
    } finally {
      setIsSubmittingCompanyRequest(false)
    }
  }

  function hydrateManagerWizardFromDraft(order) {
    const draftState = order?.workflow_meta?.manager_wizard_draft ?? {}
    const baseWizard = getInitialManagerWizard(String(order?.property_id ?? defaultManagerPropertyId ?? properties[0]?.id ?? ''))
    const selectedObjectIds = Array.isArray(draftState.selected_object_ids)
      ? draftState.selected_object_ids
      : (order?.property_object_ids ?? []).map((id) => Number(id))
    const draftTradeGroup = draftState.service_type || order?.workflow_meta?.detail_catalog?.trade_group || order?.service_type || baseWizard.service_type
    const draftQuoteItems = Array.isArray(draftState.quote_items)
      ? draftState.quote_items.map((item, index) => createQuoteLineItem(draftTradeGroup, {
        ...item,
        id: item.id || `draft-${index}`,
        category: item.category ?? item.code ?? '',
      }))
      : baseWizard.quote_items

    setManagerWizard({
      ...baseWizard,
      ...draftState,
      property_id: String(draftState.property_id ?? order?.property_id ?? baseWizard.property_id),
      selected_object_ids: selectedObjectIds,
      selected_provider_ids: (draftState.selected_provider_ids ?? []).map((id) => String(id)),
      quote_items: draftQuoteItems,
      attachment: null,
    })
    setManagerStep(Number(draftState.current_step) || 1)
    setProviderCantonFilter(draftState.provider_canton_filter || '')
    setExistingAttachmentName(order?.attachment_name || '')
  }

  function openEditModal(order) {
    setEditingOrderId(order.id)
    setError('')
    setCompanyRequestSuccess('')
    setForm({
      ...initialForm,
      property_id: String(order.property_id ?? ''),
      property_object_id: String(order.property_object_id ?? ''),
      requester_name: order.requester_name ?? '',
      requester_email: order.requester_email ?? '',
      title: order.title ?? '',
      service_type: order.service_type ?? '',
      description: order.description ?? '',
      status: order.status ?? 'open',
      due_date: order.due_date ?? '',
    })
    hydrateManagerWizardFromDraft(order)
    setGenerateLock(false)
    setIsModalOpen(true)
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
            || Number(item.quantity || 0) <= 0
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

  function handleManagerPreviousStep() {
    setError('')
    setManagerStep((current) => Math.max(current - 1, 1))
  }

  function buildManagerOrderPayload(saveAsDraft = false) {
    const workflowMeta = {
      ...buildManagerWorkflowMeta(managerWizard, selectedManagerObjects),
      manager_wizard_draft: serializeManagerWizardDraft(managerWizard, managerStep, providerCantonFilter),
    }

    return {
      property_id: Number(managerWizard.property_id),
      property_object_id: managerWizard.selected_object_ids[0] ? Number(managerWizard.selected_object_ids[0]) : null,
      property_object_ids: managerWizard.selected_object_ids.map((id) => Number(id)),
      title: managerWizard.title.trim() || null,
      service_type: managerWizard.service_type ? normalizeServiceTypeForApi(managerWizard.service_type) : null,
      description: managerWizard.description.trim() || null,
      status: saveAsDraft ? 'draft' : 'open',
      workflow_type: managerWizard.flow_type || null,
      workflow_status: saveAsDraft
        ? 'draft'
        : (managerWizard.flow_type === 'inspection'
            ? (managerWizard.inspection_request_mode === 'direct' ? 'inspection_requested' : 'public_inspection_open')
            : 'published_for_quotes'),
      bid_priority: null,
      bid_deadline_at: managerWizard.flow_type === 'direct_order' && managerWizard.bid_deadline_at
        ? `${managerWizard.bid_deadline_at} 23:59:00`
        : null,
      quote_items: managerWizard.flow_type === 'direct_order' && managerWizard.quote_item_source !== 'provider'
        ? (managerWizard.quote_items ?? [])
          .filter((item) => item.category?.trim() && item.label?.trim())
          .map((item) => {
            const category = item.category.trim()

            return {
              category,
              label: item.label.trim(),
              code: item.code || category,
              unit: item.unit || '',
              quantity: Number(item.quantity || 0),
              source: item.source || (item.is_custom ? 'custom' : 'catalog'),
              is_custom: Boolean(item.is_custom),
            }
          })
        : [],
      due_date: managerWizard.flow_type === 'direct_order' && managerWizard.completion_mode === 'fixed_date'
        ? managerWizard.due_date || null
        : null,
      workflow_meta: workflowMeta,
    }
  }

  function buildManagerOrderRequestBody(payload) {
    if (!managerWizard.attachment) {
      return payload
    }

    const formData = new FormData()
    formData.append('property_id', String(payload.property_id))

    if (payload.property_object_id) {
      formData.append('property_object_id', String(payload.property_object_id))
    }

    formData.append('property_object_ids', JSON.stringify(payload.property_object_ids))

    if (payload.title) {
      formData.append('title', payload.title)
    }

    if (payload.service_type) {
      formData.append('service_type', payload.service_type)
    }

    if (payload.description) {
      formData.append('description', payload.description)
    }

    if (payload.workflow_type) {
      formData.append('workflow_type', payload.workflow_type)
    }

    formData.append('status', payload.status)
    formData.append('workflow_status', payload.workflow_status)

    if (payload.bid_deadline_at) {
      formData.append('bid_deadline_at', payload.bid_deadline_at)
    }

    if (payload.due_date) {
      formData.append('due_date', payload.due_date)
    }

    formData.append('workflow_meta', JSON.stringify(payload.workflow_meta))
    formData.append('quote_items', JSON.stringify(payload.quote_items))
    formData.append('attachment', managerWizard.attachment)

    return formData
  }

  async function persistManagerOrder(saveAsDraft = false) {
    const payload = buildManagerOrderPayload(saveAsDraft)
    const requestBody = buildManagerOrderRequestBody(payload)
    const response = editingOrderId
      ? await api.updateOrder(editingOrderId, requestBody)
      : await api.createOrder(requestBody)

    setOrders((current) => {
      const nextOrders = current.filter((order) => order.id !== response.data.id)
      return [response.data, ...nextOrders]
    })

    // The system checks whether this repeats a cancelled job or splits work
    // that is already out to tender on the same property.
    try {
      const check = await api.checkOrderDuplicates(response.data.id)

      if (check.data?.requires_explanation) {
        setDuplicatePrompt({ order: response.data, matches: check.data.matches ?? [] })
      }
    } catch {
      // A failed check must never block saving the order.
    }

    return response.data
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

  async function handleSaveManagerDraft() {
    setIsSaving(true)
    setError('')

    try {
      await persistManagerOrder(true)
      handleCloseModal()
    } catch (saveError) {
      setError(t(saveError.message))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleManagerGenerateSubmit() {
    // Validate the deadline (step 4) before posting the generated order.
    if (!validateManagerStep(4)) {
      return
    }

    await handleManagerCreateSubmit()
  }

  async function handleManagerCreateSubmit() {
    setIsSaving(true)
    setError('')

    if (!validateManagerStep(5)) {
      setIsSaving(false)
      return
    }

    try {
      await persistManagerOrder(false)
      handleCloseModal()
    } catch (saveError) {
      setError(t(saveError.message))
    } finally {
      setIsSaving(false)
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
    setCompanyRequestSuccess('')
    setExistingAttachmentName('')
    setForm({
      ...initialForm,
      property_id: defaultManagerPropertyId,
    })
    setManagerWizard(getInitialManagerWizard(defaultManagerPropertyId))
    setManagerStep(1)
    setGenerateLock(false)
    setProviderCantonFilter('')
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

  const requiresProviderSelection = managerWizard.flow_type === 'inspection' && managerWizard.inspection_request_mode === 'direct'
  const visibleServiceProviders = useMemo(() => (
    providerCantonFilter
      ? serviceProviders.filter((provider) => String(provider.canton || '').trim().toUpperCase() === providerCantonFilter)
      : serviceProviders
  ), [providerCantonFilter, serviceProviders])
  // A public tender is never company-picked: either a direct order (always
  // publicly quoted) or an inspection explicitly published to all providers.
  const isPublicTender = managerWizard.flow_type === 'direct_order'
    || (managerWizard.flow_type === 'inspection' && managerWizard.inspection_request_mode === 'public')
  // How many registered companies actually see this tender. Mirrors
  // ServiceProvider::supportsServiceType() on the backend: trade groups are
  // matched both raw and mapped to their legacy service type, and a provider
  // that declared no trades at all sees every tender.
  const notifiedProviderCount = useMemo(() => {
    const serviceType = normalizeServiceTypeForApi(managerWizard.service_type)

    if (!serviceType) {
      return 0
    }

    const target = String(serviceType).toLowerCase()

    return serviceProviders.filter((provider) => {
      if (provider.status === 'inactive') {
        return false
      }

      const tradeGroups = provider.trade_groups ?? []

      if (tradeGroups.length === 0) {
        return true
      }

      return tradeGroups.some((tradeGroup) => {
        const raw = String(tradeGroup).toLowerCase()

        return raw === target || String(normalizeServiceTypeForApi(raw) ?? '').toLowerCase() === target
      })
    }).length
  }, [serviceProviders, managerWizard.service_type])
  const managerQuoteServiceOptions = getQuoteServiceOptions(managerWizard.service_type)
  const managerQuoteUnitOptions = getTradeUnitOptions(managerWizard.service_type)
  const quoteDeadlineWarning = managerWizard.flow_type === 'direct_order'
    ? getQuoteDeadlineWarning(managerWizard.bid_deadline_at)
    : ''

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
    >
      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-body p-4">
              <div className="row g-3 mb-4 vergo-filter-bar vergo-filter-bar-compact">
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
                      <option value="closed">{t('Geschlossen')}</option>
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
                      <button type="button" className="btn btn-primary text-nowrap" onClick={openCreateModal}>
                        <i className="ti ti-plus me-1"></i>
                        {t('Auftrag erfassen')}
                      </button>
                    ) : null}
                  </div>
                </div>
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
                      {filteredOrders.map((order) => (
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
                            <span className="badge bg-light-primary text-primary rounded-pill px-3 py-2">
                              {t(getOrderFlowTypeLabel(order))}
                            </span>
                          </td>

                          <td>
                            <div>{order.requester_name || '-'}</div>
                            <div className="text-muted">{order.requester_email || '-'}</div>
                          </td>

                          <td>{formatDateDisplay(order.due_date)}</td>

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
                                  <button
                                    type="button"
                                    className="table-action-btn table-action-edit"
                                    onClick={() => openEditModal(order)}
                                    title={t('Entwurf bearbeiten')}
                                  >
                                    <i className="ti ti-pencil"></i>
                                  </button>
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

                      {filteredOrders.length === 0 ? (
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

      {canRecoverOrders ? (
        <div className="row">
          <div className="col-12">
            <div className="card">
              <div className="card-body p-4">
                <div className="d-flex align-items-center justify-content-between gap-3 mb-3">
                  <div>
                    <h5 className="fw-semibold mb-1">{t('Gelöschte Aufträge')}</h5>
                    <div className="text-muted small">{t('Gelöschte Aufträge werden hier wiederhergestellt, ohne ein Datenbank-Backup einzuspielen.')}</div>
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
                              <button
                                type="button"
                                className="btn btn-light-primary btn-sm"
                                disabled={restoringOrderId === order.id}
                                onClick={() => handleRestore(order.id)}
                              >
                                {restoringOrderId === order.id ? t('Wird wiederhergestellt...') : t('Wiederherstellen')}
                              </button>
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
          <div
            className={`modal fade ${isModalOpen ? 'show' : ''}`}
            style={{ display: isModalOpen ? 'block' : 'none' }}
            tabIndex="-1"
            aria-hidden={!isModalOpen}
          >
            <div className={`modal-dialog modal-dialog-centered modal-dialog-scrollable ${isManagerOrderFlow ? 'modal-xl' : 'modal-lg'}`}>
              <div className="modal-content rounded-1">
                <div className="modal-header border-bottom">
                  <div>
                    <h5 className="modal-title mb-1">
                      {editingOrderId ? t('Auftrag bearbeiten') : isManagerOrderFlow ? t('Auftrag erfassen') : t('Auftrag erstellen')}
                    </h5>
                    {isManagerOrderFlow ? (
                      <p className="text-muted mb-0">{t(`Schritt ${managerStep} von ${MANAGER_ORDER_STEPS.length}`)}</p>
                    ) : null}
                  </div>
                  <button type="button" className="btn-close" aria-label={t('Schließen')} onClick={handleCloseModal}></button>
                </div>

                <form onSubmit={handleSubmit}>
                  <div className="modal-body">
                    {isManagerOrderFlow ? (
                      <>
                        <div className="vergo-order-stepper mb-4">
                          {MANAGER_ORDER_STEPS.map((step) => (
                            <div
                              key={step.id}
                              className={`vergo-order-stepper-item${step.id === managerStep ? ' is-active' : ''}${step.id < managerStep ? ' is-complete' : ''}`}
                            >
                              <div className="vergo-order-stepper-node">
                                <i className={step.id < managerStep ? 'ti ti-check' : step.icon}></i>
                              </div>
                              <div className="vergo-order-stepper-copy">
                                <div className="vergo-order-stepper-title">{t(step.label)}</div>
                                <div className="vergo-order-stepper-helper">{t(step.helper)}</div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {managerStep === 1 ? (
                          <div className="row g-3">
                            <div className="col-md-12">
                              <label className="form-label">{t('Liegenschaft')}</label>
                              <select className="form-select" name="property_id" value={managerWizard.property_id} onChange={handleManagerWizardChange} disabled={isManager}>
                                <option value="">{t('Liegenschaft auswählen')}</option>
                                {managerPropertyOptions.map((property) => (
                                  <option key={property.id} value={property.id}>
                                    {property.li_number ?? property.id} - {property.title ?? property.name ?? ''}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="col-12">
                              <label className="form-label">{t('Betroffene Objekte')}</label>
                              <div className="text-muted small mb-3">
                                {t('Wählen Sie hier die betroffenen Objekte aus. Mehrfachauswahl ist möglich.')}
                              </div>
                              <div className="vergo-order-object-grid">
                                {managerAvailableObjects.map((object) => (
                                  <button
                                    key={object.id}
                                    type="button"
                                    className={`vergo-order-choice-card text-start${managerWizard.selected_object_ids.includes(object.id) ? ' is-selected' : ''}`}
                                    onClick={() => toggleManagerObjectSelection(object.id)}
                                  >
                                    <div className="d-flex align-items-start justify-content-between gap-3">
                                      <div>
                                        <div className="fw-semibold">{getPropertyObjectLabel(object)}</div>
                                        <div className="text-muted small">{object.postal_code || '-'} {object.city || ''}</div>
                                      </div>
                                      <span className={`vergo-order-choice-check${managerWizard.selected_object_ids.includes(object.id) ? ' is-selected' : ''}`}>
                                        <i className={managerWizard.selected_object_ids.includes(object.id) ? 'ti ti-check' : 'ti ti-plus'}></i>
                                      </span>
                                    </div>
                                  </button>
                                ))}
                              </div>
                              {managerAvailableObjects.length === 0 ? <div className="text-muted small mt-2">{t('Für diese Liegenschaft sind noch keine Objekte vorhanden.')}</div> : null}
                            </div>
                          </div>
                        ) : null}

                        {managerStep === 2 ? (
                          <div className="row g-3">
                            <div className="col-md-6">
                              <button
                                type="button"
                                className={`vergo-order-choice-card h-100 text-start${managerWizard.flow_type === 'inspection' ? ' is-selected' : ''}`}
                                onClick={() => handleManagerWizardChange({ target: { name: 'flow_type', value: 'inspection' } })}
                              >
                                <div className="fw-semibold mb-2">{t('Besichtigung planen')}</div>
                                <div className="text-muted small">{t('Anfrage mit bevorzugten Terminen und Kontaktperson vor Ort erfassen.')}</div>
                              </button>
                            </div>
                            <div className="col-md-6">
                              <button
                                type="button"
                                className={`vergo-order-choice-card h-100 text-start${managerWizard.flow_type === 'direct_order' ? ' is-selected' : ''}`}
                                onClick={() => handleManagerWizardChange({ target: { name: 'flow_type', value: 'direct_order' } })}
                              >
                                <div className="fw-semibold mb-2">{t('Auftrag vergeben')}</div>
                                <div className="text-muted small">{t('Direkte Vergabe oder Offertenprozess mit Kostenrahmen vorbereiten.')}</div>
                              </button>
                            </div>
                          </div>
                        ) : null}

                        {managerStep === 3 ? (
                          <div className="row g-3">
                            <div className="col-md-6">
                              <label className="form-label">{t('Gewerk')}</label>
                              {generateLock ? (
                                <div className="form-control bg-light text-muted d-flex align-items-center" style={{ pointerEvents: 'none' }}>
                                  {getOptionLabel(JOB_TYPE_OPTIONS, managerWizard.service_type)}
                                </div>
                              ) : (
                                <select
                                  className="form-select"
                                  name="service_type"
                                  value={managerWizard.service_type}
                                  onChange={(event) => handleManagerServiceTypeChange(event.target.value)}
                                >
                                  <option value="">{t('Gewerk auswählen')}</option>
                                  {JOB_TYPE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{t(option.label)}</option>
                                  ))}
                                </select>
                              )}
                            </div>
                            <div className="col-md-6">
                              <label className="form-label">{t('Aktivität')}</label>
                              <input className="form-control" name="title" value={managerWizard.title} onChange={handleManagerWizardChange} placeholder={t('z. B. Parkett ersetzen')} />
                            </div>
                            <div className="col-12">
                              <label className="form-label">{t('Auftragstext')}</label>
                              <textarea className="form-control" rows="4" name="description" value={managerWizard.description} onChange={handleManagerWizardChange}></textarea>
                            </div>

                            {managerWizard.flow_type === 'inspection' ? (
                              <>
                                <div className="col-md-3">
                                  <label className="form-label">{t('Besichtigung Datum 1')}</label>
                                  <input type="date" className="form-control" name="inspection_date_1" value={managerWizard.inspection_date_1} min={TODAY_DATE} onChange={handleManagerWizardChange} />
                                </div>
                                <div className="col-md-3">
                                  <label className="form-label">{t('Zeit 1')}</label>
                                  <input type="time" className="form-control" name="inspection_time_1" value={managerWizard.inspection_time_1} onChange={handleManagerWizardChange} />
                                </div>
                                <div className="col-md-6">
                                  <label className="form-label">{t('Offerte erstellen bis')}</label>
                                  <input
                                    type="date"
                                    className="form-control"
                                    name="inspection_quote_due_date_1"
                                    value={managerWizard.inspection_quote_due_date_1}
                                    min={managerWizard.inspection_date_1 || TODAY_DATE}
                                    onChange={handleManagerWizardChange}
                                  />
                                </div>
                                {!managerWizard.has_second_inspection_option ? (
                                  <div className="col-12">
                                    <button type="button" className="btn btn-light-primary" onClick={enableSecondInspectionOption}>
                                      <i className="ti ti-plus me-1"></i>
                                      {t('Add Second Option (Date/Time)')}
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <div className="col-12 d-flex align-items-center justify-content-between">
                                      <div className="fw-semibold">{t('Zweite Besichtigungsoption')}</div>
                                      <button type="button" className="btn btn-link text-danger p-0" onClick={removeSecondInspectionOption} aria-label={t('Zweite Option entfernen')}>
                                        <i className="ti ti-x fs-5"></i>
                                      </button>
                                    </div>
                                    <div className="col-md-3">
                                      <label className="form-label">{t('Besichtigung Datum 2')}</label>
                                      <input type="date" className="form-control" name="inspection_date_2" value={managerWizard.inspection_date_2} min={TODAY_DATE} onChange={handleManagerWizardChange} />
                                    </div>
                                    <div className="col-md-3">
                                      <label className="form-label">{t('Zeit 2')}</label>
                                      <input type="time" className="form-control" name="inspection_time_2" value={managerWizard.inspection_time_2} onChange={handleManagerWizardChange} />
                                    </div>
                                    <div className="col-md-6">
                                      <label className="form-label">{t('Offerte erstellen bis')}</label>
                                      <input
                                        type="date"
                                        className="form-control"
                                        name="inspection_quote_due_date_2"
                                        value={managerWizard.inspection_quote_due_date_2}
                                        min={managerWizard.inspection_date_2 || TODAY_DATE}
                                        onChange={handleManagerWizardChange}
                                      />
                                    </div>
                                  </>
                                )}
                                {isPastDateTime(managerWizard.inspection_date_1, managerWizard.inspection_time_1)
                                  || (managerWizard.has_second_inspection_option
                                    && isPastDateTime(managerWizard.inspection_date_2, managerWizard.inspection_time_2)) ? (
                                  <div className="col-12">
                                    <div className="alert alert-danger py-2 mb-0">
                                      {t('Die gewählte Uhrzeit liegt in der Vergangenheit. Bitte wählen Sie eine spätere Uhrzeit.')}
                                    </div>
                                  </div>
                                ) : null}
                                {isWeekendDate(managerWizard.inspection_date_1) || isWeekendDate(managerWizard.inspection_date_2) ? (
                                  <div className="col-12">
                                    <div className="alert alert-warning py-2 mb-0">
                                      {t('Der gewählte Besichtigungstermin liegt an einem Wochenende.')}
                                    </div>
                                  </div>
                                ) : null}
                                {isOutsideBusinessHours(managerWizard.inspection_time_1) || isOutsideBusinessHours(managerWizard.inspection_time_2) ? (
                                  <div className="col-12">
                                    <div className="alert alert-warning py-2 mb-0">
                                      {t('Die gewählte Zeit liegt außerhalb der normalen Geschäftszeiten von 05:00 bis 19:00 Uhr.')}
                                    </div>
                                  </div>
                                ) : null}

                                <div className="col-md-4">
                                  <label className="form-label">{t('Firma vor Ort')}</label>
                                  <input className="form-control" name="onsite_company" value={managerWizard.onsite_company} onChange={handleManagerWizardChange} />
                                </div>
                                <div className="col-md-4">
                                  <label className="form-label">{t('Vorname')}</label>
                                  <input className="form-control" name="onsite_first_name" value={managerWizard.onsite_first_name} onChange={handleManagerWizardChange} />
                                </div>
                                <div className="col-md-4">
                                  <label className="form-label">{t('Nachname')}</label>
                                  <input className="form-control" name="onsite_last_name" value={managerWizard.onsite_last_name} onChange={handleManagerWizardChange} />
                                </div>
                                <div className="col-md-6">
                                  <label className="form-label">{t('Telefon')}</label>
                                  <input className="form-control" name="onsite_phone" value={managerWizard.onsite_phone} onChange={handleManagerWizardChange} />
                                </div>
                                <div className="col-md-6">
                                  <label className="form-label">{t('E-Mail')}</label>
                                  <input className="form-control" name="onsite_email" value={managerWizard.onsite_email} onChange={handleManagerWizardChange} />
                                </div>
                              </>
                            ) : null}

                            {managerWizard.flow_type === 'direct_order' ? (
                              <>
                                <div className="col-md-6">
                                  <label className="form-label">{t('Gewünschte Fertigstellung')}</label>
                                  <select className="form-select" name="completion_mode" value={managerWizard.completion_mode} onChange={handleManagerWizardChange}>
                                    <option value="fixed_date">{t('Fixes Datum')}</option>
                                    <option value="asap">{t('So schnell wie möglich')}</option>
                                  </select>
                                </div>
                                {managerWizard.completion_mode === 'fixed_date' ? (
                                  <div className="col-md-6">
                                    <label className="form-label">{t('Fälligkeitsdatum (spätestens bis)')}</label>
                                    <input type="date" className="form-control" name="due_date" value={managerWizard.due_date} min={TODAY_DATE} onChange={handleManagerWizardChange} />
                                  </div>
                                ) : null}
                                <div className="col-12">
                                  <label className="form-label">{t('Anhang')}</label>
                                  <input type="file" className="form-control" name="attachment" accept=".pdf,.png,.jpg,.jpeg" onChange={handleManagerWizardFileChange} />
                                  <div className="form-text">{t('Optional. Laden Sie ein PDF oder Bild bis zu 10 MB hoch.')}</div>
                                  {managerWizard.attachment?.name || existingAttachmentName ? (
                                    <div className="text-muted small mt-2">
                                      {t('Aktueller Anhang')}: {managerWizard.attachment?.name || existingAttachmentName}
                                    </div>
                                  ) : null}
                                </div>
                                <div className="col-12">
                                  <div className="border rounded-3 p-3">
                                    <div className="fw-semibold mb-3">{t('Rechnungsversand')}</div>
                                    <div className="row g-3">
                                      <div className="col-md-6">
                                        <button
                                          type="button"
                                          className={`vergo-order-choice-card h-100 text-start${managerWizard.invoice_recipient_type === 'manager_profile' ? ' is-selected' : ''}`}
                                          onClick={() => handleManagerWizardChange({ target: { name: 'invoice_recipient_type', value: 'manager_profile' } })}
                                        >
                                          <div className="fw-semibold mb-2">{t('An Immobilienverwalter senden')}</div>
                                          <div className="text-muted small">{t('Verwendet die hinterlegten Rechnungsdaten des Immobilienverwalters.')}</div>
                                        </button>
                                      </div>
                                      <div className="col-md-6">
                                        <button
                                          type="button"
                                          className={`vergo-order-choice-card h-100 text-start${managerWizard.invoice_recipient_type === 'third_party' ? ' is-selected' : ''}`}
                                          onClick={() => handleManagerWizardChange({ target: { name: 'invoice_recipient_type', value: 'third_party' } })}
                                        >
                                          <div className="fw-semibold mb-2">{t('An Dritte senden')}</div>
                                          <div className="text-muted small">{t('Rechnungsadresse und Versandart für einen abweichenden Empfänger erfassen.')}</div>
                                        </button>
                                      </div>
                                    </div>

                                    {managerWizard.invoice_recipient_type === 'third_party' ? (
                                      <div className="row g-3 mt-1">
                                        <div className="col-md-6">
                                          <label className="form-label">{t('Firmenname')}</label>
                                          <input className="form-control" name="invoice_company_name" value={managerWizard.invoice_company_name} onChange={handleManagerWizardChange} />
                                        </div>
                                        <div className="col-md-6">
                                          <label className="form-label">{t('Co.')}</label>
                                          <input className="form-control" name="invoice_company_extra" value={managerWizard.invoice_company_extra} onChange={handleManagerWizardChange} />
                                        </div>
                                        <div className="col-md-6">
                                          <label className="form-label">{t('Vorname')}</label>
                                          <input className="form-control" name="invoice_first_name" value={managerWizard.invoice_first_name} onChange={handleManagerWizardChange} />
                                        </div>
                                        <div className="col-md-6">
                                          <label className="form-label">{t('Nachname')}</label>
                                          <input className="form-control" name="invoice_last_name" value={managerWizard.invoice_last_name} onChange={handleManagerWizardChange} />
                                        </div>
                                        <div className="col-12">
                                          <label className="form-label">{t('Adresse')}</label>
                                          <input className="form-control" name="invoice_address" value={managerWizard.invoice_address} onChange={handleManagerWizardChange} />
                                        </div>
                                        <div className="col-md-4">
                                          <label className="form-label">{t('PLZ')}</label>
                                          <input className="form-control" name="invoice_postal_code" value={managerWizard.invoice_postal_code} onChange={handleManagerWizardChange} />
                                        </div>
                                        <div className="col-md-8">
                                          <label className="form-label">{t('Ort')}</label>
                                          <input className="form-control" name="invoice_city" value={managerWizard.invoice_city} onChange={handleManagerWizardChange} />
                                        </div>
                                        <div className="col-md-6">
                                          <label className="form-label">{t('Versandart')}</label>
                                          <select className="form-select" name="invoice_delivery_method" value={managerWizard.invoice_delivery_method} onChange={handleManagerWizardChange}>
                                            <option value="email">{t('E-Mail')}</option>
                                            <option value="mail">{t('Post')}</option>
                                          </select>
                                        </div>
                                        {managerWizard.invoice_delivery_method === 'email' ? (
                                          <div className="col-md-6">
                                            <label className="form-label">{t('E-Mail für Rechnungen')}</label>
                                            <input type="email" className="form-control" name="invoice_email" value={managerWizard.invoice_email} onChange={handleManagerWizardChange} />
                                          </div>
                                        ) : null}
                                      </div>
                                    ) : (
                                      <div className="alert alert-light border small mt-3 mb-0">
                                        {t('Der ausgewählte Dienstleister erhält nach Abschluss die beim Immobilienverwalter hinterlegte Rechnungsadresse.')}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </>
                            ) : null}
                          </div>
                        ) : null}

                        {managerStep === 4 ? (
                          <div className="row g-3">
                            {managerWizard.flow_type === 'inspection' ? (
                              <>
                                <div className="col-md-6">
                                  <button
                                    type="button"
                                    className={`vergo-order-choice-card h-100 text-start${managerWizard.inspection_request_mode === 'direct' ? ' is-selected' : ''}`}
                                    onClick={() => handleManagerWizardChange({ target: { name: 'inspection_request_mode', value: 'direct' } })}
                                  >
                                    <div className="fw-semibold mb-2">{t('Besichtigung direkt anfragen')}</div>
                                    <div className="text-muted small">{t('Firma gezielt auswählen und direkt benachrichtigen.')}</div>
                                  </button>
                                </div>
                                <div className="col-md-6">
                                  <button
                                    type="button"
                                    className={`vergo-order-choice-card h-100 text-start${managerWizard.inspection_request_mode === 'public' ? ' is-selected' : ''}`}
                                    onClick={() => handleManagerWizardChange({ target: { name: 'inspection_request_mode', value: 'public' } })}
                                  >
                                    <div className="fw-semibold mb-2">{t('Öffentliche Besichtigungsanfrage')}</div>
                                    <div className="text-muted small">{t('Anfrage öffentlich ausschreiben und Anmeldungen sammeln.')}</div>
                                  </button>
                                </div>
                                {managerWizard.inspection_request_mode ? (
                                  <div className="col-md-6">
                                    <label className="form-label">
                                      {managerWizard.inspection_request_mode === 'direct'
                                        ? t('Anzahl einzuladender Dienstleister')
                                        : t('Maximale Anzahl Dienstleister')}
                                    </label>
                                    <select
                                      className="form-control"
                                      name="inspection_provider_limit"
                                      value={managerWizard.inspection_provider_limit}
                                      onChange={handleManagerWizardChange}
                                    >
                                      {Array.from({ length: 10 }, (_, index) => index + 1).map((count) => (
                                        <option key={count} value={count}>{count}</option>
                                      ))}
                                    </select>
                                    <div className="form-text">
                                      {managerWizard.inspection_request_mode === 'direct'
                                        ? t('Sie müssen im nächsten Schritt genau diese Anzahl Firmen auswählen.')
                                        : t('So viele Dienstleister dürfen sich für die öffentliche Besichtigung anmelden.')}
                                    </div>
                                  </div>
                                ) : null}
                              </>
                            ) : null}

                            {managerWizard.flow_type === 'direct_order' ? (
                              <>
                                <div className="col-12">
                                  <button
                                    type="button"
                                    className="vergo-order-choice-card h-100 text-start is-selected"
                                    onClick={() => handleManagerWizardChange({ target: { name: 'award_mode', value: 'request_quotes' } })}
                                  >
                                    <div className="fw-semibold mb-2">{t('Offerten einholen')}</div>
                                    <div className="text-muted small">{t('Mehrere Firmen anfragen und Angebote vergleichen.')}</div>
                                  </button>
                                </div>
                                <div className="col-md-6">
                                  <label className="form-label">{t('Angebotsfrist')}</label>
                                  <input type="date" className="form-control" name="bid_deadline_at" value={managerWizard.bid_deadline_at} min={TOMORROW_DATE} onChange={handleManagerWizardChange} />
                                  {quoteDeadlineWarning ? (
                                    <div className={`form-text ${isWeekendDate(managerWizard.bid_deadline_at) ? 'text-danger' : 'text-warning'}`}>
                                      {t(quoteDeadlineWarning)}
                                    </div>
                                  ) : (
                                    <div className="form-text">{t('Angebote können bis 23:59 Uhr am gewählten Tag eingereicht werden.')}</div>
                                  )}
                                </div>
                                <div className="col-12">
                                  {!generateLock ? (
                                    <div className="row g-3 mb-3">
                                      <div className="col-md-6">
                                        <button
                                          type="button"
                                          className={`vergo-order-choice-card h-100 text-start${managerWizard.quote_item_source !== 'provider' ? ' is-selected' : ''}`}
                                          onClick={() => handleManagerWizardChange({ target: { name: 'quote_item_source', value: 'manager' } })}
                                        >
                                          <div className="fw-semibold mb-2">{t('Positionen selbst erfassen')}</div>
                                          <div className="text-muted small">{t('Sie erfassen die Leistungen direkt in diesem Schritt.')}</div>
                                        </button>
                                      </div>
                                      <div className="col-md-6">
                                        <button
                                          type="button"
                                          className={`vergo-order-choice-card h-100 text-start${managerWizard.quote_item_source === 'provider' ? ' is-selected' : ''}`}
                                          onClick={() => handleManagerWizardChange({ target: { name: 'quote_item_source', value: 'provider' } })}
                                        >
                                          <div className="fw-semibold mb-2">{t('Positionen vom Dienstleister erfassen lassen')}</div>
                                          <div className="text-muted small">{t('Der Dienstleister erstellt nach der Besichtigung die erste Positionsliste.')}</div>
                                        </button>
                                      </div>
                                    </div>
                                  ) : null}

                                  <div className="d-flex align-items-center justify-content-between gap-3 mb-3">
                                    <div>
                                      <h6 className="fw-semibold mb-1">{t('Leistungspositionen')}</h6>
                                      <p className="text-muted small mb-0">
                                        {generateLock
                                          ? t('Diese Positionen wurden vom Dienstleister nach der Besichtigung erfasst und können nicht geändert werden. Bitte geben Sie nur die Angebotsfrist an.')
                                          : t('Diese Positionen werden öffentlich ausgeschrieben. Anbieter sehen die Arbeit, aber nicht die Preise anderer Firmen.')}
                                      </p>
                                    </div>
                                    {managerWizard.quote_item_source !== 'provider' && !generateLock ? (
                                      <button type="button" className="btn btn-light-primary btn-sm" onClick={addQuoteItem}>
                                      <i className="ti ti-plus me-1"></i>
                                      {t('Position hinzufügen')}
                                      </button>
                                    ) : null}
                                  </div>

                                  {managerWizard.quote_item_source === 'provider' ? (
                                    <div className="alert alert-light-primary border mb-0">
                                      {t('Die Positionsliste wird vom Dienstleister nach der Besichtigung erstellt.')}
                                    </div>
                                  ) : (
                                  <div className="row g-3">
                                    {(managerWizard.quote_items ?? []).map((item, index) => {
                                      const usesCustomCategory = Boolean(item.is_custom || (item.category && !managerQuoteServiceOptions.includes(item.category)))

                                      return (
                                        <div className="col-12" key={item.id}>
                                          <div className="border rounded-3 p-3">
                                            <div className="row g-3 align-items-end">
                                              <div className="col-lg-1 col-md-2">
                                                <label className="form-label">{t('Position')}</label>
                                                <input className="form-control text-center" value={index + 1} readOnly />
                                              </div>
                                              <div className="col-lg-3 col-md-5">
                                                <label className="form-label">{t('Kategorie')}</label>
                                                {usesCustomCategory ? (
                                                  <>
                                                    <input
                                                      className="form-control"
                                                      value={item.category || ''}
                                                      readOnly={generateLock}
                                                      onChange={(event) => updateQuoteItem(item.id, 'category', event.target.value)}
                                                      placeholder={t('Kategorie eingeben')}
                                                    />
                                                    {!generateLock ? (
                                                      <button type="button" className="btn btn-link btn-sm p-0 mt-1" onClick={() => updateQuoteItem(item.id, 'category', '')}>
                                                        {t('Aus Liste wählen')}
                                                      </button>
                                                    ) : null}
                                                  </>
                                                ) : (
                                                  <select
                                                    className="form-select"
                                                    value={item.category || ''}
                                                    disabled={generateLock}
                                                    onChange={(event) => updateQuoteItem(item.id, 'category', event.target.value)}
                                                  >
                                                    <option value="">{t('Kategorie auswählen')}</option>
                                                    {managerQuoteServiceOptions.map((option) => (
                                                      <option key={option} value={option}>{option}</option>
                                                    ))}
                                                    {!generateLock ? <option value={ADD_SERVICE_OPTION_VALUE}>{t('Service hinzufügen')}</option> : null}
                                                  </select>
                                                )}
                                              </div>
                                              <div className={generateLock ? 'col-lg-4 col-md-5' : 'col-lg-3 col-md-5'}>
                                                <label className="form-label">{t('Service')}</label>
                                                <input
                                                  className="form-control"
                                                  value={item.label}
                                                  readOnly={generateLock}
                                                  onChange={(event) => updateQuoteItem(item.id, 'label', event.target.value)}
                                                  placeholder={t('Service beschreiben')}
                                                />
                                              </div>
                                              <div className="col-lg-2 col-md-4">
                                                <label className="form-label">{t('Einheit')}</label>
                                                <select
                                                  className="form-select"
                                                  value={item.unit || ''}
                                                  disabled={generateLock}
                                                  onChange={(event) => updateQuoteItem(item.id, 'unit', event.target.value)}
                                                >
                                                  <option value="">{t('Einheit wählen')}</option>
                                                  {item.unit && !managerQuoteUnitOptions.includes(item.unit) ? (
                                                    <option value={item.unit}>{item.unit}</option>
                                                  ) : null}
                                                  {managerQuoteUnitOptions.map((option) => (
                                                    <option key={option} value={option}>{option}</option>
                                                  ))}
                                                </select>
                                              </div>
                                              <div className="col-lg-2 col-md-4">
                                                <label className="form-label">{t('Menge')}</label>
                                                <input
                                                  type="number"
                                                  min="0"
                                                  step="0.01"
                                                  className="form-control"
                                                  value={item.quantity}
                                                  readOnly={generateLock}
                                                  onChange={(event) => updateQuoteItem(item.id, 'quantity', event.target.value)}
                                                />
                                              </div>
                                              {!generateLock ? (
                                                <div className="col-lg-1 col-md-4">
                                                  <button type="button" className="btn btn-light-danger text-danger w-100" onClick={() => removeQuoteItem(item.id)} aria-label={t('Position entfernen')}>
                                                    <i className="ti ti-trash"></i>
                                                  </button>
                                                </div>
                                              ) : null}
                                            </div>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                  )}
                                </div>
                              </>
                            ) : null}
                          </div>
                        ) : null}

                        {managerStep === 5 ? (
                          <div className="row g-4">
                            {isPublicTender ? (
                              <div className="col-12">
                                <div className="alert alert-light-primary border mb-0">
                                  <div className="fw-semibold mb-1">
                                    {managerWizard.flow_type === 'direct_order'
                                      ? t('Öffentliche Offertenanfrage')
                                      : t('Öffentliche Besichtigungsanfrage')}
                                  </div>
                                  <div className="small">
                                    {t('Dieser Auftrag wird öffentlich ausgeschrieben. Es kann keine einzelne Firma ausgewählt werden; alle passenden Dienstleister können ein Angebot einreichen.')}
                                  </div>
                                  <div className="fw-semibold mt-3 mb-0">
                                    {notifiedProviderCount === 1
                                      ? `${t('1 Firma im Gewerk')} „${t(getOptionLabel(JOB_TYPE_OPTIONS, managerWizard.service_type))}" ${t('wird benachrichtigt.')}`
                                      : `${notifiedProviderCount} ${t('Firmen im Gewerk')} „${t(getOptionLabel(JOB_TYPE_OPTIONS, managerWizard.service_type))}" ${t('werden benachrichtigt.')}`}
                                  </div>
                                  {notifiedProviderCount === 0 ? (
                                    <div className="small text-danger mt-1">
                                      {t('Für dieses Gewerk ist aktuell keine Firma registriert. Die Ausschreibung bleibt sichtbar, sobald sich passende Dienstleister registrieren.')}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            ) : (
                              <>
                            <div className="col-lg-7">
                              <div className="mb-3">
                                <h6 className="fw-semibold mb-1">{t('Firmenauswahl')}</h6>
                                <p className="text-muted small mb-0">
                                  {requiresProviderSelection
                                    ? `${t('Wählen Sie passende Firmen aus der Liste aus.')} ${managerWizard.selected_provider_ids.length}/${managerWizard.inspection_provider_limit}`
                                    : t('Die Auswahl ist optional. Sie können den Auftrag auch ohne direkte Firmenzuordnung speichern.')}
                                </p>
                              </div>

                              <div className="mb-3">
                                <label className="form-label">{t('Nach Kanton filtern')}</label>
                                <select
                                  className="form-select"
                                  value={providerCantonFilter}
                                  onChange={(event) => setProviderCantonFilter(event.target.value)}
                                >
                                  <option value="">{t('Alle Kantone')}</option>
                                  {SWISS_CANTONS.map((canton) => (
                                    <option key={canton.value} value={canton.value}>{canton.label}</option>
                                  ))}
                                </select>
                              </div>

                              <div className="vergo-order-provider-grid">
                                {visibleServiceProviders.map((provider) => (
                                  <button
                                    key={provider.id}
                                    type="button"
                                    className={`vergo-order-choice-card text-start${managerWizard.selected_provider_ids.includes(String(provider.id)) ? ' is-selected' : ''}`}
                                    onClick={() => toggleProviderSelection(provider.id)}
                                  >
                                    <div className="fw-semibold">{provider.company_name}</div>
                                    <div className="text-muted small">
                                      {[provider.postal_code, provider.city, provider.canton].filter(Boolean).join(' ') || '-'}
                                    </div>
                                  </button>
                                ))}
                              </div>
                              {visibleServiceProviders.length === 0 ? (
                                <div className="text-muted small mt-2">{t('Keine Firmen für diesen Kanton gefunden.')}</div>
                              ) : null}
                            </div>

                            <div className="col-lg-5">
                              <div className="border rounded-3 p-4 h-100">
                                <div className="mb-3">
                                  <h6 className="fw-semibold mb-1">{t('Firma fehlt?')}</h6>
                                  <p className="text-muted small mb-0">
                                    {t('Senden Sie eine Anfrage an das Vergo-Team, damit die Firma zentral angelegt werden kann.')}
                                  </p>
                                </div>

                                <button type="button" className="btn btn-light-primary" onClick={openCompanyRequestModal}>
                                  <i className="ti ti-plus me-1"></i>
                                  {t('Firma zur Anlage anfragen')}
                                </button>

                                {companyRequestSuccess ? (
                                  <div className="alert alert-success py-2 mt-3 mb-0">
                                    {companyRequestSuccess}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                              </>
                            )}
                          </div>
                        ) : null}
                      </>
                    ) : (
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
                    )}

                    {error ? <div className="alert alert-danger py-2 mt-3 mb-0">{error}</div> : null}
                  </div>

                  <div className="modal-footer">
                    <button type="button" className="btn btn-light-danger text-danger" onClick={handleCloseModal}>
                      {t('Abbrechen')}
                    </button>

                    {isManagerOrderFlow ? (
                      <>
                        {managerStep > 1 ? (
                          <button type="button" className="btn btn-light-primary" onClick={handleManagerPreviousStep}>
                            {t('Zurück')}
                          </button>
                        ) : null}

                        <button type="button" className="btn btn-light-primary" disabled={isSaving} onClick={handleSaveManagerDraft}>
                          {isSaving ? t('Wird gespeichert...') : t('Als Entwurf speichern')}
                        </button>

                        {generateLock && managerStep === 4 ? (
                          <button type="button" className="btn btn-primary" disabled={isSaving} onClick={handleManagerGenerateSubmit}>
                            {isSaving ? t('Wird gespeichert...') : t('Auftrag erstellen')}
                          </button>
                        ) : managerStep < 5 ? (
                          <button type="button" className="btn btn-primary" onClick={handleManagerNextStep}>
                            {t('Weiter')}
                          </button>
                        ) : (
                          <button type="button" className="btn btn-primary" disabled={isSaving} onClick={handleManagerCreateSubmit}>
                            {isSaving ? t('Wird gespeichert...') : editingOrderId ? t('Entwurf veröffentlichen') : t('Auftrag erstellen')}
                          </button>
                        )}
                      </>
                    ) : (
                      <button type="submit" className="btn btn-primary" disabled={isSaving}>
                        {isSaving ? t('Wird gespeichert...') : editingOrderId ? t('Auftrag aktualisieren') : t('Auftrag erstellen')}
                      </button>
                    )}
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
                    <h5 className="modal-title">{t('Firma zur Anlage anfragen')}</h5>
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
                      <button type="button" className="btn btn-light-danger text-danger" onClick={closeCompanyRequestModal}>
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
          {isModalOpen ? <div className="modal-backdrop fade show"></div> : null}
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
