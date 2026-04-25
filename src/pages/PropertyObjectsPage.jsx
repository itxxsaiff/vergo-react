import { useEffect, useState } from 'react'
import PageContent from '../components/PageContent'
import { useAuth } from '../context/AuthContext'
import { confirmDelete, showDeleteSuccess } from '../lib/alerts'
import { api } from '../lib/api'
import { formatStatusLabel, getStatusBadgeClass } from '../lib/tableStatus'
import { getOptionLabel, PROPERTY_OBJECT_TYPE_OPTIONS } from '../lib/vergoOptions'

const initialForm = {
  property_id: '',
  address: '',
  postal_code: '',
  city: '',
  type: '',
  floors: '',
  apartment_count: '',
  commercial_area: '',
  status: 'active',
}

function PropertyObjectsPage() {
  const { user } = useAuth()
  const [objects, setObjects] = useState([])
  const [properties, setProperties] = useState([])
  const [form, setForm] = useState(initialForm)
  const [filters, setFilters] = useState({
    search: '',
    status: '',
  })
  const [editingObjectId, setEditingObjectId] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const isOwner = user?.role === 'owner'
  const canManageObjects = ['admin', 'owner', 'employee'].includes(user?.role)

  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      setError('')

      try {
        const requests = [api.getPropertyObjects()]

        if (canManageObjects) {
          requests.push(api.getProperties())
        }

        const [objectsResponse, propertiesResponse] = await Promise.all(requests)

        setObjects(objectsResponse.data ?? [])
        setProperties(propertiesResponse?.data ?? [])
      } catch (loadError) {
        setError(loadError.message)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [canManageObjects])

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

    if (!form.property_id) {
      setError('Bitte wählen Sie eine Immobilie aus.')
      setIsSaving(false)
      return
    }

    if (!form.address.trim()) {
      setError('Adresse ist erforderlich.')
      setIsSaving(false)
      return
    }

    if (!form.type) {
      setError('Bitte wählen Sie einen Objekttyp aus.')
      setIsSaving(false)
      return
    }
    try {
      const payload = {
        property_id: Number(form.property_id),
        address: form.address.trim(),
        postal_code: form.postal_code.trim() || null,
        city: form.city.trim() || null,
        type: form.type,
        floors: form.floors ? Number(form.floors) : null,
        apartment_count: form.type === 'commercial' ? null : (form.apartment_count ? Number(form.apartment_count) : null),
        commercial_area: form.type === 'residential' ? null : (form.commercial_area ? Number(form.commercial_area) : null),
        status: form.status,
      }

      if (editingObjectId) {
        const response = await api.updatePropertyObject(editingObjectId, payload)
        setObjects((current) => current.map((item) => (
          item.id === editingObjectId ? response.data : item
        )))
      } else {
        const response = await api.createPropertyObject(payload)
        setObjects((current) => [response.data, ...current])
      }

      setForm(initialForm)
      setEditingObjectId(null)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setIsSaving(false)
    }
  }

  function handleEdit(object) {
    setEditingObjectId(object.id)
    setForm({
      property_id: String(object.property_id ?? object.property?.id ?? ''),
      address: object.address ?? object.name ?? '',
      postal_code: object.postal_code ?? '',
      city: object.city ?? '',
      type: object.type ?? '',
      floors: object.floors ?? '',
      apartment_count: object.apartment_count ?? '',
      commercial_area: object.commercial_area ?? '',
      status: object.status ?? 'active',
    })
    setError('')
  }

  function handleCancelEdit() {
    setEditingObjectId(null)
    setForm(initialForm)
    setError('')
  }

  async function handleDelete(objectId) {
    const shouldDelete = await confirmDelete('property object')

    if (!shouldDelete) {
      return
    }

    try {
      await api.deletePropertyObject(objectId)
      setObjects((current) => current.filter((item) => item.id !== objectId))
      showDeleteSuccess('property object')

      if (editingObjectId === objectId) {
        handleCancelEdit()
      }
    } catch (deleteError) {
      setError(deleteError.message)
    }
  }

  const filteredObjects = objects.filter((object) => {
    const searchValue = [
      object.name,
      object.address,
      object.postal_code,
      object.city,
      object.type,
      object.property?.li_number,
      object.property?.title,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    const searchMatch = !filters.search || searchValue.includes(filters.search.toLowerCase())
    const statusMatch = !filters.status || String(object.status || '').toLowerCase() === filters.status.toLowerCase()

    return searchMatch && statusMatch
  })

  return (
    <PageContent
      title="Objekte der Immobilien"
      subtitle={
        canManageObjects
          ? isOwner
            ? 'Verwalten Sie die einzelnen Objekte innerhalb Ihrer Immobilien, bevor Manager beginnen, Aufträge zu erstellen.'
            : 'Verwalten Sie die einzelnen Objekte innerhalb jeder Immobilie, bevor Sie zu Aufträgen und Angeboten übergehen.'
          : 'Sehen Sie die verfügbaren Objekte unter Ihren zugewiesenen Immobilien ein.'
      }
      breadcrumbs={[
        { label: 'Armaturenbrett', href: '/dashboard' },
        { label: 'Objekte der Immobilien' },
      ]}
    >
      <div className="row">
        {canManageObjects ? (
          <div className="col-xl-4">
            <div className="card">
              <div className="card-body">
                <h4 className="card-title mb-4">Immobilienobjekt erstellen</h4>
                {editingObjectId ? <p className="text-muted">Ausgewähltes Immobilienobjekt bearbeiten.</p> : null}

                <form onSubmit={handleSubmit}>
                  <div className="mb-3">
                    <label className="form-label">Immobilie</label>
                    <select className="form-select" name="property_id" value={form.property_id} onChange={handleChange}>
                      <option value="">Immobilie auswählen</option>
                      {properties.map((property) => (
                        <option key={property.id} value={property.id}>
                          {property.li_number} - {property.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Adresse</label>
                    <input className="form-control" name="address" value={form.address} onChange={handleChange} />
                  </div>

                  <div className="row">
                    <div className="col-md-4">
                      <div className="mb-3">
                        <label className="form-label">PLZ</label>
                        <input className="form-control" name="postal_code" value={form.postal_code} onChange={handleChange} />
                      </div>
                    </div>
                    <div className="col-md-8">
                      <div className="mb-3">
                        <label className="form-label">Ort</label>
                        <input className="form-control" name="city" value={form.city} onChange={handleChange} />
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Gemischte Nutzung</label>
                    <select className="form-select" name="type" value={form.type} onChange={handleChange}>
                      <option value="">Nutzung auswählen</option>
                      {PROPERTY_OBJECT_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Stockwerke</label>
                    <input className="form-control" name="floors" type="number" min="0" value={form.floors} onChange={handleChange} />
                  </div>

                  {form.type !== 'commercial' ? (
                    <div className="mb-3">
                      <label className="form-label">Anzahl Wohnungen</label>
                      <input className="form-control" name="apartment_count" type="number" min="0" value={form.apartment_count} onChange={handleChange} />
                    </div>
                  ) : null}

                  {form.type !== 'residential' ? (
                    <div className="mb-3">
                      <label className="form-label">Quadratmeter Gewerbefläche</label>
                      <input className="form-control" name="commercial_area" type="number" min="0" step="0.01" value={form.commercial_area} onChange={handleChange} />
                    </div>
                  ) : null}

                  <div className="mb-3">
                    <label className="form-label">Status</label>
                    <select className="form-select" name="status" value={form.status} onChange={handleChange}>
                      <option value="active">Aktiv</option>
                      <option value="inactive">Inaktiv</option>
                      <option value="archived">Archiviert</option>
                    </select>
                  </div>

                  {error ? <div className="alert alert-danger py-2">{error}</div> : null}

                  <div className="d-flex gap-2">
                    <button type="submit" className="btn btn-primary waves-effect waves-light" disabled={isSaving}>
                      {isSaving ? 'Wird gespeichert...' : editingObjectId ? 'Objekt aktualisieren' : 'Objekt erstellen'}
                    </button>
                    {editingObjectId ? (
                      <button type="button" className="btn btn-light border" onClick={handleCancelEdit}>
                        Abbrechen
                      </button>
                    ) : null}
                  </div>
                </form>
              </div>
            </div>
          </div>
        ) : null}

        <div className={canManageObjects ? 'col-xl-8' : 'col-xl-12'}>
          <div className="card">
            <div className="px-4 py-3 border-bottom">
              <h5 className="card-title fw-semibold mb-0 lh-sm">Liste der Immobilienobjekte</h5>
            </div>
            <div className="card-body p-4">
              <div className="row g-3 mb-4">
                <div className="col-md-6">
                  <label className="form-label">Suche</label>
                  <input
                    className="form-control"
                    name="search"
                    value={filters.search}
                    onChange={handleFilterChange}
                    placeholder="Nach Adresse, Ort, Nutzung oder Immobilie suchen"
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Status</label>
                  <select className="form-select" name="status" value={filters.status} onChange={handleFilterChange}>
                    <option value="">All Status</option>
                    <option value="active">Aktiv</option>
                    <option value="inactive">Inaktiv</option>
                    <option value="archived">Archiviert</option>
                  </select>
                </div>
                <div className="col-md-3 d-flex align-items-end">
                  <button
                    type="button"
                    className="btn btn-light-primary w-100"
                    onClick={() => setFilters({ search: '', status: '' })}
                  >
                    Zurücksetzen
                  </button>
                </div>
              </div>

              {isLoading ? <p className="text-muted mb-0">Immobilienobjekte werden geladen...</p> : null}
              {!isLoading && error ? <div className="alert alert-danger py-2">{error}</div> : null}

              {!isLoading ? (
                <div className="table-responsive rounded-2 mb-0 vergo-table-scroll">
                  <table className="table border text-nowrap customize-table mb-0 align-middle">
                    <thead className="text-dark fs-4">
                      <tr>
                        <th><h6 className="fs-4 fw-semibold mb-0">Immobilie</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">Adresse</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">PLZ / Ort</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">Nutzung</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">Stockwerke</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">Status</h6></th>
                        <th width="90"><h6 className="fs-4 fw-semibold mb-0">Aktion</h6></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredObjects.map((object) => (
                        <tr key={object.id}>
                          <td>
                            <div className="fw-semibold">{object.property?.li_number ?? '-'}</div>
                            <div className="text-muted">{object.property?.title ?? '-'}</div>
                          </td>
                          <td>{object.address || object.name || '-'}</td>
                          <td>{[object.postal_code, object.city].filter(Boolean).join(' ') || '-'}</td>
                          <td>{getOptionLabel(PROPERTY_OBJECT_TYPE_OPTIONS, object.type)}</td>
                          <td>{object.floors ?? '-'}</td>
                          <td>
                            <span className={getStatusBadgeClass(object.status)}>
                              {formatStatusLabel(object.status)}
                            </span>
                          </td>
                          <td>
                            {canManageObjects ? (
                              <div className="table-action-group">
                                <button
                                  type="button"
                                  className="table-action-btn table-action-edit"
                                  onClick={() => handleEdit(object)}
                                  title="Immobilienobjekt bearbeiten"
                                >
                                  <i className="ti ti-pencil"></i>
                                </button>
                                <button
                                  type="button"
                                  className="table-action-btn table-action-delete"
                                  onClick={() => handleDelete(object.id)}
                                  title="Immobilienobjekt löschen"
                                >
                                  <i className="ti ti-trash"></i>
                                </button>
                              </div>
                            ) : '-'}
                          </td>
                        </tr>
                      ))}

                      {filteredObjects.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="text-center text-muted py-4">
                            Keine Immobilienobjekte gefunden.
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
    </PageContent>
  )
}

export default PropertyObjectsPage
