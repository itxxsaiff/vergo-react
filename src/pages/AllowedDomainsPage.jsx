import { useEffect, useState } from 'react'
import PageContent from '../components/PageContent'
import { confirmDelete, showDeleteSuccess } from '../lib/alerts'
import { api } from '../lib/api'
import { formatStatusLabel, getStatusBadgeClass } from '../lib/tableStatus'

const initialForm = {
  property_id: '',
  domain: '',
  is_active: '1',
}

function AllowedDomainsPage() {
  const [domains, setDomains] = useState([])
  const [properties, setProperties] = useState([])
  const [form, setForm] = useState(initialForm)
  const [filters, setFilters] = useState({ search: '', status: '' })
  const [editingId, setEditingId] = useState(null)
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
      const [domainsResponse, propertiesResponse] = await Promise.all([
        api.getAllowedDomains(),
        api.getProperties(),
      ])
      setDomains(domainsResponse.data ?? [])
      setProperties(propertiesResponse.data ?? [])
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

  function handleEdit(item) {
    setEditingId(item.id)
    setForm({
      property_id: String(item.property_id),
      domain: item.domain || '',
      is_active: item.is_active ? '1' : '0',
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

    if (!form.property_id) {
      setError('Bitte wählen Sie eine Immobilie aus.')
      setIsSaving(false)
      return
    }

    if (!form.domain.trim()) {
      setError('Die Domain ist erforderlich.')
      setIsSaving(false)
      return
    }

    try {
      const payload = {
        property_id: Number(form.property_id),
        domain: form.domain.trim().toLowerCase(),
        is_active: form.is_active === '1',
      }

      if (editingId) {
        const response = await api.updateAllowedDomain(editingId, payload)
        setDomains((current) => current.map((item) => (item.id === editingId ? response.data : item)))
      } else {
        const response = await api.createAllowedDomain(payload)
        setDomains((current) => [response.data, ...current])
      }

      closeModal()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(domainId) {
    const shouldDelete = await confirmDelete('allowed domain')
    if (!shouldDelete) return

    try {
      await api.deleteAllowedDomain(domainId)
      setDomains((current) => current.filter((item) => item.id !== domainId))
      showDeleteSuccess('allowed domain')
      if (editingId === domainId) closeModal()
    } catch (deleteError) {
      setError(deleteError.message)
    }
  }

  const filteredDomains = domains.filter((item) => {
    const searchValue = [
      item.domain,
      item.property?.li_number,
      item.property?.title,
    ].filter(Boolean).join(' ').toLowerCase()
    const searchMatch = !filters.search || searchValue.includes(filters.search.toLowerCase())
    const statusValue = item.is_active ? 'active' : 'inactive'
    const statusMatch = !filters.status || statusValue === filters.status.toLowerCase()
    return searchMatch && statusMatch
  })

  return (
    <PageContent
      title="Erlaubte Domains"
      subtitle="Verwalten Sie, welche E-Mail-Domains für jede Immobilie berechtigt sind, OTP-Zugang anzufordern."
      breadcrumbs={[
        { label: 'Armaturenbrett', href: '/dashboard' },
        { label: 'Erlaubte Domains' },
      ]}
    >
      <div className="card">
        <div className="px-4 py-3 border-bottom d-flex align-items-center justify-content-between gap-3">
          <h5 className="card-title fw-semibold mb-0 lh-sm">Liste der erlaubten Domains</h5>
          <button type="button" className="btn btn-primary" onClick={openCreateModal}>
            <i className="ti ti-plus me-1"></i>
            Domain hinzufügen
          </button>
        </div>
        <div className="card-body p-4">
          <div className="row g-3 mb-4">
            <div className="col-md-7">
              <label className="form-label">Suche</label>
              <input
                className="form-control"
                name="search"
                value={filters.search}
                onChange={handleFilterChange}
                placeholder="Nach Domain, Li-Nummer oder Immobilie suchen"
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Status</label>
              <select className="form-select" name="status" value={filters.status} onChange={handleFilterChange}>
                <option value="">All Status</option>
                <option value="active">Aktiv</option>
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
          {isLoading ? <p className="text-muted mb-0">Erlaubte Domains werden geladen...</p> : null}

          {!isLoading ? (
            <div className="table-responsive rounded-2 mb-0 vergo-table-scroll">
              <table className="table border text-nowrap customize-table mb-0 align-middle">
                <thead className="text-dark fs-4">
                  <tr>
                    <th><h6 className="fs-4 fw-semibold mb-0">Immobilie</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">Domain</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">Status</h6></th>
                    <th width="110"><h6 className="fs-4 fw-semibold mb-0">Aktion</h6></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDomains.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="fw-semibold">{item.property?.li_number ?? '-'}</div>
                        <div className="text-muted">{item.property?.title ?? '-'}</div>
                      </td>
                      <td>{item.domain}</td>
                      <td>
                        <span className={getStatusBadgeClass(item.is_active ? 'active' : 'inactive')}>
                          {formatStatusLabel(item.is_active ? 'active' : 'inactive')}
                        </span>
                      </td>
                      <td>
                        <div className="table-action-group">
                          <button type="button" className="table-action-btn table-action-edit" onClick={() => handleEdit(item)} title="Domain bearbeiten">
                            <i className="ti ti-pencil"></i>
                          </button>
                          <button type="button" className="table-action-btn table-action-delete" onClick={() => handleDelete(item.id)} title="Domain löschen">
                            <i className="ti ti-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredDomains.length === 0 ? (
                    <tr><td colSpan="4" className="text-center text-muted py-4">Keine erlaubten Domains gefunden.</td></tr>
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
                  <h5 className="modal-title">{editingId ? 'Erlaubte Domain bearbeiten' : 'Erlaubte Domain hinzufügen'}</h5>
                  <button type="button" className="btn-close" onClick={closeModal}></button>
                </div>
                <form onSubmit={handleSubmit}>
                  <div className="modal-body">
                    <div className="row">
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Immobilie</label>
                        <select className="form-select" name="property_id" value={form.property_id} onChange={handleChange}>
                          <option value="">Immobilie auswählen</option>
                          {properties.map((property) => (
                            <option key={property.id} value={property.id}>{property.li_number} - {property.title}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Domain</label>
                        <input className="form-control" name="domain" value={form.domain} onChange={handleChange} placeholder="example.com" />
                      </div>
                      <div className="col-md-6 mb-0">
                        <label className="form-label">Status</label>
                        <select className="form-select" name="is_active" value={form.is_active} onChange={handleChange}>
                          <option value="1">Aktiv</option>
                          <option value="0">Inaktiv</option>
                        </select>
                      </div>
                    </div>
                    {error ? <div className="alert alert-danger py-2 mt-3 mb-0">{error}</div> : null}
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-light-danger text-danger" onClick={closeModal}>Abbrechen</button>
                    <button type="submit" className="btn btn-primary" disabled={isSaving}>
                      {isSaving ? 'Wird gespeichert...' : editingId ? 'Domain aktualisieren' : 'Domain hinzufügen'}
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

export default AllowedDomainsPage
