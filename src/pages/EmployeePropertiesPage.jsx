import { useEffect, useState } from 'react'
import PageContent from '../components/PageContent'
import { api } from '../lib/api'

const initialForm = {
  li_number: '',
  title: '',
  postal_code: '',
  city: '',
}

function getOwnerCompanyLabel(property) {
  const ownerNames = (property?.owners ?? [])
    .map((owner) => owner?.name)
    .filter(Boolean)

  return ownerNames.length > 0 ? ownerNames.join(', ') : '-'
}

function EmployeePropertiesPage() {
  const [properties, setProperties] = useState([])
  const [form, setForm] = useState(initialForm)
  const [filters, setFilters] = useState({ search: '' })
  const [editingProperty, setEditingProperty] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadProperties() {
      setIsLoading(true)
      setError('')

      try {
        const response = await api.getProperties()
        setProperties(response.data ?? [])
      } catch (loadError) {
        setError(loadError.message)
      } finally {
        setIsLoading(false)
      }
    }

    loadProperties()
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

  function handleEdit(property) {
    setEditingProperty(property)
    setForm({
      li_number: property.li_number || '',
      title: property.title || '',
      postal_code: property.postal_code || '',
      city: property.city || '',
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

    if (!form.li_number.trim()) {
      setError('Code (LI-Nummer) ist erforderlich.')
      setIsSaving(false)
      return
    }

    if (!form.title.trim()) {
      setError('Bezeichnung ist erforderlich.')
      setIsSaving(false)
      return
    }

    try {
      const response = await api.updateProperty(editingProperty.id, {
        li_number: form.li_number.trim(),
        title: form.title.trim(),
        postal_code: form.postal_code.trim() || null,
        city: form.city.trim() || null,
      })

      setProperties((current) => current.map((property) => (
        property.id === editingProperty.id ? response.data : property
      )))

      closeModal()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setIsSaving(false)
    }
  }

  const filteredProperties = properties.filter((property) => {
    const searchValue = [
      property.li_number,
      property.title,
      property.postal_code,
      property.city,
      ...(property.owners ?? []).map((owner) => owner?.name),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return !filters.search || searchValue.includes(filters.search.toLowerCase())
  })

  return (
    <PageContent
      title="Liegenschaften"
      subtitle="Sehen und bearbeiten Sie die wichtigsten Stammdaten Ihrer Liegenschaften und wechseln Sie bei Bedarf direkt zu den Objekten."
      breadcrumbs={[
        { label: 'Armaturenbrett', href: '/dashboard' },
        { label: 'Liegenschaften' },
      ]}
    >
      <div className="card">
        <div className="px-4 py-3 border-bottom">
          <h5 className="card-title fw-semibold mb-0 lh-sm">Liegenschaftsübersicht</h5>
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
                placeholder="Nach Code, Bezeichnung, PLZ, Ort oder Eigentümerschaft suchen"
              />
            </div>

            <div className="col-md-2 d-flex align-items-end">
              <button
                type="button"
                className="btn btn-light-primary w-100"
                onClick={() => setFilters({ search: '' })}
              >
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
                    <th width="90"><h6 className="fs-4 fw-semibold mb-0">Aktion</h6></th>
                  </tr>
                </thead>

                <tbody>
                  {filteredProperties.map((property) => (
                    <tr key={property.id}>
                      <td className="fw-semibold">{property.li_number || '-'}</td>
                      <td>{property.title || '-'}</td>
                      <td>{property.postal_code || '-'}</td>
                      <td>{property.city || '-'}</td>
                      <td>{property.objects_count ?? 0}</td>
                      <td>{getOwnerCompanyLabel(property)}</td>
                      <td>
                        <div className="table-action-group">
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
                    <h5 className="modal-title mb-1">Liegenschaft bearbeiten</h5>
                    <p className="text-muted mb-0">Aktualisieren Sie Code, Bezeichnung und Standortdaten dieser Liegenschaft.</p>
                  </div>
                  <button type="button" className="btn-close" aria-label="Schließen" onClick={closeModal}></button>
                </div>

                <form onSubmit={handleSubmit}>
                  <div className="modal-body">
                    <div className="row">
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Code (LI-Nummer)</label>
                          <input className="form-control" name="li_number" value={form.li_number} onChange={handleChange} />
                        </div>
                      </div>

                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Bezeichnung</label>
                          <input className="form-control" name="title" value={form.title} onChange={handleChange} />
                        </div>
                      </div>

                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">PLZ</label>
                          <input className="form-control" name="postal_code" value={form.postal_code} onChange={handleChange} />
                        </div>
                      </div>

                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Ort</label>
                          <input className="form-control" name="city" value={form.city} onChange={handleChange} />
                        </div>
                      </div>

                      <div className="col-12">
                        <div className="mb-0">
                          <label className="form-label">Eigentümerschaft</label>
                          <input className="form-control" value={getOwnerCompanyLabel(editingProperty)} readOnly />
                        </div>
                      </div>
                    </div>

                    {error ? <div className="alert alert-danger py-2 mt-3 mb-0">{error}</div> : null}
                  </div>

                  <div className="modal-footer">
                    <button type="button" className="btn btn-light-danger text-danger" onClick={closeModal}>
                      Abbrechen
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={isSaving}>
                      {isSaving ? 'Wird gespeichert...' : 'Liegenschaft aktualisieren'}
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
