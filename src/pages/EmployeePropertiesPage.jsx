import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageContent from '../components/PageContent'
import { api } from '../lib/api'
import { PROPERTY_USAGE_OPTIONS, getOptionLabel } from '../lib/vergoOptions'

const initialForm = {
  title: '',
  address_line_1: '',
  management: '',
  owner_id: '',
  postal_code: '',
  city: '',
  usage: '',
  lot_area: '',
  apartment_count: '',
  commercial_area: '',
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
  const [filters, setFilters] = useState({ search: '', usage: '' })
  const [editingProperty, setEditingProperty] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

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
        property.address_line_1,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const searchMatch = !filters.search || searchValue.includes(filters.search.toLowerCase())
      const usageMatch = !filters.usage || property.usage === filters.usage

      return searchMatch && usageMatch
    })
  }, [filters.search, filters.usage, properties])

  function handleChange(event) {
    const { name, value } = event.target

    setForm((current) => ({
      ...current,
      [name]: value,
    }))

    setFieldErrors((current) => {
      if (!current[name]) {
        return current
      }

      const nextErrors = { ...current }
      delete nextErrors[name]
      return nextErrors
    })
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
    setFieldErrors({})
    setIsModalOpen(true)
  }

  function handleEdit(property) {
    setEditingProperty(property)
    setForm({
      title: property.title || '',
      address_line_1: property.address_line_1 || '',
      management: property.management || '',
      owner_id: property.owners?.[0]?.id ? String(property.owners[0].id) : '',
      postal_code: property.postal_code || '',
      city: property.city || '',
      usage: property.usage || '',
      lot_area: property.lot_area ?? '',
      apartment_count: property.apartment_count ?? '',
      commercial_area: property.commercial_area ?? '',
    })
    setError('')
    setFieldErrors({})
    setIsModalOpen(true)
  }

  function closeModal() {
    setEditingProperty(null)
    setForm(initialForm)
    setError('')
    setFieldErrors({})
    setIsModalOpen(false)
  }

  function validateForm() {
    const nextErrors = {}

    if (!form.title.trim()) {
      nextErrors.title = true
    }

    if (!form.address_line_1.trim()) {
      nextErrors.address_line_1 = true
    }

    if (!form.owner_id) {
      nextErrors.owner_id = true
    }

    if (!form.usage) {
      nextErrors.usage = true
    }

    if (!String(form.postal_code || '').trim()) {
      nextErrors.postal_code = true
    }

    if (!String(form.city || '').trim()) {
      nextErrors.city = true
    }

    if (!String(form.lot_area || '').trim()) {
      nextErrors.lot_area = true
    }

    if (form.usage !== 'commercial' && !String(form.apartment_count || '').trim()) {
      nextErrors.apartment_count = true
    }

    if (form.usage !== 'residential' && !String(form.commercial_area || '').trim()) {
      nextErrors.commercial_area = true
    }

    return nextErrors
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    const validationErrors = validateForm()

    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors)
      setError('Bitte alle Pflichtfelder ausfüllen.')
      return
    }

    setFieldErrors({})
    setIsSaving(true)

    try {
      const payload = {
        title: form.title.trim(),
        address_line_1: form.address_line_1.trim(),
        management: form.management.trim() || null,
        owner_id: Number(form.owner_id),
        postal_code: form.postal_code.trim() || null,
        city: form.city.trim() || null,
        usage: form.usage,
        lot_area: form.lot_area ? Number(form.lot_area) : null,
        apartment_count: form.usage === 'commercial' ? null : Number(form.apartment_count),
        commercial_area: form.usage === 'residential' ? null : Number(form.commercial_area),
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
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Liegenschaften' },
      ]}
    >
      <div className="card">
        <div className="card-body p-4">
          <div className="row g-3 mb-4 vergo-filter-bar vergo-filter-bar-compact">
            <div className="col-xl-8 col-lg-7 col-md-12">
              <div className="vergo-search-input-wrap">
                <i className="ti ti-search vergo-search-input-icon" aria-hidden="true"></i>
                <input
                  aria-label="Suche"
                  className="form-control"
                  name="search"
                  value={filters.search}
                  onChange={handleFilterChange}
                  placeholder="Nach Adresse suchen"
                />
              </div>
            </div>

            <div className="col-xl-2 col-lg-5 col-md-6">
              <select className="form-select" name="usage" value={filters.usage} onChange={handleFilterChange}>
                <option value="">Nutzung auswählen</option>
                {PROPERTY_USAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="col-xl-2 col-lg-5 col-md-6">
              <div className="d-flex justify-content-lg-end gap-2 flex-nowrap vergo-action-buttons">

                <button
                  type="button"
                  className="btn btn-light-primary text-nowrap"
                  onClick={() => setFilters({ search: '', usage: '' })}
                >
                  <i className="ti ti-refresh me-1"></i>
                  Zurücksetzen
                </button>

                <button
                  type="button"
                  className="btn btn-primary text-nowrap"
                  onClick={openCreateModal}
                >
                  <i className="ti ti-plus me-1"></i>
                  Liegenschaft erstellen
                </button>

              </div>
            </div>
          </div>

          {error && !isModalOpen ? <div className="alert alert-danger py-2">{error}</div> : null}
          {isLoading ? <p className="text-muted mb-0">Liegenschaften werden geladen...</p> : null}

          {!isLoading ? (
            <div className="table-responsive rounded-2 mb-0 vergo-table-scroll">
              <table className="table border-none text-nowrap customize-table mb-0 align-middle">
                <thead className="text-dark fs-4">
                  <tr>
                    <th><h6 className="fs-4 fw-semibold mb-0">Code</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">Bezeichnung</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">Adresse</h6></th>
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
                      <td>{property.address_line_1 || '-'}</td>
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
                      <td colSpan="8" className="text-center text-muted py-4">
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
            <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
              <div className="modal-content rounded-1">
                <div className="modal-header border-bottom">
                  <div>
                    <h5 className="modal-title mb-1">{editingProperty ? 'Liegenschaft bearbeiten' : 'Liegenschaft erstellen'}</h5>
                    <p className="text-muted mb-0">Pflegen Sie die Stammdaten der Liegenschaft inklusive Eigentümer und Nutzung.</p>
                  </div>
                  <button type="button" className="btn-close" aria-label="Schließen" onClick={closeModal}></button>
                </div>

                <form onSubmit={handleSubmit}>
                  <div className="modal-body">
                    <div className="row">
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Bezeichnung</label>
                          <input className={`form-control${fieldErrors.title ? ' is-invalid' : ''}`} name="title" value={form.title} onChange={handleChange} />
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Adresse</label>
                          <input className={`form-control${fieldErrors.address_line_1 ? ' is-invalid' : ''}`} name="address_line_1" value={form.address_line_1} onChange={handleChange} />
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Bewirtschaftung</label>
                          <input className={`form-control${fieldErrors.management ? ' is-invalid' : ''}`} name="management" value={form.management} onChange={handleChange} />
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Eigentümer</label>
                          <select className={`form-select${fieldErrors.owner_id ? ' is-invalid' : ''}`} name="owner_id" value={form.owner_id} onChange={handleChange}>
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
                          <input className={`form-control${fieldErrors.postal_code ? ' is-invalid' : ''}`} name="postal_code" value={form.postal_code} onChange={handleChange} />
                        </div>
                      </div>
                      <div className="col-md-3">
                        <div className="mb-3">
                          <label className="form-label">Ort</label>
                          <input className={`form-control${fieldErrors.city ? ' is-invalid' : ''}`} name="city" value={form.city} onChange={handleChange} />
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Nutzung</label>
                          <select className={`form-select${fieldErrors.usage ? ' is-invalid' : ''}`} name="usage" value={form.usage} onChange={handleChange}>
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
                          <input className={`form-control${fieldErrors.lot_area ? ' is-invalid' : ''}`} name="lot_area" type="number" min="0" step="0.01" value={form.lot_area} onChange={handleChange} />
                        </div>
                      </div>
                      {form.usage !== 'commercial' ? (
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Anzahl Wohnungen</label>
                            <input className={`form-control${fieldErrors.apartment_count ? ' is-invalid' : ''}`} name="apartment_count" type="number" min="0" value={form.apartment_count} onChange={handleChange} />
                          </div>
                        </div>
                      ) : null}
                      {form.usage !== 'residential' ? (
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Quadratmeter Gewerbefläche</label>
                            <input className={`form-control${fieldErrors.commercial_area ? ' is-invalid' : ''}`} name="commercial_area" type="number" min="0" step="0.01" value={form.commercial_area} onChange={handleChange} />
                          </div>
                        </div>
                      ) : null}
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
