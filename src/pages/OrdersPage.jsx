import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageContent from '../components/PageContent'
import { useAuth } from '../context/AuthContext'
import { confirmDelete, showDeleteSuccess } from '../lib/alerts'
import { api } from '../lib/api'
import { formatStatusLabel, getStatusBadgeClass } from '../lib/tableStatus'
import { getOptionLabel, JOB_TYPE_OPTIONS } from '../lib/vergoOptions'

const initialForm = {
  property_id: '',
  property_object_id: '',
  requester_name: '',
  requester_email: '',
  title: '',
  service_type: '',
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

const TRADE_LINE_ITEM_LIBRARY = {
  cleaning: [
    { label: 'Treppenhaus reinigen', unit: 'Einsatz', quantity: 1, source: 'catalog' },
    { label: 'Tiefgarage reinigen', unit: 'Einsatz', quantity: 1, source: 'catalog' },
    { label: 'Fensterflächen reinigen', unit: 'Stück', quantity: 10, source: 'catalog' },
  ],
  electrical: [
    { label: 'Unterverteilung prüfen', unit: 'Stück', quantity: 1, source: 'catalog' },
    { label: 'Leuchtmittel ersetzen', unit: 'Stück', quantity: 10, source: 'catalog' },
    { label: 'Störung beheben', unit: 'Einsatz', quantity: 1, source: 'catalog' },
  ],
  plumbing: [
    { label: 'Leckage prüfen', unit: 'Einsatz', quantity: 1, source: 'catalog' },
    { label: 'Armatur austauschen', unit: 'Stück', quantity: 1, source: 'catalog' },
    { label: 'Leitung spülen', unit: 'Meter', quantity: 5, source: 'catalog' },
  ],
  flooring: [
    { label: 'Altbelag entfernen', unit: 'm²', quantity: 20, source: 'catalog' },
    { label: 'Neuen Belag verlegen', unit: 'm²', quantity: 20, source: 'catalog' },
    { label: 'Sockelleisten montieren', unit: 'Meter', quantity: 20, source: 'catalog' },
  ],
}

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

function buildManagerWorkflowMeta(wizard, selectedObjects) {
  return {
    flow_type: wizard.flow_type,
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
      selected_provider_ids: wizard.selected_provider_ids.map((id) => Number(id)),
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
  const [orders, setOrders] = useState([])
  const [properties, setProperties] = useState([])
  const [objects, setObjects] = useState([])
  const [serviceProviders, setServiceProviders] = useState([])
  const [form, setForm] = useState(initialForm)
  const [managerWizard, setManagerWizard] = useState(getInitialManagerWizard())
  const [managerStep, setManagerStep] = useState(1)
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
    }))
  }

  function handleManagerWizardChange(event) {
    const { name, value } = event.target

    setManagerWizard((current) => ({
      ...current,
      [name]: value,
      ...(name === 'property_id' ? { selected_object_ids: [] } : {}),
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
    const baseItems = TRADE_LINE_ITEM_LIBRARY[serviceType] ?? [
      { label: 'Weitere Position', unit: 'Stück', quantity: 1, source: 'catalog' },
    ]

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
      const exists = current.selected_provider_ids.includes(providerId)

      return {
        ...current,
        selected_provider_ids: exists
          ? current.selected_provider_ids.filter((id) => id !== providerId)
          : [...current.selected_provider_ids, providerId],
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
    setIsModalOpen(true)
  }

  function validateManagerStep(step = managerStep) {
    if (step === 1) {
      if (!managerWizard.property_id) {
        setError('Bitte wählen Sie eine Liegenschaft aus.')
        return false
      }

      if (managerAvailableObjects.length > 0 && managerWizard.selected_object_ids.length === 0) {
        setError('Bitte wählen Sie mindestens ein Objekt aus.')
        return false
      }
    }

    if (step === 2 && !managerWizard.flow_type) {
      setError('Bitte wählen Sie zwischen Besichtigung und Auftragserteilung.')
      return false
    }

    if (step === 3) {
      if (!managerWizard.service_type) {
        setError('Bitte wählen Sie ein Gewerk aus.')
        return false
      }

      if (!managerWizard.title.trim()) {
        setError('Bitte geben Sie eine Kurzbeschreibung ein.')
        return false
      }

      if (managerWizard.flow_type === 'inspection') {
        if (!managerWizard.inspection_date_1 || !managerWizard.inspection_time_1) {
          setError('Bitte geben Sie mindestens eine bevorzugte Besichtigung an.')
          return false
        }

        if (!managerWizard.onsite_first_name.trim() || !managerWizard.onsite_last_name.trim()) {
          setError('Bitte hinterlegen Sie eine Kontaktperson vor Ort.')
          return false
        }

        if (!managerWizard.onsite_phone.trim() || !managerWizard.onsite_email.trim()) {
          setError('Bitte hinterlegen Sie Telefon und E-Mail der Kontaktperson.')
          return false
        }
      }

      if (managerWizard.flow_type === 'direct_order' && managerWizard.completion_mode === 'fixed_date' && !managerWizard.due_date) {
        setError('Bitte geben Sie ein gewünschtes Ausführungsdatum an.')
        return false
      }
    }

    if (step === 4) {
      if (managerWizard.flow_type === 'inspection' && !managerWizard.inspection_request_mode) {
        setError('Bitte wählen Sie direkte Besichtigungsanfrage oder öffentliche Ausschreibung.')
        return false
      }

      if (managerWizard.flow_type === 'direct_order') {
        if (!managerWizard.award_mode) {
          setError('Bitte wählen Sie Direktvergabe oder Offertenanfrage.')
          return false
        }

        if (managerWizard.award_mode === 'direct_award' && !managerWizard.cost_estimate_range) {
          setError('Bitte wählen Sie einen Kostenrahmen aus.')
          return false
        }

        if (managerWizard.award_mode === 'request_quotes') {
          if (!managerWizard.bid_priority) {
            setError('Bitte wählen Sie eine Priorität für die Offertenanfrage.')
            return false
          }

          if (!managerWizard.bid_deadline_at) {
            setError('Bitte geben Sie eine Angebotsfrist an.')
            return false
          }
        }
      }
    }

    if (step === 5) {
      if (managerWizard.flow_type === 'direct_order' && managerWizard.award_mode === 'request_quotes') {
        const validQuoteItems = (managerWizard.quote_items ?? []).filter((item) => item.label.trim())

        if (validQuoteItems.length === 0) {
          setError('Bitte erfassen Sie mindestens eine Leistungsposition für die öffentliche Ausschreibung.')
          return false
        }
      }

      const requiresProviderSelection = (
        (managerWizard.flow_type === 'inspection' && managerWizard.inspection_request_mode === 'direct')
        || (managerWizard.flow_type === 'direct_order' && managerWizard.award_mode === 'direct_award')
      )

      if (requiresProviderSelection && managerWizard.selected_provider_ids.length === 0 && !hasManualProviderSelection(managerWizard)) {
        setError('Bitte wählen Sie mindestens eine Firma aus oder erfassen Sie eine manuell.')
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
          service_type: managerWizard.service_type,
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
              .map(({ id, ...item }) => item)
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
      setError('Bitte wählen Sie eine Immobilie aus.')
      setIsSaving(false)
      return
    }

    if (!form.title.trim()) {
      setError('Ein Auftragstitel ist erforderlich.')
      setIsSaving(false)
      return
    }

    if (!form.service_type) {
      setError('Bitte wählen Sie einen Auftragstyp aus.')
      setIsSaving(false)
      return
    }

    if (availableObjects.length > 0 && !form.property_object_id) {
      setError('Bitte wählen Sie ein Immobilienobjekt für diesen Auftrag aus.')
      setIsSaving(false)
      return
    }

    if (!isManager && form.requester_email.trim()) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

      if (!emailPattern.test(form.requester_email.trim())) {
        setError('Bitte geben Sie eine gültige E-Mail-Adresse des Anfragenden ein.')
        setIsSaving(false)
        return
      }
    }

    try {
      const payload = {
        ...form,
        property_id: Number(form.property_id),
        property_object_id: form.property_object_id ? Number(form.property_object_id) : null,
        requester_name: form.requester_name || null,
        requester_email: form.requester_email || null,
        service_type: form.service_type || null,
        description: form.description || null,
        due_date: form.due_date || null,
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

  function handleEdit(order) {
    setEditingOrderId(order.id)
    setForm({
      property_id: String(order.property_id ?? order.property?.id ?? ''),
      property_object_id: order.property_object_id ? String(order.property_object_id) : '',
      requester_name: order.requester_name || '',
      requester_email: order.requester_email || '',
      title: order.title || '',
      service_type: order.service_type || '',
      description: order.description || '',
      status: order.status || 'open',
      due_date: order.due_date || '',
    })
    setError('')
    setIsModalOpen(true)
  }

  function handleCloseModal() {
    setEditingOrderId(null)
    setForm({
      ...initialForm,
      property_id: isManager ? String(user?.property?.id ?? properties[0]?.id ?? '') : '',
    })
    setManagerWizard(getInitialManagerWizard(String(user?.property?.id ?? properties[0]?.id ?? '')))
    setManagerStep(1)
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

  return (
    <PageContent
      title="Aufträge"
      subtitle={
        isOwner
          ? 'Überprüfen Sie die vorausgewählten Aufträge und die endgültigen Entscheidungen des Eigentümers für Ihre zugewiesenen Immobilien.'
          : canCreateOrders
            ? 'Erstellen und verwalten Sie Aufträge für Immobilien, bevor Anbieter mit dem Bieten beginnen.'
            : isManager
              ? 'Prüfen Sie alle Aufträge Ihrer zugewiesenen Immobilie und verfolgen Sie den aktuellen Stand.'
              : 'Nur-Lese-Ansicht des Auftragsablaufs auf der gesamten Plattform.'
      }
      breadcrumbs={[
        { label: 'Armaturenbrett', href: '/dashboard' },
        { label: 'Aufträge' },
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
                      aria-label="Suche"
                      className="form-control"
                      name="search"
                      value={filters.search}
                      onChange={handleFilterChange}
                      placeholder="Nach Titel, Immobilie, Objekt, Anfragendem oder Auftragstyp suchen"
                    />
                  </div>
                </div>

                <div className="col-xl-3 col-lg-3 col-md-12">
                  <div className="vergo-select-input-wrap">
                    <i className="ti ti-adjustments vergo-select-input-icon" aria-hidden="true"></i>
                    <select aria-label="Status" className="form-select" name="status" value={filters.status} onChange={handleFilterChange}>
                      <option value="">All Status</option>
                      <option value="draft">Entwurf</option>
                      <option value="open">Offen</option>
                      <option value="in_review">In Prüfung</option>
                      <option value="awaiting_owner_approval">Warten auf Eigentümerfreigabe</option>
                      <option value="approved">Genehmigt</option>
                      <option value="completed">Abgeschlossen</option>
                      <option value="closed">Geschlossen</option>
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
                      Zurücksetzen
                    </button>

                    {canCreateOrders ? (
                      <button type="button" className="btn btn-primary text-nowrap" onClick={openCreateModal}>
                        <i className="ti ti-plus me-1"></i>
                        Auftrag erstellen
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              {isLoading ? <p className="text-muted mb-0">Aufträge werden geladen...</p> : null}
              {!isLoading && error && !canManageOrders ? <div className="alert alert-danger py-2">{error}</div> : null}

              {!isLoading ? (
                <div className="table-responsive rounded-2 mb-0 vergo-table-scroll">
                  <table className="table border-none text-nowrap customize-table mb-0 align-middle">
                    <thead className="text-dark fs-4">
                      <tr>
                        <th><h6 className="fs-4 fw-semibold mb-0">Titel</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">Immobilie</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">Objekt</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">Anfragender</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">Fälligkeitsdatum</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">Status</h6></th>
                        {showActionColumn ? <th width="170"><h6 className="fs-4 fw-semibold mb-0">Aktion</h6></th> : null}
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
                            <div>{order.requester_name || '-'}</div>
                            <div className="text-muted">{order.requester_email || '-'}</div>
                          </td>

                          <td>{order.due_date || '-'}</td>

                          <td>
                            <span className={getStatusBadgeClass(order.status)}>
                              {formatStatusLabel(order.status)}
                            </span>
                          </td>

                          {showActionColumn ? (
                            <td>
                              <div className="table-action-group">
                                <Link
                                  to={`/orders/${order.id}`}
                                  className="table-action-btn table-action-edit"
                                  title="Auftragsdetails anzeigen"
                                >
                                  <i className="ti ti-eye"></i>
                                </Link>

                                {canEditOrders || canDeleteOrders ? (
                                  <>
                                    {canEditOrders && String(order.requester_email || '').toLowerCase() === String(user?.email || '').toLowerCase() ? (
                                      <button
                                        type="button"
                                        className="table-action-btn table-action-edit"
                                        onClick={() => handleEdit(order)}
                                        title="Auftrag bearbeiten"
                                      >
                                        <i className="ti ti-pencil"></i>
                                      </button>
                                    ) : null}

                                    {canDeleteOrders && String(order.requester_email || '').toLowerCase() === String(user?.email || '').toLowerCase() ? (
                                      <button
                                        type="button"
                                        className="table-action-btn table-action-delete"
                                        onClick={() => handleDelete(order.id)}
                                        title="Auftrag löschen"
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
                          <td colSpan={showActionColumn ? 7 : 6} className="text-center text-muted py-4">
                            Keine Aufträge gefunden.
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
                      {editingOrderId ? 'Auftrag bearbeiten' : isManagerCreateFlow ? 'Auftrag erfassen' : 'Auftrag erstellen'}
                    </h5>
                    {isManagerCreateFlow ? (
                      <p className="text-muted mb-0">Schritt {managerStep} von {MANAGER_ORDER_STEPS.length}</p>
                    ) : null}
                  </div>
                  <button type="button" className="btn-close" aria-label="Schließen" onClick={handleCloseModal}></button>
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
                                <div className="vergo-order-stepper-title">{step.label}</div>
                                <div className="vergo-order-stepper-helper">{step.helper}</div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {managerStep === 1 ? (
                          <div className="row g-3">
                            <div className="col-md-12">
                              <label className="form-label">Liegenschaft</label>
                              <select className="form-select" name="property_id" value={managerWizard.property_id} onChange={handleManagerWizardChange} disabled>
                                <option value="">Liegenschaft auswählen</option>
                                {properties.map((property) => (
                                  <option key={property.id} value={property.id}>
                                    {property.li_number} - {property.title}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="col-12">
                              <label className="form-label">Betroffene Objekte</label>
                              <div className="text-muted small mb-3">
                                Wählen Sie hier die betroffenen Objekte aus. Mehrfachauswahl ist möglich.
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
                              {managerAvailableObjects.length === 0 ? <div className="text-muted small mt-2">Für diese Liegenschaft sind noch keine Objekte vorhanden.</div> : null}
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
                                <div className="fw-semibold mb-2">Besichtigung planen</div>
                                <div className="text-muted small">Anfrage mit bevorzugten Terminen und Kontaktperson vor Ort erfassen.</div>
                              </button>
                            </div>
                            <div className="col-md-6">
                              <button
                                type="button"
                                className={`vergo-order-choice-card h-100 text-start${managerWizard.flow_type === 'direct_order' ? ' is-selected' : ''}`}
                                onClick={() => handleManagerWizardChange({ target: { name: 'flow_type', value: 'direct_order' } })}
                              >
                                <div className="fw-semibold mb-2">Auftrag vergeben</div>
                                <div className="text-muted small">Direkte Vergabe oder Offertenprozess mit Kostenrahmen vorbereiten.</div>
                              </button>
                            </div>
                          </div>
                        ) : null}

                        {managerStep === 3 ? (
                          <div className="row g-3">
                            <div className="col-md-6">
                              <label className="form-label">Gewerk</label>
                              <select
                                className="form-select"
                                name="service_type"
                                value={managerWizard.service_type}
                                onChange={(event) => handleManagerServiceTypeChange(event.target.value)}
                              >
                                <option value="">Gewerk auswählen</option>
                                {JOB_TYPE_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                            </div>
                            <div className="col-md-6">
                              <label className="form-label">Kurzbeschreibung</label>
                              <input className="form-control" name="title" value={managerWizard.title} onChange={handleManagerWizardChange} placeholder="z. B. Parkett ersetzen" />
                            </div>
                            <div className="col-12">
                              <label className="form-label">Detaillierte Beschreibung</label>
                              <textarea className="form-control" rows="4" name="description" value={managerWizard.description} onChange={handleManagerWizardChange}></textarea>
                            </div>

                            {managerWizard.flow_type === 'inspection' ? (
                              <>
                                <div className="col-md-3">
                                  <label className="form-label">Besichtigung Datum 1</label>
                                  <input type="date" className="form-control" name="inspection_date_1" value={managerWizard.inspection_date_1} onChange={handleManagerWizardChange} />
                                </div>
                                <div className="col-md-3">
                                  <label className="form-label">Zeit 1</label>
                                  <input type="time" className="form-control" name="inspection_time_1" value={managerWizard.inspection_time_1} onChange={handleManagerWizardChange} />
                                </div>
                                <div className="col-md-3">
                                  <label className="form-label">Besichtigung Datum 2</label>
                                  <input type="date" className="form-control" name="inspection_date_2" value={managerWizard.inspection_date_2} onChange={handleManagerWizardChange} />
                                </div>
                                <div className="col-md-3">
                                  <label className="form-label">Zeit 2</label>
                                  <input type="time" className="form-control" name="inspection_time_2" value={managerWizard.inspection_time_2} onChange={handleManagerWizardChange} />
                                </div>

                                <div className="col-md-4">
                                  <label className="form-label">Firma vor Ort</label>
                                  <input className="form-control" name="onsite_company" value={managerWizard.onsite_company} onChange={handleManagerWizardChange} />
                                </div>
                                <div className="col-md-4">
                                  <label className="form-label">Vorname</label>
                                  <input className="form-control" name="onsite_first_name" value={managerWizard.onsite_first_name} onChange={handleManagerWizardChange} />
                                </div>
                                <div className="col-md-4">
                                  <label className="form-label">Nachname</label>
                                  <input className="form-control" name="onsite_last_name" value={managerWizard.onsite_last_name} onChange={handleManagerWizardChange} />
                                </div>
                                <div className="col-md-6">
                                  <label className="form-label">Telefon</label>
                                  <input className="form-control" name="onsite_phone" value={managerWizard.onsite_phone} onChange={handleManagerWizardChange} />
                                </div>
                                <div className="col-md-6">
                                  <label className="form-label">E-Mail</label>
                                  <input className="form-control" name="onsite_email" value={managerWizard.onsite_email} onChange={handleManagerWizardChange} />
                                </div>
                              </>
                            ) : null}

                            {managerWizard.flow_type === 'direct_order' ? (
                              <>
                                <div className="col-md-6">
                                  <label className="form-label">Gewünschte Fertigstellung</label>
                                  <select className="form-select" name="completion_mode" value={managerWizard.completion_mode} onChange={handleManagerWizardChange}>
                                    <option value="fixed_date">Fixes Datum</option>
                                    <option value="asap">So schnell wie möglich</option>
                                  </select>
                                </div>
                                {managerWizard.completion_mode === 'fixed_date' ? (
                                  <div className="col-md-6">
                                    <label className="form-label">Fälligkeitsdatum</label>
                                    <input type="date" className="form-control" name="due_date" value={managerWizard.due_date} onChange={handleManagerWizardChange} />
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
                                    <div className="fw-semibold mb-2">Besichtigung direkt anfragen</div>
                                    <div className="text-muted small">Firma gezielt auswählen und direkt benachrichtigen.</div>
                                  </button>
                                </div>
                                <div className="col-md-6">
                                  <button
                                    type="button"
                                    className={`vergo-order-choice-card h-100 text-start${managerWizard.inspection_request_mode === 'public' ? ' is-selected' : ''}`}
                                    onClick={() => handleManagerWizardChange({ target: { name: 'inspection_request_mode', value: 'public' } })}
                                  >
                                    <div className="fw-semibold mb-2">Öffentliche Besichtigungsanfrage</div>
                                    <div className="text-muted small">Anfrage öffentlich ausschreiben und Anmeldungen sammeln.</div>
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
                                    <div className="fw-semibold mb-2">Direkt vergeben</div>
                                    <div className="text-muted small">Eine Firma auswählen und direkt beauftragen.</div>
                                  </button>
                                </div>
                                <div className="col-md-6">
                                  <button
                                    type="button"
                                    className={`vergo-order-choice-card h-100 text-start${managerWizard.award_mode === 'request_quotes' ? ' is-selected' : ''}`}
                                    onClick={() => handleManagerWizardChange({ target: { name: 'award_mode', value: 'request_quotes' } })}
                                  >
                                    <div className="fw-semibold mb-2">Offerten einholen</div>
                                    <div className="text-muted small">Mehrere Firmen anfragen und Angebote vergleichen.</div>
                                  </button>
                                </div>
                                {managerWizard.award_mode === 'direct_award' ? (
                                  <div className="col-md-12">
                                    <label className="form-label">Kostenrahmen</label>
                                    <select className="form-select" name="cost_estimate_range" value={managerWizard.cost_estimate_range} onChange={handleManagerWizardChange}>
                                      <option value="">Kostenrahmen auswählen</option>
                                      {COST_ESTIMATE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                ) : null}

                                {managerWizard.award_mode === 'request_quotes' ? (
                                  <>
                                    <div className="col-md-6">
                                      <label className="form-label">Priorität</label>
                                      <select className="form-select" name="bid_priority" value={managerWizard.bid_priority} onChange={handleManagerWizardChange}>
                                        <option value="">Priorität auswählen</option>
                                        {BID_PRIORITY_OPTIONS.map((option) => (
                                          <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                      </select>
                                    </div>

                                    <div className="col-md-6">
                                      <label className="form-label">Angebotsfrist</label>
                                      <input type="date" className="form-control" name="bid_deadline_at" value={managerWizard.bid_deadline_at} onChange={handleManagerWizardChange} />
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
                                    <h6 className="fw-semibold mb-1">Leistungspositionen</h6>
                                    <p className="text-muted small mb-0">Diese Positionen werden öffentlich ausgeschrieben. Anbieter sehen die Arbeit, aber nicht die Preise anderer Firmen.</p>
                                  </div>
                                  <button type="button" className="btn btn-light-primary btn-sm" onClick={addQuoteItem}>
                                    <i className="ti ti-plus me-1"></i>
                                    Position hinzufügen
                                  </button>
                                </div>

                                <div className="row g-3">
                                  {(managerWizard.quote_items ?? []).map((item) => (
                                    <div className="col-12" key={item.id}>
                                      <div className="border rounded-3 p-3">
                                        <div className="row g-3 align-items-end">
                                          <div className="col-lg-5">
                                            <label className="form-label">Leistung / Position</label>
                                            <input
                                              className="form-control"
                                              value={item.label}
                                              onChange={(event) => updateQuoteItem(item.id, 'label', event.target.value)}
                                              placeholder="z. B. Steckdose austauschen"
                                            />
                                          </div>
                                          <div className="col-lg-2">
                                            <label className="form-label">Einheit</label>
                                            <input
                                              className="form-control"
                                              value={item.unit}
                                              onChange={(event) => updateQuoteItem(item.id, 'unit', event.target.value)}
                                              placeholder="Stück"
                                            />
                                          </div>
                                          <div className="col-lg-2">
                                            <label className="form-label">Menge</label>
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
                                            <label className="form-label">Typ</label>
                                            <input className="form-control" value={item.is_custom ? 'Andere' : 'Katalog'} readOnly />
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

                            {managerWizard.flow_type === 'direct_order' && managerWizard.award_mode === 'request_quotes' ? null : (
                            <div className="col-lg-7">
                              <div className="mb-3">
                                <h6 className="fw-semibold mb-1">Firmenauswahl</h6>
                                <p className="text-muted small mb-0">
                                  {requiresProviderSelection
                                    ? 'Wählen Sie passende Firmen aus der Liste oder ergänzen Sie eine manuell.'
                                    : 'Die Auswahl ist optional. Sie können den Auftrag auch ohne direkte Firmenzuordnung speichern.'}
                                </p>
                              </div>

                              <div className="vergo-order-provider-grid">
                                {serviceProviders.map((provider) => (
                                  <button
                                    key={provider.id}
                                    type="button"
                                    className={`vergo-order-choice-card text-start${managerWizard.selected_provider_ids.includes(provider.id) ? ' is-selected' : ''}`}
                                    onClick={() => toggleProviderSelection(provider.id)}
                                  >
                                    <div className="fw-semibold">{provider.company_name}</div>
                                    <div className="text-muted small">{provider.contact_name || 'Kontaktperson fehlt'}</div>
                                    <div className="text-muted small">{provider.contact_email || '-'}</div>
                                  </button>
                                ))}
                              </div>
                            </div>
                            )}

                            {managerWizard.flow_type === 'direct_order' && managerWizard.award_mode === 'request_quotes' ? null : (
                            <div className="col-lg-5">
                              <div className="mb-3">
                                <h6 className="fw-semibold mb-1">Manuelle Firma erfassen</h6>
                                <p className="text-muted small mb-0">Optional eine externe Firma mit Kontaktinformationen erfassen.</p>
                              </div>

                              <div className="row g-3">
                                <div className="col-12">
                                  <label className="form-label">Firma</label>
                                  <input className="form-control" name="manual_provider_company" value={managerWizard.manual_provider_company} onChange={handleManagerWizardChange} />
                                </div>
                                <div className="col-12">
                                  <label className="form-label">Kontaktperson</label>
                                  <input className="form-control" name="manual_provider_contact" value={managerWizard.manual_provider_contact} onChange={handleManagerWizardChange} />
                                </div>
                                <div className="col-12">
                                  <label className="form-label">E-Mail</label>
                                  <input className="form-control" name="manual_provider_email" value={managerWizard.manual_provider_email} onChange={handleManagerWizardChange} />
                                </div>
                                <div className="col-12">
                                  <label className="form-label">Telefon</label>
                                  <input className="form-control" name="manual_provider_phone" value={managerWizard.manual_provider_phone} onChange={handleManagerWizardChange} />
                                </div>
                              </div>
                            </div>
                            )}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div className="row">
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Immobilie</label>
                            <select
                              className="form-select"
                              name="property_id"
                              value={form.property_id}
                              onChange={handleChange}
                              disabled={isManager}
                            >
                              <option value="">Immobilie auswählen</option>
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
                            <label className="form-label">Immobilienobjekt</label>
                            <select
                              className="form-select"
                              name="property_object_id"
                              value={form.property_object_id}
                              onChange={handleChange}
                            >
                              <option value="">Objekt auswählen</option>
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
                            <label className="form-label">Auftragstitel</label>
                            <input className="form-control" name="title" value={form.title} onChange={handleChange} />
                          </div>
                        </div>

                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Auftragstyp</label>
                            <select className="form-select" name="service_type" value={form.service_type} onChange={handleChange}>
                              <option value="">Auftragstyp auswählen</option>
                              {JOB_TYPE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Fälligkeitsdatum</label>
                            <input type="date" className="form-control" name="due_date" value={form.due_date} onChange={handleChange} />
                          </div>
                        </div>

                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Status</label>
                            <input className="form-control" value={formatStatusLabel(form.status || 'open')} readOnly />
                          </div>
                        </div>

                        <div className="col-12">
                          <div className="mb-0">
                            <label className="form-label">Beschreibung</label>
                            <textarea className="form-control" rows="4" name="description" value={form.description} onChange={handleChange}></textarea>
                          </div>
                        </div>
                      </div>
                    )}

                    {error ? <div className="alert alert-danger py-2 mt-3 mb-0">{error}</div> : null}
                  </div>

                  <div className="modal-footer">
                    <button type="button" className="btn btn-light-danger text-danger" onClick={handleCloseModal}>
                      Abbrechen
                    </button>

                    {isManagerCreateFlow ? (
                      <>
                        {managerStep > 1 ? (
                          <button type="button" className="btn btn-light-primary" onClick={handleManagerPreviousStep}>
                            Zurück
                          </button>
                        ) : null}

                        {managerStep < 5 ? (
                          <button type="button" className="btn btn-primary" onClick={handleManagerNextStep}>
                            Weiter
                          </button>
                        ) : (
                          <button type="submit" className="btn btn-primary" disabled={isSaving}>
                            {isSaving ? 'Wird gespeichert...' : 'Auftrag erstellen'}
                          </button>
                        )}
                      </>
                    ) : (
                      <button type="submit" className="btn btn-primary" disabled={isSaving}>
                        {isSaving ? 'Wird gespeichert...' : editingOrderId ? 'Auftrag aktualisieren' : 'Auftrag erstellen'}
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
