import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import PageContent from '../components/PageContent'
import { api } from '../lib/api'
import { PROPERTY_USAGE_OPTIONS, getOptionLabel } from '../lib/vergoOptions'

const initialForm = {
  address: '',
  postal_code: '',
  city: '',
  type: '',
  floors: '',
  apartment_count: '',
  commercial_area: '',
  status: 'active',
}

function EmployeePropertyDetailsPage() {
  const { propertyId } = useParams()
  const [property, setProperty] = useState(null)
  const [form, setForm] = useState(initialForm)
  const [filters, setFilters] = useState({
    search: '',
    type: '',
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadProperty()
  }, [propertyId])

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

  async function loadProperty() {
    setIsLoading(true)
    setError('')

    try {
      const response = await api.getProperty(propertyId)
      setProperty(response.data ?? null)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setIsLoading(false)
    }
  }

  function openModal() {
    setForm(initialForm)
    setError('')
    setIsModalOpen(true)
  }

  function closeModal() {
    setForm(initialForm)
    setError('')
    setIsModalOpen(false)
  }

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

    if (!form.address.trim()) {
      setError('Adresse ist erforderlich.')
      setIsSaving(false)
      return
    }

    if (!form.type) {
      setError('Nutzung ist erforderlich.')
      setIsSaving(false)
      return
    }

    try {
      const response = await api.createPropertyObject({
        property_id: Number(propertyId),
        address: form.address.trim(),
        postal_code: form.postal_code.trim() || null,
        city: form.city.trim() || null,
        type: form.type,
        floors: form.floors ? Number(form.floors) : null,
        apartment_count: form.type === 'commercial' ? null : (form.apartment_count ? Number(form.apartment_count) : null),
        commercial_area: form.type === 'residential' ? null : (form.commercial_area ? Number(form.commercial_area) : null),
        status: form.status,
      })

      setProperty((current) => ({
        ...current,
        objects: [response.data, ...(current?.objects ?? [])],
        objects_count: (current?.objects_count ?? 0) + 1,
      }))

      closeModal()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setIsSaving(false)
    }
  }

  const ownerLabel = useMemo(() => {
    return (property?.owners ?? []).map((owner) => owner.name).filter(Boolean).join(', ') || '-'
  }, [property])

  const filteredObjects = useMemo(() => {
    return (property?.objects ?? []).filter((object) => {
      const searchValue = [
        object.address,
        object.name,
        object.postal_code,
        object.city,
        object.type,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const matchesSearch = !filters.search || searchValue.includes(filters.search.toLowerCase())
      const matchesType = !filters.type || object.type === filters.type

      return matchesSearch && matchesType
    })
  }, [filters.search, filters.type, property])

  return (
    <PageContent
      title="Objekte"
      subtitle="Öffnen Sie die einzelnen Objekte einer Liegenschaft als Kartenansicht und legen Sie bei Bedarf neue Objekte an."
      breadcrumbs={[
        { label: 'Armaturenbrett', href: '/dashboard' },
        { label: 'Liegenschaften', href: '/properties' },
        { label: property?.title || 'Objekte' },
      ]}
    >
      {error && !isModalOpen ? <div className="alert alert-danger py-2">{error}</div> : null}
      {isLoading ? <div className="card"><div className="card-body">Objekte werden geladen...</div></div> : null}

      {!isLoading && property ? (
        <>
          <div className="card mb-4">
            <div className="card-body">
              <div className="row g-3">
                <div className="col-lg-3 col-sm-6">
                  <div className="vergo-stat-label">Bezeichnung</div>
                  <div className="vergo-stat-value">{property.title || '-'}</div>
                </div>
                <div className="col-lg-3 col-sm-6">
                  <div className="vergo-stat-label">Bewirtschaftung</div>
                  <div className="vergo-stat-value">{property.management || '-'}</div>
                </div>
                <div className="col-lg-3 col-sm-6">
                  <div className="vergo-stat-label">Eigentümer</div>
                  <div className="vergo-stat-value">{ownerLabel}</div>
                </div>
                <div className="col-lg-3 col-sm-6">
                  <div className="vergo-stat-label">Nutzung</div>
                  <div className="vergo-stat-value">{getOptionLabel(PROPERTY_USAGE_OPTIONS, property.usage)}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body p-4">
              <div className="row g-3 mb-4 vergo-filter-bar vergo-filter-bar-compact">
                <div className="col-xl-5 col-lg-5 col-md-12">
                  <div className="vergo-search-input-wrap">
                    <i className="ti ti-search vergo-search-input-icon" aria-hidden="true"></i>
                    <input
                      aria-label="Objekte durchsuchen"
                      className="form-control"
                      name="search"
                      value={filters.search}
                      onChange={handleFilterChange}
                      placeholder="Nach Adresse, PLZ, Ort oder Nutzung suchen"
                    />
                  </div>
                </div>

                <div className="col-xl-3 col-lg-3 col-md-12">
                  <div className="vergo-select-input-wrap">
                    <i className="ti ti-adjustments vergo-select-input-icon" aria-hidden="true"></i>
                    <select
                      aria-label="Nutzung filtern"
                      className="form-select"
                      name="type"
                      value={filters.type}
                      onChange={handleFilterChange}
                    >
                      <option value="">Alle Nutzungen</option>
                      {PROPERTY_USAGE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="col-xl-4 col-lg-4 col-md-12">
                  <div className="d-flex justify-content-lg-end gap-2 flex-nowrap vergo-action-buttons">
                    <button
                      type="button"
                      className="btn btn-light-primary text-nowrap"
                      onClick={() => setFilters({ search: '', type: '' })}
                    >
                      <i className="ti ti-refresh me-1"></i>
                      Zurücksetzen
                    </button>

                    <button
                      type="button"
                      className="btn btn-primary text-nowrap"
                      onClick={openModal}
                    >
                      <i className="ti ti-plus me-1"></i>
                      Objekt erstellen
                    </button>
                  </div>
                </div>
              </div>

              {filteredObjects.length > 0 ? (
                <div className="row g-4">
                  {filteredObjects.map((object) => (
                    <div className="col-xl-3 col-lg-4 col-sm-6" key={object.id}>
                      <div className="vergo-property-object-shell h-100">
                        <div className="vergo-property-object-icon-badge">
                          <div className="vergo-property-object-icon">
                            <i className="ti ti-home-2"></i>
                          </div>
                        </div>
                        <div className="card vergo-property-object-card h-100">
                          <div className="vergo-property-object-body">
                          <div className="vergo-property-object-label">Adresse</div>
                          <div className="vergo-property-object-value">{object.address || object.name || '-'}</div>
                          <div className="vergo-property-object-meta-grid">
                            <div>
                              <div className="vergo-property-object-label">PLZ</div>
                              <div className="vergo-property-object-meta">{object.postal_code || '-'}</div>
                            </div>
                            <div>
                              <div className="vergo-property-object-label">Ort</div>
                              <div className="vergo-property-object-meta">{object.city || '-'}</div>
                            </div>
                          </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted py-4">Keine Objekte gefunden.</div>
              )}
            </div>
          </div>
        </>
      ) : null}

      {isModalOpen ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1" aria-hidden="false">
            <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
              <div className="modal-content rounded-1">
                <div className="modal-header border-bottom">
                  <div>
                    <h5 className="modal-title mb-1">Objekt erstellen</h5>
                    <p className="text-muted mb-0">Legen Sie ein einzelnes Objekt innerhalb dieser Liegenschaft an.</p>
                  </div>
                  <button type="button" className="btn-close" aria-label="Schließen" onClick={closeModal}></button>
                </div>
                <form onSubmit={handleSubmit}>
                  <div className="modal-body">
                    <div className="row">
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Adresse</label>
                          <input className="form-control" name="address" value={form.address} onChange={handleChange} />
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
                          <label className="form-label">Nutzung</label>
                          <select className="form-select" name="type" value={form.type} onChange={handleChange}>
                            <option value="">Nutzung auswählen</option>
                            {PROPERTY_USAGE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Stockwerke</label>
                          <input className="form-control" name="floors" type="number" min="0" value={form.floors} onChange={handleChange} />
                        </div>
                      </div>
                      {form.type !== 'commercial' ? (
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Anzahl Wohnungen</label>
                            <input className="form-control" name="apartment_count" type="number" min="0" value={form.apartment_count} onChange={handleChange} />
                          </div>
                        </div>
                      ) : null}
                      {form.type !== 'residential' ? (
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Quadratmeter Gewerbefläche</label>
                            <input className="form-control" name="commercial_area" type="number" min="0" step="0.01" value={form.commercial_area} onChange={handleChange} />
                          </div>
                        </div>
                      ) : null}
                    </div>
                    {error ? <div className="alert alert-danger py-2 mt-2 mb-0">{error}</div> : null}
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-light-danger text-danger" onClick={closeModal}>Abbrechen</button>
                    <button type="submit" className="btn btn-primary" disabled={isSaving}>
                      {isSaving ? 'Wird gespeichert...' : 'Objekt speichern'}
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

export default EmployeePropertyDetailsPage
