import { useEffect, useState } from 'react'
import PageContent from '../components/PageContent'
import { confirmDelete, showDeleteSuccess } from '../lib/alerts'
import { api } from '../lib/api'
import { formatStatusLabel, getStatusBadgeClass } from '../lib/tableStatus'

function PropertyManagersPage() {
  const [managers, setManagers] = useState([])
  const [filters, setFilters] = useState({ search: '', status: '' })
  const [editingManager, setEditingManager] = useState(null)
  const [name, setName] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadManagers()
  }, [])

  async function loadManagers() {
    setIsLoading(true)
    setError('')

    try {
      const response = await api.getPropertyManagers()
      setManagers(response.data ?? [])
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setIsLoading(false)
    }
  }

  function handleFilterChange(event) {
    const { name, value } = event.target
    setFilters((current) => ({ ...current, [name]: value }))
  }

  function handleEdit(manager) {
    setEditingManager(manager)
    setName(manager.name || '')
    setError('')
  }

  function closeModal() {
    setEditingManager(null)
    setName('')
    setError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setIsSaving(true)
    setError('')

    try {
      const response = await api.updatePropertyManager(editingManager.id, { name: name || null })
      setManagers((current) => current.map((manager) => (manager.id === editingManager.id ? response.data : manager)))
      closeModal()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(managerId) {
    const shouldDelete = await confirmDelete('property manager')
    if (!shouldDelete) return

    try {
      await api.deletePropertyManager(managerId)
      setManagers((current) => current.filter((manager) => manager.id !== managerId))
      showDeleteSuccess('property manager')
      if (editingManager?.id === managerId) closeModal()
    } catch (deleteError) {
      setError(deleteError.message)
    }
  }

  const filteredManagers = managers.filter((manager) => {
    const searchValue = [
      manager.name,
      manager.email,
      manager.property?.li_number,
      manager.property?.title,
    ].filter(Boolean).join(' ').toLowerCase()
    const searchMatch = !filters.search || searchValue.includes(filters.search.toLowerCase())
    const statusMatch = !filters.status || 'active' === filters.status.toLowerCase()
    return searchMatch && statusMatch
  })

  return (
    <PageContent
      title="Immobilienverwalter"
      subtitle="Überprüfen Sie OTP-basierte Immobilienverwalter, die mit Li-Nummern verknüpft sind, sowie deren Auftragshistorie."
      breadcrumbs={[
        { label: 'Armaturenbrett', href: '/dashboard' },
        { label: 'Immobilienverwalter' },
      ]}
    >
      <div className="card">
        <div className="px-4 py-3 border-bottom">
          <h5 className="card-title fw-semibold mb-0 lh-sm">Liste der Immobilienverwalter</h5>
        </div>
        <div className="card-body p-4">
          <div className="row g-3 mb-4 vergo-filter-bar">
            <div className="col-md-7">
              <label className="form-label">Suche</label>
              <input
                className="form-control"
                name="search"
                value={filters.search}
                onChange={handleFilterChange}
                placeholder="Nach Name, E-Mail, Li-Nummer oder Immobilie suchen"
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Status</label>
              <select className="form-select" name="status" value={filters.status} onChange={handleFilterChange}>
                <option value="">All Status</option>
                <option value="active">Aktiv</option>
              </select>
            </div>
            <div className="col-md-2 d-flex align-items-end">
              <button type="button" className="btn btn-light-primary w-100" onClick={() => setFilters({ search: '', status: '' })}>
                Zurücksetzen
              </button>
            </div>
          </div>

          {error && !editingManager ? <div className="alert alert-danger py-2">{error}</div> : null}
          {isLoading ? <p className="text-muted mb-0">Immobilienverwalter werden geladen...</p> : null}

          {!isLoading ? (
            <div className="table-responsive rounded-2 mb-0 vergo-table-scroll">
              <table className="table border-none text-nowrap customize-table mb-0 align-middle">
                <thead className="text-dark fs-4">
                  <tr>
                    <th><h6 className="fs-4 fw-semibold mb-0">Verwalter</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">Immobilie</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">Aufträge</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">Letzte Anmeldung</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">Status</h6></th>
                    <th width="110"><h6 className="fs-4 fw-semibold mb-0">Aktion</h6></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredManagers.map((manager) => (
                    <tr key={manager.id}>
                      <td>
                        <div>{manager.name || 'Immobilienverwalter'}</div>
                        <div className="text-muted">{manager.email}</div>
                      </td>
                      <td>
                        <div className="fw-semibold">{manager.property?.li_number ?? '-'}</div>
                        <div className="text-muted">{manager.property?.title ?? '-'}</div>
                      </td>
                      <td>{manager.orders_count ?? 0}</td>
                      <td>{manager.last_login_at || '-'}</td>
                      <td><span className={getStatusBadgeClass('active')}>{formatStatusLabel('active')}</span></td>
                      <td>
                        <div className="table-action-group">
                          <button type="button" className="table-action-btn table-action-edit" onClick={() => handleEdit(manager)} title="Immobilienverwalter bearbeiten">
                            <i className="ti ti-pencil"></i>
                          </button>
                          <button type="button" className="table-action-btn table-action-delete" onClick={() => handleDelete(manager.id)} title="Immobilienverwalter löschen">
                            <i className="ti ti-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredManagers.length === 0 ? (
                    <tr><td colSpan="6" className="text-center text-muted py-4">Keine Immobilienverwalter gefunden.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>

      {editingManager ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1" aria-hidden="false">
            <div className="modal-dialog modal-dialog-scrollable modal-lg">
              <div className="modal-content rounded-1">
                <div className="modal-header border-bottom">
                  <h5 className="modal-title">Immobilienverwalter bearbeiten</h5>
                  <button type="button" className="btn-close" onClick={closeModal}></button>
                </div>
                <form onSubmit={handleSubmit}>
                  <div className="modal-body">
                    <div className="mb-3">
                      <label className="form-label">Name</label>
                      <input
                        className="form-control"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Immobilienverwalter"
                      />
                    </div>
                    {error ? <div className="alert alert-danger py-2 mb-0">{error}</div> : null}
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-light-danger text-danger" onClick={closeModal}>Abbrechen</button>
                    <button type="submit" className="btn btn-primary" disabled={isSaving}>
                      {isSaving ? 'Wird gespeichert...' : 'Verwalter aktualisieren'}
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

export default PropertyManagersPage
