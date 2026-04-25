import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageContent from '../components/PageContent'
import { api } from '../lib/api'
import { PROPERTY_USAGE_OPTIONS, getOptionLabel } from '../lib/vergoOptions'

const initialForm = {
  title: '',
  management: '',
  owner_id: '',
  postal_code: '',
  city: '',
  usage: '',
  manager_domains: '',
  lot_area: '',
}

function normalizeDomains(value) {
  return value
    .split(/[\n,]/)
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean)
}

function getOwnerCompanyLabel(property) {
  const ownerNames = (property?.owners ?? [])
    .map((owner) => owner?.name)
    .filter(Boolean)

  return ownerNames.length > 0 ? ownerNames.join(', ') : '-'
}

function EmployeePropertiesPage() {
  const [properties, setProperties] = useState([])
  const [owners, setOwners] = useState([])
  const [form, setForm] = useState(initialForm)
  const [filters, setFilters] = useState({ search: '' })
  const [editingProperty, setEditingProperty] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      setError('')

      try {
        const [propertiesResponse, ownersResponse] = await Promise.all([
          api.getProperties(),
          api.getUserDirectoryOwners(),
        ])

        setProperties(propertiesResponse.data ?? [])
        setOwners(ownersResponse.data ?? [])
      } catch (loadError) {
        setError(loadError.message)
      } finally {
        setIsLoading(false)
      }
    }

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

  const filteredProperties = useMemo(() => {
    return properties.filter((property) => {
      const searchValue = [
        property.li_number,
        property.title,
        property.management,
        property.postal_code,
        property.city,
        property.usage,
        ...(property.owners ?? []).map((owner) => owner?.name),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return !filters.search || searchValue.includes(filters.search.toLowerCase())
    })
  }, [filters.search, properties])

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

  function openCreateModal() {
    setEditingProperty(null)
    setForm(initialForm)
    setError('')
    setIsModalOpen(true)
  }

  function handleEdit(property) {
    setEditingProperty(property)
    setForm({
      title: property.title || '',
      management: property.management || '',
      owner_id: property.owners?.[0]?.id ? String(property.owners[0].id) : '',
      postal_code: property.postal_code || '',
      city: property.city || '',
      usage: property.usage || '',
      manager_domains: (property.manager_domains ?? []).map((domain) => domain.domain).join(', '),
      lot_area: property.lot_area ?? '',
    })
    setError('')
    setIsModalOpen(true)
  }

  function closeModal() {
    setEditingProperty(null)
    setForm(initialForm)
    setError('')
    setIsModalOpen(false)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setIsSaving(true)
    setError('')

    if (!form.title.trim()) {
      setError('Bezeichnung ist erforderlich.')
      setIsSaving(false)
      return
    }

    if (!form.owner_id) {
      setError('Eigentümer ist erforderlich.')
      setIsSaving(false)
      return
    }

    if (!form.usage) {
      setError('Nutzung ist erforderlich.')
      setIsSaving(false)
      return
    }

    try {
      const payload = {
        title: form.title.trim(),
        management: form.management.trim() || null,
        owner_id: Number(form.owner_id),
        postal_code: form.postal_code.trim() || null,
        city: form.city.trim() || null,
        usage: form.usage,
        manager_domains: normalizeDomains(form.manager_domains),
        lot_area: form.lot_area ? Number(form.lot_area) : null,
        size: form.lot_area ? Number(form.lot_area) : null,
        status: 'active',
      }

      if (editingProperty) {
        const response = await api.updateProperty(editingProperty.id, payload)
        setProperties((current) => current.map((property) => (
          property.id === editingProperty.id ? response.data : property
        )))
      } else {
        const response = await api.createProperty(payload)
        setProperties((current) => [response.data, ...current])
      }

      closeModal()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <PageContent
      title="Liegenschaften"
      subtitle="Erstellen Sie neue Liegenschaften, pflegen Sie Stammdaten und springen Sie von der Übersicht direkt in die Objektansicht."
      breadcrumbs={[
        { label: 'Armaturenbrett', href: '/dashboard' },
        { label: 'Liegenschaften' },
      ]}
    >
      <div className="card">
        <div className="px-4 py-3 border-bottom">
          <h5 className="card-title fw-semibold mb-0 lh-sm">Liegenschaftsübersicht</h5>
          <div className="page-title-right w-100 d-flex justify-content-md-end justify-content-start">
            <button type="button" className="btn btn-primary" onClick={openCreateModal}>
              <i className="ti ti-plus me-1"></i>
              Liegenschaft erstellen
            </button>
          </div>
        </div>

        <div className="card-body p-4">
          <div className="row g-3 mb-4">
            <div className="col-md-10">
              <label className="form-label">Suche</label>
              <input
                className="form-control"
                name="search"
                value={filters.search}
                onChange={handleFilterChange}
                placeholder="Nach Code, Bezeichnung, Bewirtschaftung, Ort oder Eigentümer suchen"
              />
            </div>

            <div className="col-md-2 d-flex align-items-end">
              <button type="button" className="btn btn-light-primary w-100" onClick={() => setFilters({ search: '' })}>
                Zurücksetzen
              </button>
            </div>
          </div>

          {error && !isModalOpen ? <div className="alert alert-danger py-2">{error}</div> : null}
          {isLoading ? <p className="text-muted mb-0">Liegenschaften werden geladen...</p> : null}

          {!isLoading ? (
            <div className="table-responsive rounded-2 mb-0 vergo-table-scroll">
              <table className="table border text-nowrap customize-table mb-0 align-middle">
                <thead className="text-dark fs-4">
                  <tr>
                    <th><h6 className="fs-4 fw-semibold mb-0">Code</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">Bezeichnung</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">PLZ</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">Ort</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">Anzahl</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">Eigentümerschaft</h6></th>
                    <th width="170"><h6 className="fs-4 fw-semibold mb-0">Aktion</h6></th>
                  </tr>
                </thead>

                <tbody>
                  {filteredProperties.map((property) => (
                    <tr key={property.id}>
                      <td className="fw-semibold">{property.li_number || '-'}</td>
                      <td>
                        <div className="fw-semibold">{property.title || '-'}</div>
                        <div className="text-muted small">{getOptionLabel(PROPERTY_USAGE_OPTIONS, property.usage)}</div>
                      </td>
                      <td>{property.postal_code || '-'}</td>
                      <td>{property.city || '-'}</td>
                      <td>{property.objects_count ?? 0}</td>
                      <td>{getOwnerCompanyLabel(property)}</td>
                      <td>
                        <div className="table-action-group">
                          <Link
                            to={`/properties/${property.id}`}
                            className="table-action-btn table-action-view"
                            title="Objekte anzeigen"
                          >
                            <i className="ti ti-building-community"></i>
                          </Link>
                          <Link
                            to={`/properties/${property.id}/documents`}
                            className="table-action-btn table-action-view"
                            title="Dokumente und Analyse öffnen"
                          >
                            <i className="ti ti-file-invoice"></i>
                          </Link>
                          <button
                            type="button"
                            className="table-action-btn table-action-edit"
                            onClick={() => handleEdit(property)}
                            title="Liegenschaft bearbeiten"
                          >
                            <i className="ti ti-pencil"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredProperties.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center text-muted py-4">
                        Keine Liegenschaften gefunden.
                      </td>
                    </tr>
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
            <div className="modal-dialog modal-dialog-scrollable modal-lg">
              <div className="modal-content rounded-1">
                <div className="modal-header border-bottom">
                  <div>
                    <h5 className="modal-title mb-1">{editingProperty ? 'Liegenschaft bearbeiten' : 'Liegenschaft erstellen'}</h5>
                    <p className="text-muted mb-0">Pflegen Sie die Stammdaten der Liegenschaft inklusive Eigentümer, Nutzung und Domains.</p>
                  </div>
                  <button type="button" className="btn-close" aria-label="Schließen" onClick={closeModal}></button>
                </div>

                <form onSubmit={handleSubmit}>
                  <div className="modal-body">
                    <div className="row">
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Bezeichnung</label>
                          <input className="form-control" name="title" value={form.title} onChange={handleChange} />
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Bewirtschaftung</label>
                          <input className="form-control" name="management" value={form.management} onChange={handleChange} />
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Eigentümer</label>
                          <select className="form-select" name="owner_id" value={form.owner_id} onChange={handleChange}>
                            <option value="">Eigentümer auswählen</option>
                            {owners.map((owner) => (
                              <option key={owner.id} value={owner.id}>{owner.company_name || owner.name || owner.customer_number}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="col-md-3">
                        <div className="mb-3">
                          <label className="form-label">PLZ</label>
                          <input className="form-control" name="postal_code" value={form.postal_code} onChange={handleChange} />
                        </div>
                      </div>
                      <div className="col-md-3">
                        <div className="mb-3">
                          <label className="form-label">Ort</label>
                          <input className="form-control" name="city" value={form.city} onChange={handleChange} />
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Gemischte Nutzung</label>
                          <select className="form-select" name="usage" value={form.usage} onChange={handleChange}>
                            <option value="">Nutzung auswählen</option>
                            {PROPERTY_USAGE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Grundstücksfläche</label>
                          <input className="form-control" name="lot_area" type="number" min="0" step="0.01" value={form.lot_area} onChange={handleChange} />
                        </div>
                      </div>
                      <div className="col-12">
                        <div className="mb-0">
                          <label className="form-label">Domains</label>
                          <textarea
                            className="form-control"
                            rows="3"
                            name="manager_domains"
                            value={form.manager_domains}
                            onChange={handleChange}
                            placeholder="beispiel.de, vergo.ch"
                          />
                        </div>
                      </div>
                    </div>
                    {error ? <div className="alert alert-danger py-2 mt-3 mb-0">{error}</div> : null}
                  </div>

                  <div className="modal-footer">
                    <button type="button" className="btn btn-light-danger text-danger" onClick={closeModal}>Abbrechen</button>
                    <button type="submit" className="btn btn-primary" disabled={isSaving}>
                      {isSaving ? 'Wird gespeichert...' : editingProperty ? 'Liegenschaft aktualisieren' : 'Liegenschaft speichern'}
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

export default EmployeePropertiesPage
