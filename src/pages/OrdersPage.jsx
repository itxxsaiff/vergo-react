import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import PageContent from '../components/PageContent'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { confirmDelete, showDeleteSuccess } from '../lib/alerts'
import { api } from '../lib/api'
import { formatStatusLabel, getStatusBadgeClass } from '../lib/tableStatus'
import {
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

function getTodayDateValue() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

const TODAY_DATE = getTodayDateValue()

const MANAGER_ORDER_STEPS = [
  { id: 1, label: 'Liegenschaft', helper: 'Objekte wählen', icon: 'ti ti-building-estate' },
  { id: 2, label: 'Ablauf', helper: 'Besichtigung oder Auftrag', icon: 'ti ti-git-branch' },
  { id: 3, label: 'Details', helper: 'Gewerk und Angaben', icon: 'ti ti-file-description' },
  { id: 4, label: 'Vergabe', helper: 'Anfrageart festlegen', icon: 'ti ti-badge-ad' },
  { id: 5, label: 'Firmen', helper: 'Anbieter auswählen', icon: 'ti ti-users' },
]

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
    inspection_date_2: '',
    inspection_time_2: '',
    onsite_company: '',
    onsite_first_name: '',
    onsite_last_name: '',
    onsite_phone: '',
    onsite_email: '',
    inspection_request_mode: '',
    completion_mode: 'fixed_date',
    due_date: '',
    award_mode: '',
    cost_estimate_range: '',
    bid_priority: '',
    bid_deadline_at: '',
    quote_items: [],
    selected_provider_ids: [],
    manual_provider_company: '',
    manual_provider_contact: '',
    manual_provider_email: '',
    manual_provider_phone: '',
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

function hasManualProviderSelection(wizard) {
  return Boolean(
    wizard.manual_provider_company.trim()
    || wizard.manual_provider_contact.trim()
    || wizard.manual_provider_email.trim()
    || wizard.manual_provider_phone.trim(),
  )
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
          wizard.inspection_date_1 || wizard.inspection_time_1
            ? { date: wizard.inspection_date_1 || null, time: wizard.inspection_time_1 || null }
            : null,
          wizard.inspection_date_2 || wizard.inspection_time_2
            ? { date: wizard.inspection_date_2 || null, time: wizard.inspection_time_2 || null }
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
      }
      : null,
    assignment: wizard.flow_type === 'direct_order'
      ? {
        completion_mode: wizard.completion_mode,
        award_mode: wizard.award_mode || null,
        cost_estimate_range: wizard.cost_estimate_range || null,
        bid_priority: wizard.bid_priority || null,
        bid_deadline_at: wizard.bid_deadline_at || null,
      }
      : null,
    provider_selection: {
      selected_provider_ids: wizard.selected_provider_ids
        .filter((id) => id !== null && id !== undefined && id !== '')
        .map((id) => Number(id)),
      manual_provider: hasManualProviderSelection(wizard)
        ? {
          company_name: wizard.manual_provider_company || null,
          contact_name: wizard.manual_provider_contact || null,
          email: wizard.manual_provider_email || null,
          phone: wizard.manual_provider_phone || null,
        }
        : null,
    },
  }
}

function OrdersPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [searchParams, setSearchParams] = useSearchParams()
  const [orders, setOrders] = useState([])
  const [properties, setProperties] = useState([])
  const [objects, setObjects] = useState([])
  const [serviceProviders, setServiceProviders] = useState([])
  const [form, setForm] = useState(initialForm)
  const [managerWizard, setManagerWizard] = useState(getInitialManagerWizard())
  const [managerStep, setManagerStep] = useState(1)
  const [providerCityFilter, setProviderCityFilter] = useState('')
  const [filters, setFilters] = useState({
    search: '',
    status: '',
  })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingOrderId, setEditingOrderId] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const canCreateOrders = Boolean(user?.permissions?.orders?.create)
  const canEditOrders = Boolean(user?.permissions?.orders?.edit)
  const canDeleteOrders = Boolean(user?.permissions?.orders?.delete)
  const canManageOrders = canCreateOrders || canEditOrders || canDeleteOrders
  const isAdmin = user?.role === 'admin'
  const showActionColumn = isAdmin || canEditOrders || canDeleteOrders
  const isManager = user?.role === 'manager'
  const isOwner = user?.role === 'owner'
  const isManagerCreateFlow = isManager && !editingOrderId

  async function loadData() {
    setIsLoading(true)
    setError('')

    try {
      const [ordersResponse, propertiesResponse, objectsResponse, serviceProvidersResponse] = await Promise.all([
        api.getOrders(),
        api.getProperties(),
        api.getPropertyObjects(),
        api.getServiceProviders(),
      ])

      setOrders(ordersResponse.data ?? [])
      setProperties(propertiesResponse.data ?? [])
      setObjects(objectsResponse.data ?? [])
      setServiceProviders(serviceProvidersResponse.data ?? [])
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (isManager && properties.length > 0 && !form.property_id) {
      setForm((current) => ({
        ...current,
        property_id: String(user?.property?.id ?? properties[0].id),
      }))
    }
  }, [form.property_id, isManager, properties, user?.property?.id])

  useEffect(() => {
    if (isManager && properties.length > 0 && !managerWizard.property_id) {
      setManagerWizard((current) => ({
        ...current,
        property_id: String(user?.property?.id ?? properties[0].id),
      }))
    }
  }, [isManager, managerWizard.property_id, properties, user?.property?.id])

  useEffect(() => {
    const shouldOpenCreate = searchParams.get('open') === 'create'

    if (!shouldOpenCreate || !canCreateOrders || isModalOpen || isLoading) {
      return
    }

    openCreateModal()

    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('open')
    setSearchParams(nextParams, { replace: true })
  }, [canCreateOrders, isLoading, isModalOpen, searchParams, setSearchParams, properties.length, user?.property?.id])

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
      ...(name === 'flow_type'
        ? {
          inspection_request_mode: '',
          award_mode: '',
          cost_estimate_range: '',
          bid_priority: '',
          bid_deadline_at: '',
          quote_items: [],
          selected_provider_ids: [],
          manual_provider_company: '',
          manual_provider_contact: '',
          manual_provider_email: '',
          manual_provider_phone: '',
        }
        : {}),
      ...(name === 'inspection_request_mode' && value === 'public'
        ? {
          selected_provider_ids: [],
          manual_provider_company: '',
          manual_provider_contact: '',
          manual_provider_email: '',
          manual_provider_phone: '',
        }
        : {}),
      ...(name === 'award_mode' && value === 'request_quotes'
        ? {
          selected_provider_ids: [],
          manual_provider_company: '',
          manual_provider_contact: '',
          manual_provider_email: '',
          manual_provider_phone: '',
          quote_items: seedQuoteItemsForTrade(current.service_type),
        }
        : {}),
    }))
  }

  function seedQuoteItemsForTrade(serviceType) {
    const baseItems = [{
      label: getOptionLabel(JOB_TYPE_OPTIONS, serviceType),
      unit: 'Stück',
      quantity: 1,
      code: serviceType || '',
      source: 'catalog',
    }]

    return baseItems.map((item, index) => ({
      id: `${serviceType || 'custom'}-${index}-${Date.now()}`,
      label: item.label,
      code: item.code || '',
      unit: item.unit || '',
      quantity: item.quantity ?? 1,
      source: item.source || 'catalog',
      is_custom: false,
    }))
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
        {
          id: `custom-${Date.now()}`,
          label: '',
          code: '',
          unit: '',
          quantity: 1,
          source: 'custom',
          is_custom: true,
        },
      ],
    }))
  }

  function updateQuoteItem(itemId, field, value) {
    setManagerWizard((current) => ({
      ...current,
      quote_items: (current.quote_items ?? []).map((item) => (
        item.id === itemId
          ? {
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
          : [...current.selected_provider_ids, normalizedProviderId],
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
    if (isManagerCreateFlow && managerAvailableObjects.length === 1 && managerWizard.selected_object_ids.length === 0) {
      setManagerWizard((current) => ({
        ...current,
        selected_object_ids: [managerAvailableObjects[0].id],
      }))
    }
  }, [isManagerCreateFlow, managerAvailableObjects, managerWizard.selected_object_ids.length])

  function openCreateModal() {
    setEditingOrderId(null)
    setError('')
    setForm({
      ...initialForm,
      property_id: isManager ? String(user?.property?.id ?? properties[0]?.id ?? '') : '',
    })
    setManagerWizard(getInitialManagerWizard(String(user?.property?.id ?? properties[0]?.id ?? '')))
    setManagerStep(1)
    setProviderCityFilter('')
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
        if (!managerWizard.inspection_date_1 || !managerWizard.inspection_time_1) {
          setError(t('Bitte geben Sie mindestens eine bevorzugte Besichtigung an.'))
          return false
        }

        if (isPastDate(managerWizard.inspection_date_1) || isPastDate(managerWizard.inspection_date_2)) {
          setError(t('Bitte wählen Sie kein Datum in der Vergangenheit.'))
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
    }

    if (step === 4) {
      if (managerWizard.flow_type === 'inspection' && !managerWizard.inspection_request_mode) {
        setError(t('Bitte wählen Sie direkte Besichtigungsanfrage oder öffentliche Ausschreibung.'))
        return false
      }

      if (managerWizard.flow_type === 'direct_order') {
        if (!managerWizard.award_mode) {
          setError(t('Bitte wählen Sie Direktvergabe oder Offertenanfrage.'))
          return false
        }

        if (managerWizard.award_mode === 'direct_award' && !managerWizard.cost_estimate_range) {
          setError(t('Bitte wählen Sie einen Kostenrahmen aus.'))
          return false
        }

        if (managerWizard.award_mode === 'request_quotes') {
          if (!managerWizard.bid_priority) {
            setError(t('Bitte wählen Sie eine Priorität für die Offertenanfrage.'))
            return false
          }

          if (!managerWizard.bid_deadline_at) {
            setError(t('Bitte geben Sie eine Angebotsfrist an.'))
            return false
          }

          if (isPastDate(managerWizard.bid_deadline_at)) {
            setError(t('Bitte wählen Sie kein Datum in der Vergangenheit.'))
            return false
          }
        }
      }
    }

    if (step === 5) {
      if (managerWizard.flow_type === 'direct_order' && managerWizard.award_mode === 'request_quotes') {
        const validQuoteItems = (managerWizard.quote_items ?? []).filter((item) => item.label.trim())

        if (validQuoteItems.length === 0) {
          setError(t('Bitte erfassen Sie mindestens eine Leistungsposition für die öffentliche Ausschreibung.'))
          return false
        }
      }

      const requiresProviderSelection = (
        (managerWizard.flow_type === 'inspection' && managerWizard.inspection_request_mode === 'direct')
        || (managerWizard.flow_type === 'direct_order' && managerWizard.award_mode === 'direct_award')
      )

      const normalizedSelectedProviderIds = (managerWizard.selected_provider_ids ?? []).filter(Boolean)

      if (requiresProviderSelection && normalizedSelectedProviderIds.length === 0 && !hasManualProviderSelection(managerWizard)) {
        setError(t('Bitte wählen Sie mindestens eine Firma aus oder erfassen Sie eine manuell.'))
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

    setManagerStep((current) => Math.min(current + 1, 5))
  }

  function handleManagerPreviousStep() {
    setError('')
    setManagerStep((current) => Math.max(current - 1, 1))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setIsSaving(true)
    setError('')

    if (isManagerCreateFlow) {
      if (!validateManagerStep(5)) {
        setIsSaving(false)
        return
      }

      try {
        const workflowMeta = buildManagerWorkflowMeta(managerWizard, selectedManagerObjects)
        const payload = {
          property_id: Number(managerWizard.property_id),
          property_object_id: managerWizard.selected_object_ids[0] ? Number(managerWizard.selected_object_ids[0]) : null,
          property_object_ids: managerWizard.selected_object_ids.map((id) => Number(id)),
          title: managerWizard.title.trim(),
          service_type: normalizeServiceTypeForApi(managerWizard.service_type),
          description: managerWizard.description.trim() || null,
          workflow_type: managerWizard.flow_type,
          workflow_status: managerWizard.flow_type === 'inspection'
            ? (managerWizard.inspection_request_mode === 'direct' ? 'inspection_requested' : 'public_inspection_open')
            : (managerWizard.award_mode === 'direct_award' ? 'direct_award_pending_acceptance' : 'published_for_quotes'),
          bid_priority: managerWizard.flow_type === 'direct_order' && managerWizard.award_mode === 'request_quotes'
            ? managerWizard.bid_priority
            : null,
          bid_deadline_at: managerWizard.flow_type === 'direct_order' && managerWizard.award_mode === 'request_quotes'
            ? `${managerWizard.bid_deadline_at} 23:59:00`
            : null,
          quote_items: managerWizard.flow_type === 'direct_order' && managerWizard.award_mode === 'request_quotes'
            ? (managerWizard.quote_items ?? [])
              .filter((item) => item.label.trim())
              .map((item) => {
                const payloadItem = { ...item }
                delete payloadItem.id
                return payloadItem
              })
            : [],
          due_date: managerWizard.flow_type === 'direct_order' && managerWizard.completion_mode === 'fixed_date'
            ? managerWizard.due_date
            : null,
          workflow_meta: workflowMeta,
        }

        const response = await api.createOrder(payload)
        setOrders((current) => [response.data, ...current])
        handleCloseModal()
      } catch (saveError) {
        setError(saveError.message)
      } finally {
        setIsSaving(false)
      }

      return
    }

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
      setError(saveError.message)
    } finally {
      setIsSaving(false)
    }
  }

  function handleCloseModal() {
    setEditingOrderId(null)
    setForm({
      ...initialForm,
      property_id: isManager ? String(user?.property?.id ?? properties[0]?.id ?? '') : '',
    })
    setManagerWizard(getInitialManagerWizard(String(user?.property?.id ?? properties[0]?.id ?? '')))
    setManagerStep(1)
    setProviderCityFilter('')
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
      setError(deleteError.message)
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

  const requiresProviderSelection = (
    (managerWizard.flow_type === 'inspection' && managerWizard.inspection_request_mode === 'direct')
    || (managerWizard.flow_type === 'direct_order' && managerWizard.award_mode === 'direct_award')
  )
  const providerCityOptions = useMemo(() => (
    [...new Set(serviceProviders.map((provider) => provider.city).filter(Boolean))]
      .sort((firstCity, secondCity) => firstCity.localeCompare(secondCity))
  ), [serviceProviders])
  const visibleServiceProviders = useMemo(() => (
    providerCityFilter
      ? serviceProviders.filter((provider) => String(provider.city || '') === providerCityFilter)
      : serviceProviders
  ), [providerCityFilter, serviceProviders])

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
                        <th><h6 className="fs-4 fw-semibold mb-0">{t('Fälligkeitsdatum')}</h6></th>
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

                          <td>{order.due_date || '-'}</td>

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

      {canManageOrders ? (
        <>
          <div
            className={`modal fade ${isModalOpen ? 'show' : ''}`}
            style={{ display: isModalOpen ? 'block' : 'none' }}
            tabIndex="-1"
            aria-hidden={!isModalOpen}
          >
            <div className={`modal-dialog modal-dialog-centered modal-dialog-scrollable ${isManagerCreateFlow ? 'modal-xl' : 'modal-lg'}`}>
              <div className="modal-content rounded-1">
                <div className="modal-header border-bottom">
                  <div>
                    <h5 className="modal-title mb-1">
                      {editingOrderId ? t('Auftrag bearbeiten') : isManagerCreateFlow ? t('Auftrag erfassen') : t('Auftrag erstellen')}
                    </h5>
                    {isManagerCreateFlow ? (
                      <p className="text-muted mb-0">{t(`Schritt ${managerStep} von ${MANAGER_ORDER_STEPS.length}`)}</p>
                    ) : null}
                  </div>
                  <button type="button" className="btn-close" aria-label={t('Schließen')} onClick={handleCloseModal}></button>
                </div>

                <form onSubmit={handleSubmit}>
                  <div className="modal-body">
                    {isManagerCreateFlow ? (
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
                              <select className="form-select" name="property_id" value={managerWizard.property_id} onChange={handleManagerWizardChange} disabled>
                                <option value="">{t('Liegenschaft auswählen')}</option>
                                {properties.map((property) => (
                                  <option key={property.id} value={property.id}>
                                    {property.li_number} - {property.title}
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
                            </div>
                            <div className="col-md-6">
                              <label className="form-label">{t('Kurzbeschreibung')}</label>
                              <input className="form-control" name="title" value={managerWizard.title} onChange={handleManagerWizardChange} placeholder={t('z. B. Parkett ersetzen')} />
                            </div>
                            <div className="col-12">
                              <label className="form-label">{t('Detaillierte Beschreibung')}</label>
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
                                <div className="col-md-3">
                                  <label className="form-label">{t('Besichtigung Datum 2')}</label>
                                  <input type="date" className="form-control" name="inspection_date_2" value={managerWizard.inspection_date_2} min={TODAY_DATE} onChange={handleManagerWizardChange} />
                                </div>
                                <div className="col-md-3">
                                  <label className="form-label">{t('Zeit 2')}</label>
                                  <input type="time" className="form-control" name="inspection_time_2" value={managerWizard.inspection_time_2} onChange={handleManagerWizardChange} />
                                </div>
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
                                    <label className="form-label">{t('Fälligkeitsdatum')}</label>
                                    <input type="date" className="form-control" name="due_date" value={managerWizard.due_date} min={TODAY_DATE} onChange={handleManagerWizardChange} />
                                  </div>
                                ) : null}
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
                              </>
                            ) : null}

                            {managerWizard.flow_type === 'direct_order' ? (
                              <>
                                <div className="col-md-6">
                                  <button
                                    type="button"
                                    className={`vergo-order-choice-card h-100 text-start${managerWizard.award_mode === 'direct_award' ? ' is-selected' : ''}`}
                                    onClick={() => handleManagerWizardChange({ target: { name: 'award_mode', value: 'direct_award' } })}
                                  >
                                    <div className="fw-semibold mb-2">{t('Direkt vergeben')}</div>
                                    <div className="text-muted small">{t('Eine Firma auswählen und direkt beauftragen.')}</div>
                                  </button>
                                </div>
                                <div className="col-md-6">
                                  <button
                                    type="button"
                                    className={`vergo-order-choice-card h-100 text-start${managerWizard.award_mode === 'request_quotes' ? ' is-selected' : ''}`}
                                    onClick={() => handleManagerWizardChange({ target: { name: 'award_mode', value: 'request_quotes' } })}
                                  >
                                    <div className="fw-semibold mb-2">{t('Offerten einholen')}</div>
                                    <div className="text-muted small">{t('Mehrere Firmen anfragen und Angebote vergleichen.')}</div>
                                  </button>
                                </div>
                                {managerWizard.award_mode === 'direct_award' ? (
                                  <div className="col-md-12">
                                    <label className="form-label">{t('Kostenrahmen')}</label>
                                    <select className="form-select" name="cost_estimate_range" value={managerWizard.cost_estimate_range} onChange={handleManagerWizardChange}>
                                      <option value="">{t('Kostenrahmen auswählen')}</option>
                                      {COST_ESTIMATE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>{t(option.label)}</option>
                                      ))}
                                    </select>
                                  </div>
                                ) : null}

                                {managerWizard.award_mode === 'request_quotes' ? (
                                  <>
                                    <div className="col-md-6">
                                      <label className="form-label">{t('Priorität')}</label>
                                      <select className="form-select" name="bid_priority" value={managerWizard.bid_priority} onChange={handleManagerWizardChange}>
                                        <option value="">{t('Priorität auswählen')}</option>
                                        {BID_PRIORITY_OPTIONS.map((option) => (
                                          <option key={option.value} value={option.value}>{t(option.label)}</option>
                                        ))}
                                      </select>
                                    </div>

                                    <div className="col-md-6">
                                      <label className="form-label">{t('Angebotsfrist')}</label>
                                      <input type="date" className="form-control" name="bid_deadline_at" value={managerWizard.bid_deadline_at} min={TODAY_DATE} onChange={handleManagerWizardChange} />
                                    </div>
                                  </>
                                ) : null}
                              </>
                            ) : null}
                          </div>
                        ) : null}

                        {managerStep === 5 ? (
                          <div className="row g-4">
                            {managerWizard.flow_type === 'direct_order' && managerWizard.award_mode === 'request_quotes' ? (
                              <div className="col-12">
                                <div className="d-flex align-items-center justify-content-between gap-3 mb-3">
                                  <div>
                                    <h6 className="fw-semibold mb-1">{t('Leistungspositionen')}</h6>
                                    <p className="text-muted small mb-0">{t('Diese Positionen werden öffentlich ausgeschrieben. Anbieter sehen die Arbeit, aber nicht die Preise anderer Firmen.')}</p>
                                  </div>
                                  <button type="button" className="btn btn-light-primary btn-sm" onClick={addQuoteItem}>
                                    <i className="ti ti-plus me-1"></i>
                                    {t('Position hinzufügen')}
                                  </button>
                                </div>

                                <div className="row g-3">
                                  {(managerWizard.quote_items ?? []).map((item) => (
                                    <div className="col-12" key={item.id}>
                                      <div className="border rounded-3 p-3">
                                        <div className="row g-3 align-items-end">
                                          <div className="col-lg-5">
                                            <label className="form-label">{t('Leistung / Position')}</label>
                                            <input
                                              className="form-control"
                                              value={item.label}
                                              onChange={(event) => updateQuoteItem(item.id, 'label', event.target.value)}
                                              placeholder={t('z. B. Steckdose austauschen')}
                                            />
                                          </div>
                                          <div className="col-lg-2">
                                            <label className="form-label">{t('Einheit')}</label>
                                            <input
                                              className="form-control"
                                              value={item.unit}
                                              onChange={(event) => updateQuoteItem(item.id, 'unit', event.target.value)}
                                              placeholder={t('Stück')}
                                            />
                                          </div>
                                          <div className="col-lg-2">
                                            <label className="form-label">{t('Menge')}</label>
                                            <input
                                              type="number"
                                              min="0"
                                              step="0.01"
                                              className="form-control"
                                              value={item.quantity}
                                              onChange={(event) => updateQuoteItem(item.id, 'quantity', event.target.value)}
                                            />
                                          </div>
                                          <div className="col-lg-2">
                                            <label className="form-label">{t('Typ')}</label>
                                            <input className="form-control" value={item.is_custom ? t('Andere') : t('Katalog')} readOnly />
                                          </div>
                                          <div className="col-lg-1">
                                            <button type="button" className="btn btn-light-danger text-danger w-100" onClick={() => removeQuoteItem(item.id)}>
                                              <i className="ti ti-trash"></i>
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            <div className="col-lg-7">
                              <div className="mb-3">
                                <h6 className="fw-semibold mb-1">{t('Firmenauswahl')}</h6>
                                <p className="text-muted small mb-0">
                                  {requiresProviderSelection
                                    ? t('Wählen Sie passende Firmen aus der Liste oder ergänzen Sie eine manuell.')
                                    : t('Die Auswahl ist optional. Sie können den Auftrag auch ohne direkte Firmenzuordnung speichern.')}
                                </p>
                              </div>

                              <div className="mb-3">
                                <label className="form-label">{t('Nach Ort filtern')}</label>
                                <select
                                  className="form-select"
                                  value={providerCityFilter}
                                  onChange={(event) => setProviderCityFilter(event.target.value)}
                                >
                                  <option value="">{t('Alle Orte')}</option>
                                  {providerCityOptions.map((city) => (
                                    <option key={city} value={city}>{city}</option>
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
                                      {t('PLZ / Ort')} ({[provider.postal_code, provider.city].filter(Boolean).join(' ') || '-'})
                                    </div>
                                  </button>
                                ))}
                              </div>
                              {visibleServiceProviders.length === 0 ? (
                                <div className="text-muted small mt-2">{t('Keine Firmen für diesen Ort gefunden.')}</div>
                              ) : null}
                            </div>

                            <div className="col-lg-5">
                              <div className="mb-3">
                                <h6 className="fw-semibold mb-1">{t('Manuelle Firma erfassen')}</h6>
                                <p className="text-muted small mb-0">{t('Optional eine externe Firma mit Kontaktinformationen erfassen.')}</p>
                              </div>

                              <div className="row g-3">
                                <div className="col-12">
                                  <label className="form-label">{t('Firma')}</label>
                                  <input className="form-control" name="manual_provider_company" value={managerWizard.manual_provider_company} onChange={handleManagerWizardChange} />
                                </div>
                                <div className="col-12">
                                  <label className="form-label">{t('Kontaktperson')}</label>
                                  <input className="form-control" name="manual_provider_contact" value={managerWizard.manual_provider_contact} onChange={handleManagerWizardChange} />
                                </div>
                                <div className="col-12">
                                  <label className="form-label">{t('E-Mail')}</label>
                                  <input className="form-control" name="manual_provider_email" value={managerWizard.manual_provider_email} onChange={handleManagerWizardChange} />
                                </div>
                                <div className="col-12">
                                  <label className="form-label">{t('Telefon')}</label>
                                  <input className="form-control" name="manual_provider_phone" value={managerWizard.manual_provider_phone} onChange={handleManagerWizardChange} />
                                </div>
                              </div>
                            </div>
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
                              {properties.map((property) => (
                                <option key={property.id} value={property.id}>
                                  {property.li_number} - {property.title}
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
                            <label className="form-label">{t('Fälligkeitsdatum')}</label>
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

                    {isManagerCreateFlow ? (
                      <>
                        {managerStep > 1 ? (
                          <button type="button" className="btn btn-light-primary" onClick={handleManagerPreviousStep}>
                            {t('Zurück')}
                          </button>
                        ) : null}

                        {managerStep < 5 ? (
                          <button type="button" className="btn btn-primary" onClick={handleManagerNextStep}>
                            {t('Weiter')}
                          </button>
                        ) : (
                          <button type="submit" className="btn btn-primary" disabled={isSaving}>
                            {isSaving ? t('Wird gespeichert...') : t('Auftrag erstellen')}
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
          {isModalOpen ? <div className="modal-backdrop fade show"></div> : null}
        </>
      ) : null}
    </PageContent>
  )
}

export default OrdersPage
