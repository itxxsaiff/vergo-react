import { useEffect, useState } from 'react'
import PageContent from '../components/PageContent'
import { confirmDelete, showDeleteSuccess } from '../lib/alerts'
import { api } from '../lib/api'
import { formatStatusLabel, getStatusBadgeClass } from '../lib/tableStatus'

const initialForm = {
  property_id: '',
  name: '',
  email: '',
}

function PropertyManagersPage() {
  const [managers, setManagers] = useState([])
  const [properties, setProperties] = useState([])
  const [filters, setFilters] = useState({ search: '', status: '' })
  const [editingManager, setEditingManager] = useState(null)
  const [form, setForm] = useState(initialForm)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [])

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

  async function loadData() {
    setIsLoading(true)
    setError('')

    try {
      const [managersResponse, propertiesResponse] = await Promise.all([
        api.getPropertyManagers(),
        api.getProperties(),
      ])
      setManagers(managersResponse.data ?? [])
      setProperties(propertiesResponse.data ?? [])
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setIsLoading(false)
    }
  }

  function handleFilterChange(event) {
    const { name, value } = event.target
    setFilters((current) => ({ ...current, [name]: value }))
  }

  function handleChange(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  function openCreateModal() {
    setEditingManager(null)
    setForm(initialForm)
    setError('')
    setIsModalOpen(true)
  }

  function handleEdit(manager) {
    setEditingManager(manager)
    setForm({
      property_id: String(manager.property?.id ?? manager.property_id ?? ''),
      name: manager.name || '',
      email: manager.email || '',
    })
    setError('')
    setIsModalOpen(true)
  }

  function closeModal() {
    setEditingManager(null)
    setForm(initialForm)
    setError('')
    setIsModalOpen(false)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setIsSaving(true)
    setError('')

    try {
      if (editingManager) {
        const response = await api.updatePropertyManager(editingManager.id, { name: form.name || null })
        setManagers((current) => current.map((manager) => (manager.id === editingManager.id ? response.data : manager)))
      } else {
        const response = await api.createPropertyManager({
          property_id: Number(form.property_id),
          name: form.name || null,
          email: form.email.trim().toLowerCase(),
        })
        setManagers((current) => [response.data, ...current])
      }

      closeModal()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(managerId) {
    const shouldDelete = await confirmDelete('property manager')
    if (!shouldDelete) return

    try {
      await api.deletePropertyManager(managerId)
      setManagers((current) => current.filter((manager) => manager.id !== managerId))
      showDeleteSuccess('property manager')
      if (editingManager?.id === managerId) closeModal()
    } catch (deleteError) {
      setError(deleteError.message)
    }
  }

  const filteredManagers = managers.filter((manager) => {
    const searchValue = [
      manager.name,
      manager.email,
      manager.property?.li_number,
      manager.property?.title,
    ].filter(Boolean).join(' ').toLowerCase()
    const searchMatch = !filters.search || searchValue.includes(filters.search.toLowerCase())
    const statusMatch = !filters.status || 'active' === filters.status.toLowerCase()
    return searchMatch && statusMatch
  })

  return (
    <PageContent
      title="Immobilienverwalter"
      subtitle="Verwalten Sie OTP-basierte Immobilienverwalter, die mit Li-Nummern verknüpft sind, sowie deren Auftragshistorie."
      breadcrumbs={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Immobilienverwalter' },
      ]}
    >
      <div className="card">
        <div className="px-4 py-3 border-bottom">
          <h5 className="card-title fw-semibold mb-0 lh-sm">Liste der Immobilienverwalter</h5>
        </div>
        <div className="card-body p-4">
          <div className="row g-3 mb-4 vergo-filter-bar vergo-filter-bar-compact">
            <div className="col-xl-5 col-lg-6 col-md-12">
              <label className="form-label">Suche</label>
              <div className="vergo-search-input-wrap">
                <i className="ti ti-search vergo-search-input-icon" aria-hidden="true"></i>
                <input
                  aria-label="Suche"
                  className="form-control"
                  name="search"
                  value={filters.search}
                  onChange={handleFilterChange}
                  placeholder="Nach Name, E-Mail, Li-Nummer oder Immobilie suchen"
                />
              </div>
            </div>
            <div className="col-xl-3 col-lg-6 col-md-6">
              <label className="form-label">Status</label>
              <div className="vergo-select-input-wrap">
                <i className="ti ti-adjustments vergo-select-input-icon" aria-hidden="true"></i>
                <select aria-label="Status" className="form-select" name="status" value={filters.status} onChange={handleFilterChange}>
                  <option value="">All Status</option>
                  <option value="active">Aktiv</option>
                </select>
              </div>
            </div>
            <div className="col-xl-4 col-lg-12 col-md-6">
              <div className="d-flex align-items-end justify-content-xl-end gap-2 flex-nowrap vergo-action-buttons">
                <button type="button" className="btn btn-light-primary vergo-filter-reset-btn text-nowrap" onClick={() => setFilters({ search: '', status: '' })}>
                  <i className="ti ti-refresh me-1" aria-hidden="true"></i>
                  Zurücksetzen
                </button>
                <button type="button" className="btn btn-primary text-nowrap" onClick={openCreateModal}>
                  <i className="ti ti-plus me-1"></i>
                  Immobilienverwalter erstellen
                </button>
              </div>
            </div>
          </div>

          {error && !isModalOpen ? <div className="alert alert-danger py-2">{error}</div> : null}
          {isLoading ? <p className="text-muted mb-0">Immobilienverwalter werden geladen...</p> : null}

          {!isLoading ? (
            <div className="table-responsive rounded-2 mb-0 vergo-table-scroll">
              <table className="table border-none text-nowrap customize-table mb-0 align-middle">
                <thead className="text-dark fs-4">
                  <tr>
                    <th><h6 className="fs-4 fw-semibold mb-0">Verwalter</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">Immobilie</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">Aufträge</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">Letzte Anmeldung</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">Status</h6></th>
                    <th width="110"><h6 className="fs-4 fw-semibold mb-0">Aktion</h6></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredManagers.map((manager) => (
                    <tr key={manager.id}>
                      <td>
                        <div>{manager.name || 'Immobilienverwalter'}</div>
                        <div className="text-muted">{manager.email}</div>
                      </td>
                      <td>
                        <div className="fw-semibold">{manager.property?.li_number ?? '-'}</div>
                        <div className="text-muted">{manager.property?.title ?? '-'}</div>
                      </td>
                      <td>{manager.orders_count ?? 0}</td>
                      <td>{manager.last_login_at || '-'}</td>
                      <td><span className={getStatusBadgeClass('active')}>{formatStatusLabel('active')}</span></td>
                      <td>
                        <div className="table-action-group">
                          <button type="button" className="table-action-btn table-action-edit" onClick={() => handleEdit(manager)} title="Immobilienverwalter bearbeiten">
                            <i className="ti ti-pencil"></i>
                          </button>
                          <button type="button" className="table-action-btn table-action-delete" onClick={() => handleDelete(manager.id)} title="Immobilienverwalter löschen">
                            <i className="ti ti-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredManagers.length === 0 ? (
                    <tr><td colSpan="6" className="text-center text-muted py-4">Keine Immobilienverwalter gefunden.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>

      {isModalOpen ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1" aria-hidden="false">
            <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
              <div className="modal-content rounded-1">
                <div className="modal-header border-bottom">
                  <h5 className="modal-title">{editingManager ? 'Immobilienverwalter bearbeiten' : 'Immobilienverwalter erstellen'}</h5>
                  <button type="button" className="btn-close" onClick={closeModal}></button>
                </div>
                <form onSubmit={handleSubmit}>
                  <div className="modal-body">
                    {!editingManager ? (
                      <>
                        <div className="mb-3">
                          <label className="form-label">Immobilie</label>
                          <select className="form-select" name="property_id" value={form.property_id} onChange={handleChange}>
                            <option value="">Immobilie auswählen</option>
                            {properties.map((property) => (
                              <option key={property.id} value={property.id}>{property.li_number} - {property.title}</option>
                            ))}
                          </select>
                        </div>
                        <div className="mb-3">
                          <label className="form-label">E-Mail</label>
                          <input className="form-control" name="email" value={form.email} onChange={handleChange} />
                        </div>
                      </>
                    ) : null}
                    <div className="mb-3">
                      <label className="form-label">Name</label>
                      <input className="form-control" name="name" value={form.name} onChange={handleChange} placeholder="Immobilienverwalter" />
                    </div>
                    {error ? <div className="alert alert-danger py-2 mb-0">{error}</div> : null}
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-light-danger text-danger" onClick={closeModal}>Abbrechen</button>
                    <button type="submit" className="btn btn-primary" disabled={isSaving}>
                      {isSaving ? 'Wird gespeichert...' : editingManager ? 'Verwalter aktualisieren' : 'Verwalter erstellen'}
                    </button>
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

export default PropertyManagersPage
