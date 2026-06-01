import { useEffect, useMemo, useState } from 'react'
import PageContent from '../components/PageContent'
import { confirmDelete, showDeleteSuccess } from '../lib/alerts'
import { api } from '../lib/api'
import { formatStatusLabel, getStatusBadgeClass } from '../lib/tableStatus'

const initialForm = {
  owner_type: 'company',
  company_name: '',
  first_name: '',
  last_name: '',
  address: '',
  postal_code: '',
  city: '',
  domain_suffix: '',
  email: '',
  phone: '',
}

function getDisplayName(owner) {
  if (owner.owner_type === 'company') {
    return owner.company_name || owner.name || '-'
  }

  return [owner.first_name, owner.last_name].filter(Boolean).join(' ') || owner.name || '-'
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

  const isCompany = form.owner_type === 'company'

  const filteredOwners = useMemo(() => {
    return owners.filter((owner) => {
      const searchValue = [
        owner.name,
        owner.company_name,
        owner.first_name,
        owner.last_name,
        owner.address,
        owner.city,
        owner.email,
        owner.domain_suffix,
        owner.phone,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      const searchMatch = !filters.search || searchValue.includes(filters.search.toLowerCase())
      const statusMatch = !filters.status || String(owner.status || '').toLowerCase() === filters.status.toLowerCase()

      return searchMatch && statusMatch
    })
  }, [filters.search, filters.status, owners])

  function handleChange(event) {
    const { name, value } = event.target

    setForm((current) => {
      const next = {
        ...current,
        [name]: value,
      }

      if (name === 'owner_type') {
        if (value === 'company') {
          next.first_name = ''
          next.last_name = ''
          next.phone = ''
        } else {
          next.company_name = ''
          next.domain_suffix = ''
        }
      }

      return next
    })
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

    try {
      const payload = {
        owner_type: form.owner_type,
        company_name: isCompany ? form.company_name.trim() : null,
        first_name: isCompany ? null : form.first_name.trim(),
        last_name: isCompany ? null : form.last_name.trim(),
        address: form.address.trim(),
        postal_code: form.postal_code.trim(),
        city: form.city.trim(),
        domain_suffix: isCompany ? form.domain_suffix.trim().replace(/^@+/, '').toLowerCase() : null,
        email: form.email.trim().toLowerCase(),
        phone: isCompany ? null : form.phone.trim(),
        status: 'active',
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
      owner_type: owner.owner_type || 'company',
      company_name: owner.company_name || '',
      first_name: owner.first_name || '',
      last_name: owner.last_name || '',
      address: owner.address || '',
      postal_code: owner.postal_code || '',
      city: owner.city || '',
      domain_suffix: owner.domain_suffix || '',
      email: owner.email || '',
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

  return (
    <PageContent
      title="Eigentümer"
      subtitle="Erstellen Sie Eigentümer als Firma oder Privatperson und hinterlegen Sie nur die für den Login benötigten Stammdaten."
      breadcrumbs={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Eigentümer' },
      ]}
    >
      <div className="row">
        <div className="col-xl-5">
          <div className="card">
            <div className="card-body">
              <h4 className="card-title mb-4">Eigentümer erstellen</h4>
              {editingOwnerId ? <p className="text-muted">Ausgewählten Eigentümer bearbeiten.</p> : null}

              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label d-block">Typ</label>
                  <div className="d-flex flex-wrap gap-3">
                    <label className="form-check mb-0">
                      <input className="form-check-input" type="radio" name="owner_type" value="company" checked={form.owner_type === 'company'} onChange={handleChange} />
                      <span className="form-check-label ms-2">Firma</span>
                    </label>
                    <label className="form-check mb-0">
                      <input className="form-check-input" type="radio" name="owner_type" value="private_individual" checked={form.owner_type === 'private_individual'} onChange={handleChange} />
                      <span className="form-check-label ms-2">Privatperson</span>
                    </label>
                  </div>
                </div>

                {isCompany ? (
                  <div className="mb-3">
                    <label className="form-label">Firmenname</label>
                    <input className="form-control" name="company_name" value={form.company_name} onChange={handleChange} />
                  </div>
                ) : (
                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Vorname</label>
                        <input className="form-control" name="first_name" value={form.first_name} onChange={handleChange} />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Nachname</label>
                        <input className="form-control" name="last_name" value={form.last_name} onChange={handleChange} />
                      </div>
                    </div>
                  </div>
                )}

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
                  <label className="form-label">E-Mail</label>
                  <input type="email" className="form-control" name="email" value={form.email} onChange={handleChange} />
                </div>

                {isCompany ? (
                  <div className="mb-3">
                    <label className="form-label">Domain-Endung</label>
                    <input className="form-control" name="domain_suffix" value={form.domain_suffix} onChange={handleChange} placeholder="beispiel.ch" />
                  </div>
                ) : (
                  <> 
                    <div className="mb-3">
                      <label className="form-label">Telefon</label>
                      <input className="form-control" name="phone" value={form.phone} onChange={handleChange} />
                    </div>
                  </>
                )}

                <div className="alert alert-light border small">
                  {isCompany
                    ? 'Firmen-Eigentümer melden sich über die Domain-Endung und einen Code an. Die E-Mail-Adresse dient hier nur als Kontaktoption. Ein Passwort wird nicht gesetzt.'
                    : 'Privatpersonen melden sich mit genau dieser E-Mail-Adresse und einem Code per E-Mail an. Ein Passwort wird nicht gesetzt.'}
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

        <div className="col-xl-7">
          <div className="card">
            <div className="px-4 py-3 border-bottom">
              <h5 className="card-title fw-semibold mb-0 lh-sm">Eigentümerliste</h5>
            </div>
            <div className="card-body p-4">
              <div className="row g-3 mb-4 vergo-filter-bar">
                <div className="col-md-6">
                  <label className="form-label">Suche</label>
                  <div className="vergo-search-input-wrap">
                    <i className="ti ti-search vergo-search-input-icon" aria-hidden="true"></i>
                    <input
                      aria-label="Suche"
                      className="form-control"
                      name="search"
                      value={filters.search}
                      onChange={handleFilterChange}
                      placeholder="Suche nach Name, Domain, E-Mail oder Ort"
                    />
                  </div>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Status</label>
                  <div className="vergo-select-input-wrap">
                    <i className="ti ti-adjustments vergo-select-input-icon" aria-hidden="true"></i>
                    <select aria-label="Status" className="form-select" name="status" value={filters.status} onChange={handleFilterChange}>
                      <option value="">All Status</option>
                      <option value="active">Aktiv</option>
                      <option value="inactive">Inaktiv</option>
                    </select>
                  </div>
                </div>
                <div className="col-md-3 d-flex align-items-end justify-content-end vergo-filter-reset-wrap">
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

              {isLoading ? <p className="text-muted mb-0">Eigentümer werden geladen...</p> : null}

              {!isLoading ? (
                <div className="table-responsive rounded-2 mb-0 vergo-table-scroll">
                  <table className="table border-none text-nowrap customize-table mb-0 align-middle">
                    <thead className="text-dark fs-4">
                      <tr>
                        <th><h6 className="fs-4 fw-semibold mb-0">Typ</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">Name</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">Login</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">Ort</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">Liegenschaften</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">Status</h6></th>
                        <th width="90"><h6 className="fs-4 fw-semibold mb-0">Aktion</h6></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOwners.map((owner) => (
                        <tr key={owner.id}>
                          <td>{owner.owner_type === 'company' ? 'Firma' : 'Privatperson'}</td>
                          <td className="fw-semibold">{getDisplayName(owner)}</td>
                          <td>{owner.owner_type === 'company' ? `@${owner.domain_suffix || '-'}` : owner.email || '-'}</td>
                          <td>{[owner.postal_code, owner.city].filter(Boolean).join(' ') || '-'}</td>
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
                          <td colSpan="7" className="text-center text-muted py-4">
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
