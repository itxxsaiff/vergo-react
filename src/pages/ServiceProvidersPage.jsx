import { useEffect, useState } from 'react'
import PageContent from '../components/PageContent'
import { confirmDelete, showDeleteSuccess } from '../lib/alerts'
import { api } from '../lib/api'
import { formatStatusLabel, getStatusBadgeClass } from '../lib/tableStatus'

const initialForm = {
  company_name: '',
  contact_name: '',
  contact_email: '',
  password: '',
  phone: '',
  status: 'active',
}

function ServiceProvidersPage() {
  const [providers, setProviders] = useState([])
  const [form, setForm] = useState(initialForm)
  const [filters, setFilters] = useState({ search: '', status: '' })
  const [editingId, setEditingId] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadProviders()
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

  async function loadProviders() {
    setIsLoading(true)
    setError('')

    try {
      const response = await api.getServiceProviders()
      setProviders(response.data ?? [])
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setIsLoading(false)
    }
  }

  function handleChange(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  function handleFilterChange(event) {
    const { name, value } = event.target
    setFilters((current) => ({ ...current, [name]: value }))
  }

  function openCreateModal() {
    setEditingId(null)
    setForm(initialForm)
    setError('')
    setIsModalOpen(true)
  }

  function handleEdit(provider) {
    setEditingId(provider.id)
    setForm({
      company_name: provider.company_name || '',
      contact_name: provider.contact_name || '',
      contact_email: provider.contact_email || '',
      password: '',
      phone: provider.phone || '',
      status: provider.status || 'active',
    })
    setError('')
    setIsModalOpen(true)
  }

  function closeModal() {
    setEditingId(null)
    setForm(initialForm)
    setError('')
    setIsModalOpen(false)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setIsSaving(true)
    setError('')

    if (!form.company_name.trim()) {
  setError('Der Firmenname ist erforderlich.')
  setIsSaving(false)
  return
}

if (!form.contact_email.trim()) {
  setError('Die Kontakt-E-Mail ist erforderlich.')
  setIsSaving(false)
  return
}

if (!editingId && !form.password.trim()) {
  setError('Für einen neuen Dienstleister ist ein Passwort erforderlich.')
  setIsSaving(false)
  return
}

if (form.password && form.password.length < 8) {
  setError('Das Passwort muss mindestens 8 Zeichen lang sein.')
  setIsSaving(false)
  return
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
if (!emailPattern.test(form.contact_email.trim())) {
  setError('Bitte geben Sie eine gültige Kontakt-E-Mail-Adresse ein.')
  setIsSaving(false)
  return
}

    try {
      const payload = {
        ...form,
        contact_name: form.contact_name || null,
        password: form.password || null,
        phone: form.phone || null,
      }

      if (editingId) {
        const response = await api.updateServiceProvider(editingId, payload)
        setProviders((current) => current.map((provider) => (provider.id === editingId ? response.data : provider)))
      } else {
        const response = await api.createServiceProvider(payload)
        setProviders((current) => [response.data, ...current])
      }

      closeModal()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(providerId) {
    const shouldDelete = await confirmDelete('service provider')
    if (!shouldDelete) return

    try {
      await api.deleteServiceProvider(providerId)
      setProviders((current) => current.filter((provider) => provider.id !== providerId))
      showDeleteSuccess('service provider')
      if (editingId === providerId) closeModal()
    } catch (deleteError) {
      setError(deleteError.message)
    }
  }

  const filteredProviders = providers.filter((provider) => {
    const searchValue = [
      provider.company_name,
      provider.contact_name,
      provider.contact_email,
      provider.phone,
    ].filter(Boolean).join(' ').toLowerCase()

    const searchMatch = !filters.search || searchValue.includes(filters.search.toLowerCase())
    const statusMatch = !filters.status || String(provider.status || '').toLowerCase() === filters.status.toLowerCase()

    return searchMatch && statusMatch
  })

  return (
    <PageContent
      title="Dienstleister"
      subtitle="Verwalten Sie Anbieterunternehmen, die für Ausschreibungen und die Teilnahme an Aufträgen verfügbar sind."
      breadcrumbs={[
        { label: 'Armaturenbrett', href: '/dashboard' },
        { label: 'Dienstleister' },
      ]}
      actions={(
        <button type="button" className="btn btn-primary" onClick={openCreateModal}>
          <i className="ti ti-plus me-1"></i>
          Dienstleister erstellen
        </button>
      )}
    >
      <div className="card">
  <div className="card-body p-4">
    <div className="row g-3 mb-4 vergo-filter-bar">
      <div className="col-md-7">
        <label className="form-label">Suche</label>
        <input
          className="form-control"
          name="search"
          value={filters.search}
          onChange={handleFilterChange}
          placeholder="Nach Unternehmen, Kontakt, E-Mail oder Telefon suchen"
        />
      </div>
      <div className="col-md-3">
        <label className="form-label">Status</label>
        <select className="form-select" name="status" value={filters.status} onChange={handleFilterChange}>
          <option value="">All Status</option>
          <option value="active">Aktiv</option>
          <option value="pending">Ausstehend</option>
          <option value="inactive">Inaktiv</option>
        </select>
      </div>
      <div className="col-md-2 d-flex align-items-end">
        <button type="button" className="btn btn-light-primary w-100" onClick={() => setFilters({ search: '', status: '' })}>
          Zurücksetzen
        </button>
      </div>
    </div>

    {error && !isModalOpen ? <div className="alert alert-danger py-2">{error}</div> : null}
    {isLoading ? <p className="text-muted mb-0">Dienstleister werden geladen...</p> : null}

    {!isLoading ? (
      <div className="table-responsive rounded-2 mb-0 vergo-table-scroll">
        <table className="table border-none text-nowrap customize-table mb-0 align-middle">
          <thead className="text-dark fs-4">
            <tr>
              <th><h6 className="fs-4 fw-semibold mb-0">Unternehmen</h6></th>
              <th><h6 className="fs-4 fw-semibold mb-0">Kontakt</h6></th>
              <th><h6 className="fs-4 fw-semibold mb-0">Telefon</h6></th>
              <th><h6 className="fs-4 fw-semibold mb-0">Bewertung</h6></th>
              <th><h6 className="fs-4 fw-semibold mb-0">Abgeschlossen</h6></th>
              <th><h6 className="fs-4 fw-semibold mb-0">Angebote</h6></th>
              <th><h6 className="fs-4 fw-semibold mb-0">Status</h6></th>
              <th width="110"><h6 className="fs-4 fw-semibold mb-0">Aktion</h6></th>
            </tr>
          </thead>
          <tbody>
            {filteredProviders.map((provider) => (
              <tr key={provider.id}>
                <td className="fw-semibold">{provider.company_name}</td>
                <td>
                  <div>{provider.contact_name || '-'}</div>
                  <div className="text-muted">{provider.contact_email}</div>
                </td>
                <td>{provider.phone || '-'}</td>
                <td>{provider.rating ?? '-'}</td>
                <td>{provider.completed_jobs_count ?? 0}</td>
                <td>{provider.bids_count ?? 0}</td>
                <td><span className={getStatusBadgeClass(provider.status)}>{formatStatusLabel(provider.status)}</span></td>
                <td>
                  <div className="table-action-group">
                    <button type="button" className="table-action-btn table-action-edit" onClick={() => handleEdit(provider)} title="Dienstleister bearbeiten">
                      <i className="ti ti-pencil"></i>
                    </button>
                    <button type="button" className="table-action-btn table-action-delete" onClick={() => handleDelete(provider.id)} title="Dienstleister löschen">
                      <i className="ti ti-trash"></i>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredProviders.length === 0 ? (
              <tr><td colSpan="8" className="text-center text-muted py-4">Keine Dienstleister gefunden.</td></tr>
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
        <h5 className="modal-title">{editingId ? 'Dienstleister bearbeiten' : 'Dienstleister erstellen'}</h5>
        <button type="button" className="btn-close" onClick={closeModal}></button>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="modal-body">
          <div className="row">
            <div className="col-md-6 mb-3">
              <label className="form-label">Firmenname</label>
              <input className="form-control" name="company_name" value={form.company_name} onChange={handleChange} />
            </div>
            <div className="col-md-6 mb-3">
              <label className="form-label">Kontaktname</label>
              <input className="form-control" name="contact_name" value={form.contact_name} onChange={handleChange} />
            </div>
            <div className="col-md-6 mb-3">
              <label className="form-label">Kontakt-E-Mail</label>
              <input className="form-control" name="contact_email" value={form.contact_email} onChange={handleChange} />
            </div>
            <div className="col-md-6 mb-3">
              <label className="form-label">{editingId ? 'Passwort (optional)' : 'Passwort'}</label>
              <input type="password" className="form-control" name="password" value={form.password} onChange={handleChange} />
            </div>
            <div className="col-md-6 mb-3">
              <label className="form-label">Telefon</label>
              <input className="form-control" name="phone" value={form.phone} onChange={handleChange} />
            </div>
            <div className="col-md-6 mb-0">
              <label className="form-label">Status</label>
              <select className="form-select" name="status" value={form.status} onChange={handleChange}>
                <option value="active">Aktiv</option>
                <option value="pending">Ausstehend</option>
                <option value="inactive">Inaktiv</option>
              </select>
            </div>
          </div>
          {error ? <div className="alert alert-danger py-2 mt-3 mb-0">{error}</div> : null}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-light-danger text-danger" onClick={closeModal}>Abbrechen</button>
          <button type="submit" className="btn btn-primary" disabled={isSaving}>
            {isSaving ? 'Wird gespeichert...' : editingId ? 'Dienstleister aktualisieren' : 'Dienstleister erstellen'}
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

export default ServiceProvidersPage
