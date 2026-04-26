import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PageContent from '../components/PageContent'
import { useAuth } from '../context/AuthContext'
import { confirmDelete, showDeleteSuccess } from '../lib/alerts'
import { api } from '../lib/api'
import { formatStatusLabel, getStatusBadgeClass } from '../lib/tableStatus'

const initialForm = {
  title: '',
  size: '',
  city: '',
  country: '',
  owner_id: '',
  manager_domains: '',
  status: 'draft',
}

function PropertiesPage() {
  const { user } = useAuth()
  const [properties, setProperties] = useState([])
  const [owners, setOwners] = useState([])
  const [form, setForm] = useState(initialForm)
  const [filters, setFilters] = useState({
    search: '',
    status: '',
  })
  const [editingPropertyId, setEditingPropertyId] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const isAdmin = user?.role === 'admin'
  const canManageProperties = ['admin', 'owner'].includes(user?.role)

  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      setError('')

      try {
        const requests = [api.getProperties()]

        if (isAdmin) {
          requests.push(api.getOwners())
        }

        const [propertiesResponse, ownersResponse] = await Promise.all(requests)

        setProperties(propertiesResponse.data ?? [])
        setOwners(ownersResponse?.data ?? [])
      } catch (loadError) {
        setError(loadError.message)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [isAdmin])

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
    }))
  }

  function handleFilterChange(event) {
    const { name, value } = event.target

    setFilters((current) => ({
      ...current,
      [name]: value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setIsSaving(true)
    setError('')

    if (!form.title.trim()) {
      setError('Property title is required.')
      setIsSaving(false)
      return
    }

    try {
      const payload = {
        ...form,
        size: form.size ? Number(form.size) : null,
        owner_id: isAdmin && form.owner_id ? Number(form.owner_id) : null,
        manager_domains: form.manager_domains
          .split(',')
          .map((domain) => domain.trim())
          .filter(Boolean),
      }

      if (editingPropertyId) {
        const response = await api.updateProperty(editingPropertyId, payload)
        setProperties((current) => current.map((property) => (
          property.id === editingPropertyId ? response.data : property
        )))
      } else {
        const response = await api.createProperty(payload)
        setProperties((current) => [response.data, ...current])
      }

      handleCloseModal()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setIsSaving(false)
    }
  }

  function openCreateModal() {
    setEditingPropertyId(null)
    setForm(initialForm)
    setError('')
    setIsModalOpen(true)
  }

  async function handleEdit(property) {
    setError('')

    try {
      const response = await api.getProperty(property.id)
      const fullProperty = response.data ?? property

      setEditingPropertyId(fullProperty.id)
      setForm({
        title: fullProperty.title || '',
        size: fullProperty.size ?? '',
        city: fullProperty.city || '',
        country: fullProperty.country || '',
        owner_id: isAdmin && fullProperty.owners?.[0]?.id ? String(fullProperty.owners[0].id) : '',
        manager_domains: fullProperty.manager_domains?.map((domain) => domain.domain).join(', ') || '',
        status: fullProperty.status || 'draft',
      })
      setIsModalOpen(true)
    } catch (loadError) {
      setError(loadError.message)
    }
  }

  function handleCloseModal() {
    setEditingPropertyId(null)
    setForm(initialForm)
    setError('')
    setIsModalOpen(false)
  }

  async function handleDelete(propertyId) {
    const shouldDelete = await confirmDelete('property')

    if (!shouldDelete) {
      return
    }

    try {
      await api.deleteProperty(propertyId)
      setProperties((current) => current.filter((property) => property.id !== propertyId))
      showDeleteSuccess('property')

      if (editingPropertyId === propertyId) {
        handleCloseModal()
      }
    } catch (deleteError) {
      setError(deleteError.message)
    }
  }

  const filteredProperties = properties.filter((property) => {
    const searchValue = [
      property.title,
      property.li_number,
      property.city,
      property.country,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    const searchMatch = !filters.search || searchValue.includes(filters.search.toLowerCase())
    const statusMatch = !filters.status || String(property.status || '').toLowerCase() === filters.status.toLowerCase()

    return searchMatch && statusMatch
  })

  return (
    <PageContent
      title="Eigenschaften"
      subtitle={
        canManageProperties
          ? isAdmin
            ? 'Li-Nummern verwalten, Verantwortliche zuweisen und die Basis für Bestellungen und KI-Analysen vorbereiten.'
            : 'Erstellen und verwalten Sie Ihre eigenen Objekte, bevor Manager und Aufgaben zugewiesen werden.'
          : 'Sehen Sie nur die Eigenschaften, auf die Sie Zugriff haben.'
      }
      breadcrumbs={[
        { label: 'Armaturenbrett', href: '/dashboard' },
        { label: 'Eigenschaften' },
      ]}
      actions={canManageProperties ? (
        <button type="button" className="btn btn-primary" onClick={openCreateModal}>
          <i className="ti ti-plus me-1"></i>
          Neue Eigenschaft
        </button>
      ) : null}
    >
      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-body p-4">
              <div className="row g-3 mb-4 vergo-filter-bar">
                <div className="col-md-7">
                  <label className="form-label">Suchen</label>
                  <div className="vergo-search-input-wrap">
                    <i className="ti ti-search vergo-search-input-icon" aria-hidden="true"></i>
                    <input
                      aria-label="Suche"
                      className="form-control"
                      name="search"
                      value={filters.search}
                      onChange={handleFilterChange}
                      placeholder="Suche nach Titel, Li-Nummer, Stadt oder Land"
                    />
                  </div>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Status</label>
                  <div className="vergo-select-input-wrap">
                    <i className="ti ti-adjustments vergo-select-input-icon" aria-hidden="true"></i>
                    <select aria-label="Status" className="form-select" name="status" value={filters.status} onChange={handleFilterChange}>
                      <option value="">All Status</option>
                      <option value="draft">Entwurf</option>
                      <option value="active">Aktiv</option>
                      <option value="archived">Archiviert</option>
                    </select>
                  </div>
                </div>
                <div className="col-md-2 d-flex align-items-end justify-content-end vergo-filter-reset-wrap">
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

              {isLoading ? <p className="text-muted mb-0">Eigenschaften werden geladen...</p> : null}
              {!isLoading && error && !isModalOpen ? <div className="alert alert-danger py-2">{error}</div> : null}

              {!isLoading ? (
                <div className="table-responsive rounded-2 mb-0 vergo-table-scroll">
                  <table className="table border-none text-nowrap customize-table mb-0 align-middle">
                    <thead className="text-dark fs-4">
                      <tr>
                        <th><h6 className="fs-4 fw-semibold mb-0">LI-Nummer</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">Titel</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">Eigentümer</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">Größe</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">Stadt</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">Objekte</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">Bestellungen</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">Status</h6></th>
                        <th width="130"><h6 className="fs-4 fw-semibold mb-0">Aktion</h6></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProperties.map((property) => (
                        <tr key={property.id}>
                          <td className="fw-semibold">{property.li_number}</td>
                          <td>{property.title}</td>
                          <td>{property.owners?.[0]?.name ?? '-'}</td>
                          <td>{property.size ? `${property.size} m²` : '-'}</td>
                          <td>{property.city || '-'}</td>
                          <td>{property.objects_count ?? 0}</td>
                          <td>{property.orders_count ?? 0}</td>
                          <td>
                            <span className={getStatusBadgeClass(property.status)}>
                              {formatStatusLabel(property.status)}
                            </span>
                          </td>
                          <td>
                            <div className="table-action-group">
                              <Link
                                to={`/properties/${property.id}`}
                                className="table-action-btn table-action-edit"
                                title="Objekt ansehen"
                              >
                                <i className="ti ti-eye"></i>
                              </Link>
                              {canManageProperties ? (
                              <>
                                <button
                                  type="button"
                                  className="table-action-btn table-action-edit"
                                  onClick={() => handleEdit(property)}
                                  title="Eigenschaft bearbeiten"
                                >
                                  <i className="ti ti-pencil"></i>
                                </button>
                                <button
                                  type="button"
                                  className="table-action-btn table-action-delete"
                                  onClick={() => handleDelete(property.id)}
                                  title="Eigenschaft löschen"
                                >
                                  <i className="ti ti-trash"></i>
                                </button>
                              </>
                            ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}

                      {filteredProperties.length === 0 ? (
                        <tr>
                          <td colSpan="9" className="text-center text-muted py-4">
                            Keine Eigenschaften gefunden.
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

      {canManageProperties ? (
        <>
          <div
            className={`modal fade ${isModalOpen ? 'show' : ''}`}
            style={{ display: isModalOpen ? 'block' : 'none' }}
            tabIndex="-1"
            aria-hidden={!isModalOpen}
          >
            <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
              <div className="modal-content rounded-1">
                <div className="modal-header border-bottom">
                  <div>
                    <h5 className="modal-title mb-1">
                      {editingPropertyId ? 'Eigenschaft bearbeiten' : 'Neue Eigenschaft'}
                    </h5>
                    <p className="text-muted mb-0">
                      {editingPropertyId
                        ? 'Aktualisieren Sie die wichtigsten Angaben dieser Eigenschaft.'
                        : 'Erfassen Sie eine neue Eigenschaft und hinterlegen Sie die Basisdaten.'}
                    </p>
                  </div>
                  <button type="button" className="btn-close" aria-label="Schließen" onClick={handleCloseModal}></button>
                </div>

                <form onSubmit={handleSubmit}>
                  <div className="modal-body">
                    <div className="row">
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Eigenschaftstitel</label>
                          <input className="form-control" name="title" value={form.title} onChange={handleChange} />
                        </div>
                      </div>

                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Größe (m²)</label>
                          <input className="form-control" type="number" min="0" step="0.01" name="size" value={form.size} onChange={handleChange} />
                        </div>
                      </div>

                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Stadt</label>
                          <input className="form-control" name="city" value={form.city} onChange={handleChange} />
                        </div>
                      </div>

                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Land</label>
                          <input className="form-control" name="country" value={form.country} onChange={handleChange} />
                        </div>
                      </div>

                      {isAdmin ? (
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Eigentümer</label>
                            <select className="form-select" name="owner_id" value={form.owner_id} onChange={handleChange}>
                              <option value="">Eigentümer auswählen</option>
                              {owners.map((owner) => (
                                <option key={owner.id} value={owner.id}>
                                  {owner.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ) : null}

                      <div className={isAdmin ? 'col-md-6' : 'col-md-12'}>
                        <div className="mb-3">
                          <label className="form-label">Status</label>
                          <select className="form-select" name="status" value={form.status} onChange={handleChange}>
                            <option value="draft">Entwurf</option>
                            <option value="active">Aktiv</option>
                            <option value="archived">Archiviert</option>
                          </select>
                        </div>
                      </div>

                      <div className="col-12">
                        <div className="mb-0">
                          <label className="form-label">Erlaubte Manager-Domains</label>
                          <input
                            className="form-control"
                            name="manager_domains"
                            value={form.manager_domains}
                            onChange={handleChange}
                            placeholder="example.com, vendor.de"
                          />
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
                      {isSaving ? 'Wird gespeichert...' : editingPropertyId ? 'Eigenschaft aktualisieren' : 'Eigenschaft erstellen'}
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

export default PropertiesPage
