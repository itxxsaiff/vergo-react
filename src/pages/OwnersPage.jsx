import { useEffect, useState } from 'react'
import PageContent from '../components/PageContent'
import { confirmDelete, showDeleteSuccess } from '../lib/alerts'
import { api } from '../lib/api'
import { formatStatusLabel, getStatusBadgeClass } from '../lib/tableStatus'

const initialForm = {
  name: '',
  email: '',
  password: '',
  phone: '',
}

function OwnersPage() {
  const [owners, setOwners] = useState([])
  const [form, setForm] = useState(initialForm)
  const [filters, setFilters] = useState({
    search: '',
    status: '',
  })
  const [editingOwnerId, setEditingOwnerId] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  async function loadOwners() {
    setIsLoading(true)
    setError('')

    try {
      const response = await api.getOwners()
      setOwners(response.data ?? [])
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadOwners()
  }, [])

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

    if (!form.name.trim()) {
      setError('Name des Eigentümers ist erforderlich.')
      setIsSaving(false)
      return
    }

    if (!form.email.trim()) {
      setError('E-Mail des Eigentümers ist erforderlich.')
      setIsSaving(false)
      return
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!emailPattern.test(form.email.trim())) {
      setError('Bitte geben Sie eine gültige E-Mail-Adresse des Eigentümers ein.')
      setIsSaving(false)
      return
    }

    if (!editingOwnerId && !form.password.trim()) {
      setError('Für einen neuen Eigentümer ist ein Passwort erforderlich.')
      setIsSaving(false)
      return
    }

    if (form.password && form.password.length < 8) {
      setError('Das Passwort muss mindestens 8 Zeichen lang sein.')
      setIsSaving(false)
      return
    }
    try {
      const payload = {
        ...form,
        password: form.password || undefined,
      }

      if (editingOwnerId) {
        const response = await api.updateOwner(editingOwnerId, payload)
        setOwners((current) => current.map((owner) => (
          owner.id === editingOwnerId ? response.data : owner
        )))
      } else {
        const response = await api.createOwner(payload)
        setOwners((current) => [response.data, ...current])
      }

      setForm(initialForm)
      setEditingOwnerId(null)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setIsSaving(false)
    }
  }

  function handleEdit(owner) {
    setEditingOwnerId(owner.id)
    setForm({
      name: owner.name,
      email: owner.email,
      password: '',
      phone: owner.phone || '',
    })
    setError('')
  }

  function handleCancelEdit() {
    setEditingOwnerId(null)
    setForm(initialForm)
    setError('')
  }

  async function handleDelete(ownerId) {
    const shouldDelete = await confirmDelete('owner')

    if (!shouldDelete) {
      return
    }

    try {
      await api.deleteOwner(ownerId)
      setOwners((current) => current.filter((owner) => owner.id !== ownerId))
      showDeleteSuccess('owner')

      if (editingOwnerId === ownerId) {
        handleCancelEdit()
      }
    } catch (deleteError) {
      setError(deleteError.message)
    }
  }

  const filteredOwners = owners.filter((owner) => {
    const searchValue = [
      owner.name,
      owner.email,
      owner.phone,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    const searchMatch = !filters.search || searchValue.includes(filters.search.toLowerCase())
    const statusMatch = !filters.status || String(owner.status || '').toLowerCase() === filters.status.toLowerCase()

    return searchMatch && statusMatch
  })

  return (
    <PageContent
      title="Eigentümer"
      subtitle="Erstellen Sie Eigentümerkonten und verfolgen Sie die ihnen zugewiesenen Objekte."
      breadcrumbs={[
        { label: 'Armaturenbrett', href: '/dashboard' },
        { label: 'Eigentümer' },
      ]}
    >
      <div className="row">
        <div className="col-xl-4">
          <div className="card">
            <div className="card-body">
              <h4 className="card-title mb-4">Eigentümer erstellen</h4>
              {editingOwnerId ? <p className="text-muted">Ausgewählten Eigentümer bearbeiten.</p> : null}

              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label">Name</label>
                  <input className="form-control" name="name" value={form.name} onChange={handleChange} />
                </div>

                <div className="mb-3">
                  <label className="form-label">E-Mail</label>
                  <input type="email" className="form-control" name="email" value={form.email} onChange={handleChange} />
                </div>

                <div className="mb-3">
                  <label className="form-label">Telefon</label>
                  <input className="form-control" name="phone" value={form.phone} onChange={handleChange} />
                </div>

                <div className="mb-3">
                  <label className="form-label">Passwort</label>
                  <input type="password" className="form-control" name="password" value={form.password} onChange={handleChange} />
                </div>

                {error ? <div className="alert alert-danger py-2">{error}</div> : null}

                <div className="d-flex gap-2">
                  <button type="submit" className="btn btn-primary waves-effect waves-light" disabled={isSaving}>
                    {isSaving ? 'Wird gespeichert...' : editingOwnerId ? 'Eigentümer aktualisieren' : 'Eigentümer erstellen'}
                  </button>
                  {editingOwnerId ? (
                    <button type="button" className="btn btn-light border" onClick={handleCancelEdit}>
                      Abbrechen
                    </button>
                  ) : null}
                </div>
              </form>
            </div>
          </div>
        </div>

        <div className="col-xl-8">
          <div className="card">
            <div className="px-4 py-3 border-bottom">
              <h5 className="card-title fw-semibold mb-0 lh-sm">Eigentümerliste</h5>
            </div>
            <div className="card-body p-4">
              <div className="row g-3 mb-4 vergo-filter-bar">
                <div className="col-md-6">
                  <label className="form-label">Suche</label>
                  <input
                    className="form-control"
                    name="search"
                    value={filters.search}
                    onChange={handleFilterChange}
                    placeholder="Suche nach Name, E-Mail oder Telefon"
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Status</label>
                  <select className="form-select" name="status" value={filters.status} onChange={handleFilterChange}>
                    <option value="">All Status</option>
                    <option value="active">Aktiv</option>
                    <option value="inactive">Inaktiv</option>
                    <option value="pending">Ausstehend</option>
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

              {isLoading ? <p className="text-muted mb-0">Eigentümer werden geladen...</p> : null}

              {!isLoading ? (
                <div className="table-responsive rounded-2 mb-0 vergo-table-scroll">
                  <table className="table border-none text-nowrap customize-table mb-0 align-middle">
                    <thead className="text-dark fs-4">
                      <tr>
                        <th><h6 className="fs-4 fw-semibold mb-0">Name</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">E-Mail</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">Telefon</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">Objekte</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">Status</h6></th>
                        <th width="90"><h6 className="fs-4 fw-semibold mb-0">Aktion</h6></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOwners.map((owner) => (
                        <tr key={owner.id}>
                          <td>{owner.name}</td>
                          <td>{owner.email}</td>
                          <td>{owner.phone || '-'}</td>
                          <td>{owner.properties_count ?? 0}</td>
                          <td>
                            <span className={getStatusBadgeClass(owner.status)}>
                              {formatStatusLabel(owner.status)}
                            </span>
                          </td>
                          <td>
                            <div className="table-action-group">
                              <button
                                type="button"
                                className="table-action-btn table-action-edit"
                                onClick={() => handleEdit(owner)}
                                title="Eigentümer bearbeiten"
                              >
                                <i className="ti ti-pencil"></i>
                              </button>
                              <button
                                type="button"
                                className="table-action-btn table-action-delete"
                                onClick={() => handleDelete(owner.id)}
                                title="Eigentümer löschen"
                              >
                                <i className="ti ti-trash"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {filteredOwners.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="text-center text-muted py-4">
                            Keine Eigentümer gefunden.
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

export default OwnersPage
