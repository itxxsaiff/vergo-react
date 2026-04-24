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

function OrdersPage() {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [properties, setProperties] = useState([])
  const [objects, setObjects] = useState([])
  const [form, setForm] = useState(initialForm)
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

  async function loadData() {
    setIsLoading(true)
    setError('')

    try {
      const [ordersResponse, propertiesResponse, objectsResponse] = await Promise.all([
        api.getOrders(),
        api.getProperties(),
        api.getPropertyObjects(),
      ])

      setOrders(ordersResponse.data ?? [])
      setProperties(propertiesResponse.data ?? [])
      setObjects(objectsResponse.data ?? [])
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

  function openCreateModal() {
    setEditingOrderId(null)
    setError('')
    setForm({
      ...initialForm,
      property_id: isManager ? String(user?.property?.id ?? properties[0]?.id ?? '') : '',
    })
    setIsModalOpen(true)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setIsSaving(true)
    setError('')

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

      setForm(initialForm)
      setEditingOrderId(null)
      setIsModalOpen(false)
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
            <div className="px-4 py-3 border-bottom d-flex align-items-center justify-content-between gap-3">
              <h5 className="card-title fw-semibold mb-0 lh-sm">Auftragsliste</h5>
              {canCreateOrders ? (
                <button type="button" className="btn btn-primary" onClick={openCreateModal}>
                  <i className="ti ti-plus me-1"></i>
                  Auftrag erstellen
                </button>
              ) : null}
            </div>

            <div className="card-body p-4">
              <div className="row g-3 mb-4">
                <div className="col-md-7">
                  <label className="form-label">Suche</label>
                  <input
                    className="form-control"
                    name="search"
                    value={filters.search}
                    onChange={handleFilterChange}
                    placeholder="Nach Titel, Immobilie, Objekt, Anfragendem oder Auftragstyp suchen"
                  />
                </div>

                <div className="col-md-3">
                  <label className="form-label">Status</label>
                  <select className="form-select" name="status" value={filters.status} onChange={handleFilterChange}>
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

                <div className="col-md-2 d-flex align-items-end">
                  <button
                    type="button"
                    className="btn btn-light-primary w-100"
                    onClick={() => setFilters({ search: '', status: '' })}
                  >
                    Zurücksetzen
                  </button>
                </div>
              </div>

              {isLoading ? <p className="text-muted mb-0">Aufträge werden geladen...</p> : null}
              {!isLoading && error && !canManageOrders ? <div className="alert alert-danger py-2">{error}</div> : null}

              {!isLoading ? (
                <div className="table-responsive rounded-2 mb-0 vergo-table-scroll">
                  <table className="table border text-nowrap customize-table mb-0 align-middle">
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

                          <td>{order.property_object?.name ?? '-'}</td>

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
            <div className="modal-dialog modal-dialog-scrollable modal-lg">
              <div className="modal-content rounded-1">
                <div className="modal-header border-bottom">
                  <h5 className="modal-title">
                    {editingOrderId ? 'Auftrag bearbeiten' : 'Auftrag erstellen'}
                  </h5>
                  <button type="button" className="btn-close" aria-label="Schließen" onClick={handleCloseModal}></button>
                </div>

                <form onSubmit={handleSubmit}>
                  <div className="modal-body">
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

                    {error ? <div className="alert alert-danger py-2 mt-3 mb-0">{error}</div> : null}
                  </div>

                  <div className="modal-footer">
                    <button type="button" className="btn btn-light-danger text-danger" onClick={handleCloseModal}>
                      Abbrechen
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={isSaving}>
                      {isSaving ? 'Wird gespeichert...' : editingOrderId ? 'Auftrag aktualisieren' : 'Auftrag erstellen'}
                    </button>
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
