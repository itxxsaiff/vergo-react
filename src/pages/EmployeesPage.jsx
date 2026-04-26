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
  status: 'active',
}

function EmployeesPage() {
  const [employees, setEmployees] = useState([])
  const [form, setForm] = useState(initialForm)
  const [filters, setFilters] = useState({
    search: '',
    status: '',
  })
  const [editingEmployeeId, setEditingEmployeeId] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [error, setError] = useState('')

  async function loadEmployees() {
    setIsLoading(true)
    setError('')

    try {
      const response = await api.getEmployees()
      setEmployees(response.data ?? [])
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadEmployees()
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

  function openCreateModal() {
    setEditingEmployeeId(null)
    setForm(initialForm)
    setError('')
    setIsModalOpen(true)
  }

  function closeModal() {
    setEditingEmployeeId(null)
    setForm(initialForm)
    setError('')
    setIsModalOpen(false)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setIsSaving(true)
    setError('')

    if (!form.name.trim()) {
      setError('Name des Mitarbeiters ist erforderlich.')
      setIsSaving(false)
      return
    }

    if (!form.email.trim()) {
      setError('E-Mail des Mitarbeiters ist erforderlich.')
      setIsSaving(false)
      return
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!emailPattern.test(form.email.trim())) {
      setError('Bitte geben Sie eine gültige Mitarbeiter-E-Mail-Adresse ein.')
      setIsSaving(false)
      return
    }

    if (!editingEmployeeId && !form.password.trim()) {
      setError('Für einen neuen Mitarbeiter ist ein Passwort erforderlich.')
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
        phone: form.phone || null,
        password: form.password || undefined,
      }

      if (editingEmployeeId) {
        const response = await api.updateEmployee(editingEmployeeId, payload)
        setEmployees((current) => current.map((employee) => (
          employee.id === editingEmployeeId ? response.data : employee
        )))
      } else {
        const response = await api.createEmployee(payload)
        setEmployees((current) => [response.data, ...current])
      }

      closeModal()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setIsSaving(false)
    }
  }

  function handleEdit(employee) {
    setEditingEmployeeId(employee.id)
    setForm({
      name: employee.name || '',
      email: employee.email || '',
      password: '',
      phone: employee.phone || '',
      status: employee.status || 'active',
    })
    setError('')
    setIsModalOpen(true)
  }

  async function handleDelete(employeeId) {
    const shouldDelete = await confirmDelete('employee')

    if (!shouldDelete) {
      return
    }

    try {
      await api.deleteEmployee(employeeId)
      setEmployees((current) => current.filter((employee) => employee.id !== employeeId))
      showDeleteSuccess('employee')

      if (editingEmployeeId === employeeId) {
        closeModal()
      }
    } catch (deleteError) {
      setError(deleteError.message)
    }
  }

  const filteredEmployees = employees.filter((employee) => {
    const searchValue = [
      employee.name,
      employee.email,
      employee.phone,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    const searchMatch = !filters.search || searchValue.includes(filters.search.toLowerCase())
    const statusMatch = !filters.status || String(employee.status || '').toLowerCase() === filters.status.toLowerCase()

    return searchMatch && statusMatch
  })

  return (
    <PageContent
      title="Mitarbeiter"
      subtitle="Verwalten Sie interne Mitarbeiterkonten, die als Benutzer mit der Rolle employee gespeichert werden."
      breadcrumbs={[
        { label: 'Armaturenbrett', href: '/dashboard' },
        { label: 'Mitarbeiter' },
      ]}
      actions={(
        <button type="button" className="btn btn-primary" onClick={openCreateModal}>
          <i className="ti ti-plus me-1"></i>
          Mitarbeiter erstellen
        </button>
      )}
    >
      <div className="card">
        <div className="card-body p-4">
          <div className="row g-3 mb-4 vergo-filter-bar">
            <div className="col-md-7">
              <label className="form-label">Suche</label>
              <div className="vergo-search-input-wrap">
                <i className="ti ti-search vergo-search-input-icon" aria-hidden="true"></i>
                <input
                  aria-label="Suche"
                  className="form-control"
                  name="search"
                  value={filters.search}
                  onChange={handleFilterChange}
                  placeholder="Suche nach Name, E-Mail oder Telefon"
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
            <div className="col-md-2 d-flex align-items-end justify-content-end vergo-filter-reset-wrap">
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

          {error && !isModalOpen ? <div className="alert alert-danger py-2">{error}</div> : null}
          {isLoading ? <p className="text-muted mb-0">Mitarbeiter werden geladen...</p> : null}

          {!isLoading ? (
            <div className="table-responsive rounded-2 mb-0 vergo-table-scroll">
              <table className="table border-none text-nowrap customize-table mb-0 align-middle">
                <thead className="text-dark fs-4">
                  <tr>
                    <th><h6 className="fs-4 fw-semibold mb-0">Name</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">E-Mail</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">Telefon</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">Status</h6></th>
                    <th width="90"><h6 className="fs-4 fw-semibold mb-0">Aktion</h6></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((employee) => (
                    <tr key={employee.id}>
                      <td>{employee.name}</td>
                      <td>{employee.email}</td>
                      <td>{employee.phone || '-'}</td>
                      <td>
                        <span className={getStatusBadgeClass(employee.status)}>
                          {formatStatusLabel(employee.status)}
                        </span>
                      </td>
                      <td>
                        <div className="table-action-group">
                          <button
                            type="button"
                            className="table-action-btn table-action-edit"
                            onClick={() => handleEdit(employee)}
                            title="Mitarbeiter bearbeiten"
                          >
                            <i className="ti ti-pencil"></i>
                          </button>
                          <button
                            type="button"
                            className="table-action-btn table-action-delete"
                            onClick={() => handleDelete(employee.id)}
                            title="Mitarbeiter löschen"
                          >
                            <i className="ti ti-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="text-center text-muted py-4">
                        Keine Mitarbeiter gefunden.
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
                  <h5 className="modal-title">
                    {editingEmployeeId ? 'Mitarbeiter bearbeiten' : 'Mitarbeiter erstellen'}
                  </h5>
                  <button type="button" className="btn-close" onClick={closeModal}></button>
                </div>
                <form onSubmit={handleSubmit}>
                  <div className="modal-body">
                    <div className="row">
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Name</label>
                        <input className="form-control" name="name" value={form.name} onChange={handleChange} />
                      </div>

                      <div className="col-md-6 mb-3">
                        <label className="form-label">E-Mail</label>
                        <input type="email" className="form-control" name="email" value={form.email} onChange={handleChange} />
                      </div>

                      <div className="col-md-6 mb-3">
                        <label className="form-label">Telefon</label>
                        <input className="form-control" name="phone" value={form.phone} onChange={handleChange} />
                      </div>

                      <div className="col-md-6 mb-3">
                        <label className="form-label">Status</label>
                        <select className="form-select" name="status" value={form.status} onChange={handleChange}>
                          <option value="active">Aktiv</option>
                          <option value="inactive">Inaktiv</option>
                        </select>
                      </div>

                      <div className="col-md-6 mb-0">
                        <label className="form-label">{editingEmployeeId ? 'Passwort (optional)' : 'Passwort'}</label>
                        <input type="password" className="form-control" name="password" value={form.password} onChange={handleChange} />
                      </div>
                    </div>

                    {error ? <div className="alert alert-danger py-2 mt-3 mb-0">{error}</div> : null}
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-light-danger text-danger" onClick={closeModal}>
                      Abbrechen
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={isSaving}>
                      {isSaving ? 'Wird gespeichert...' : editingEmployeeId ? 'Mitarbeiter aktualisieren' : 'Mitarbeiter erstellen'}
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

export default EmployeesPage
