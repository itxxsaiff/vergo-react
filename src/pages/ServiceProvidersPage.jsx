import { useEffect, useState } from 'react'
import PageContent from '../components/PageContent'
import { confirmDelete, showDeleteSuccess } from '../lib/alerts'
import { api } from '../lib/api'
import { formatStatusLabel, getStatusBadgeClass } from '../lib/tableStatus'
import { JOB_TYPE_OPTIONS, getOptionLabel } from '../lib/vergoOptions'

const initialForm = {
  company_name: '',
  contact_name: '',
  contact_email: '',
  order_email: '',
  address: '',
  postal_code: '',
  city: '',
  canton: '',
  domain_suffix: '',
  trade_groups: [],
  phone: '',
  status: 'active',
}

const SWISS_CANTONS = [
  { value: 'AG', label: 'AG - Aargau' },
  { value: 'AI', label: 'AI - Appenzell Innerrhoden' },
  { value: 'AR', label: 'AR - Appenzell Ausserrhoden' },
  { value: 'BE', label: 'BE - Bern' },
  { value: 'BL', label: 'BL - Basel-Landschaft' },
  { value: 'BS', label: 'BS - Basel-Stadt' },
  { value: 'FR', label: 'FR - Fribourg' },
  { value: 'GE', label: 'GE - Geneve' },
  { value: 'GL', label: 'GL - Glarus' },
  { value: 'GR', label: 'GR - Graubunden' },
  { value: 'JU', label: 'JU - Jura' },
  { value: 'LU', label: 'LU - Luzern' },
  { value: 'NE', label: 'NE - Neuchatel' },
  { value: 'NW', label: 'NW - Nidwalden' },
  { value: 'OW', label: 'OW - Obwalden' },
  { value: 'SG', label: 'SG - St. Gallen' },
  { value: 'SH', label: 'SH - Schaffhausen' },
  { value: 'SO', label: 'SO - Solothurn' },
  { value: 'SZ', label: 'SZ - Schwyz' },
  { value: 'TG', label: 'TG - Thurgau' },
  { value: 'TI', label: 'TI - Ticino' },
  { value: 'UR', label: 'UR - Uri' },
  { value: 'VD', label: 'VD - Vaud' },
  { value: 'VS', label: 'VS - Valais' },
  { value: 'ZG', label: 'ZG - Zug' },
  { value: 'ZH', label: 'ZH - Zurich' },
]

function ServiceProvidersPage() {
  const [providers, setProviders] = useState([])
  const [companyRequests, setCompanyRequests] = useState([])
  const [form, setForm] = useState(initialForm)
  const [filters, setFilters] = useState({ search: '', status: '' })
  const [editingId, setEditingId] = useState(null)
  const [sourceRequestId, setSourceRequestId] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

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
      const [providersResponse, requestsResponse] = await Promise.all([
        api.getServiceProviders(),
        api.getCompanyAdditionRequests(),
      ])
      setProviders(providersResponse.data ?? [])
      setCompanyRequests(requestsResponse.data ?? [])
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setIsLoading(false)
    }
  }

  function handleChange(event) {
    const { name, value, selectedOptions } = event.target
    setForm((current) => ({
      ...current,
      [name]: name === 'trade_groups'
        ? Array.from(selectedOptions, (option) => option.value)
        : value,
    }))
    setFieldErrors((current) => {
      if (!current[name]) return current
      const next = { ...current }
      delete next[name]
      return next
    })
  }

  function handleFilterChange(event) {
    const { name, value } = event.target
    setFilters((current) => ({ ...current, [name]: value }))
  }

  function openCreateModal() {
    setEditingId(null)
    setSourceRequestId(null)
    setForm(initialForm)
    setError('')
    setFieldErrors({})
    setIsModalOpen(true)
  }

  function openCreateFromRequest(companyRequest) {
    setEditingId(null)
    setSourceRequestId(companyRequest.id)
    setForm({
      ...initialForm,
      company_name: companyRequest.company_name || '',
      contact_name: companyRequest.contact_name || '',
      contact_email: companyRequest.email || '',
      order_email: companyRequest.email || '',
      phone: companyRequest.phone || '',
      city: companyRequest.city || '',
      canton: companyRequest.canton || '',
    })
    setError('')
    setFieldErrors({})
    setIsModalOpen(true)
  }

  function handleEdit(provider) {
    setEditingId(provider.id)
    setForm({
      company_name: provider.company_name || '',
      contact_name: provider.contact_name || '',
      contact_email: provider.contact_email || '',
      order_email: provider.order_email || '',
      address: provider.address || '',
      postal_code: provider.postal_code || '',
      city: provider.city || '',
      canton: provider.canton || '',
      domain_suffix: provider.domain_suffix || '',
      trade_groups: provider.trade_groups || [],
      phone: provider.phone || '',
      status: provider.status || 'active',
    })
    setError('')
    setFieldErrors({})
    setIsModalOpen(true)
  }

  function closeModal() {
    setEditingId(null)
    setSourceRequestId(null)
    setForm(initialForm)
    setError('')
    setFieldErrors({})
    setIsModalOpen(false)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setIsSaving(true)
    setError('')
    setFieldErrors({})

    const requiredFields = ['company_name', 'contact_email', 'order_email', 'address', 'postal_code', 'city', 'canton', 'phone', 'domain_suffix']
    const nextFieldErrors = requiredFields.reduce((errors, field) => {
      if (!String(form[field] ?? '').trim()) {
        errors[field] = true
      }
      return errors
    }, {})

    if ((form.trade_groups ?? []).length === 0) {
      nextFieldErrors.trade_groups = true
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors)
      setError('Bitte alle Pflichtfelder ausfüllen.')
      setIsSaving(false)
      return
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailPattern.test(form.contact_email.trim())) {
      setFieldErrors({ contact_email: true })
      setError('Bitte geben Sie eine gültige Kontakt-E-Mail-Adresse ein.')
      setIsSaving(false)
      return
    }

    if (!emailPattern.test(form.order_email.trim())) {
      setFieldErrors({ order_email: true })
      setError('Bitte geben Sie eine gültige E-Mail-Adresse für Aufträge ein.')
      setIsSaving(false)
      return
    }

    try {
      const payload = {
        ...form,
        contact_name: form.contact_name || null,
        contact_email: form.contact_email.trim().toLowerCase(),
        order_email: form.order_email.trim().toLowerCase(),
        address: form.address.trim(),
        postal_code: form.postal_code.trim(),
        city: form.city.trim(),
        canton: form.canton.trim(),
        domain_suffix: form.domain_suffix.trim().replace(/^@+/, '').toLowerCase(),
        trade_groups: form.trade_groups,
        phone: form.phone.trim(),
      }

      if (editingId) {
        const response = await api.updateServiceProvider(editingId, payload)
        setProviders((current) => current.map((provider) => (provider.id === editingId ? response.data : provider)))
      } else {
        const response = await api.createServiceProvider(payload)
        setProviders((current) => [response.data, ...current])

        if (sourceRequestId) {
          await api.updateCompanyAdditionRequest(sourceRequestId, { status: 'completed' })
          setCompanyRequests((current) => current.map((request) => (
            request.id === sourceRequestId ? { ...request, status: 'completed' } : request
          )))
        }
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
      provider.customer_number,
      provider.company_name,
      provider.contact_name,
      provider.contact_email,
      provider.order_email,
      provider.address,
      provider.postal_code,
      provider.city,
      provider.canton,
      provider.domain_suffix,
      ...(provider.trade_groups || []),
      provider.phone,
    ].filter(Boolean).join(' ').toLowerCase()

    const searchMatch = !filters.search || searchValue.includes(filters.search.toLowerCase())
    const statusMatch = !filters.status || String(provider.status || '').toLowerCase() === filters.status.toLowerCase()

    return searchMatch && statusMatch
  })

  const pendingCompanyRequests = companyRequests.filter((request) => request.status === 'pending')

  return (
    <PageContent
      title="Dienstleister"
      subtitle="Verwalten Sie Anbieterunternehmen, die für Ausschreibungen und die Teilnahme an Aufträgen verfügbar sind."
      breadcrumbs={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Dienstleister' },
      ]}
    >
      <div className="card">
  <div className="card-body p-4">
    {pendingCompanyRequests.length > 0 ? (
      <div className="mb-4">
        <div className="d-flex align-items-center justify-content-between gap-3 mb-3">
          <div>
            <h5 className="fw-semibold mb-1">Firmenanfragen</h5>
            <p className="text-muted mb-0">Anfragen von Immobilienverwaltern, damit Vergo die Firma zentral anlegt.</p>
          </div>
          <span className="badge bg-light-primary text-primary rounded-pill px-3 py-2">
            {pendingCompanyRequests.length} offen
          </span>
        </div>

        <div className="table-responsive rounded-2 mb-0 vergo-table-scroll">
          <table className="table border-none text-nowrap customize-table mb-0 align-middle">
            <thead className="text-dark fs-4">
              <tr>
                <th><h6 className="fs-4 fw-semibold mb-0">Firma</h6></th>
                <th><h6 className="fs-4 fw-semibold mb-0">Kontakt</h6></th>
                <th><h6 className="fs-4 fw-semibold mb-0">Ort</h6></th>
                <th><h6 className="fs-4 fw-semibold mb-0">Angefragt von</h6></th>
                <th><h6 className="fs-4 fw-semibold mb-0">Status</h6></th>
                <th width="160"><h6 className="fs-4 fw-semibold mb-0">Aktion</h6></th>
              </tr>
            </thead>
            <tbody>
              {pendingCompanyRequests.map((companyRequest) => (
                <tr key={companyRequest.id}>
                  <td>
                    <div className="fw-semibold">{companyRequest.company_name}</div>
                    {companyRequest.notes ? <div className="text-muted small">{companyRequest.notes}</div> : null}
                  </td>
                  <td>
                    <div>{companyRequest.contact_name || '-'}</div>
                    <div className="text-muted small">{companyRequest.email || '-'}</div>
                    <div className="text-muted small">{companyRequest.phone || '-'}</div>
                  </td>
                  <td>{[companyRequest.city, companyRequest.canton].filter(Boolean).join(' ') || '-'}</td>
                  <td>
                    <div>{companyRequest.property_manager?.name || '-'}</div>
                    <div className="text-muted small">{companyRequest.property?.li_number || '-'}</div>
                  </td>
                  <td><span className={getStatusBadgeClass(companyRequest.status)}>{formatStatusLabel(companyRequest.status)}</span></td>
                  <td>
                    <div className="table-action-group">
                      <button type="button" className="table-action-btn table-action-edit" onClick={() => openCreateFromRequest(companyRequest)} title="Dienstleister aus Anfrage erstellen">
                        <i className="ti ti-plus"></i>
                      </button>
                      <button
                        type="button"
                        className="table-action-btn table-action-delete"
                        onClick={async () => {
                          await api.updateCompanyAdditionRequest(companyRequest.id, { status: 'dismissed' })
                          setCompanyRequests((current) => current.map((request) => (
                            request.id === companyRequest.id ? { ...request, status: 'dismissed' } : request
                          )))
                        }}
                        title="Anfrage ausblenden"
                      >
                        <i className="ti ti-x"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ) : null}

    <div className="row g-3 mb-4 vergo-filter-bar vergo-filter-bar-compact">
      <div className="col-xl-5 col-lg-6 col-md-12">
        <label className="form-label">Suche</label>
        <div className="vergo-search-input-wrap">
          <i className="ti ti-search vergo-search-input-icon" aria-hidden="true"></i>
          <input
            aria-label="Suche"
            className="form-control"
            name="search"
            value={filters.search}
            onChange={handleFilterChange}
            placeholder="Nach Unternehmen, Kontakt, E-Mail oder Telefon suchen"
          />
        </div>
      </div>
      <div className="col-xl-3 col-lg-6 col-md-6">
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
      <div className="col-xl-4 col-lg-12 col-md-6">
        <div className="d-flex align-items-end justify-content-xl-end gap-2 flex-nowrap vergo-action-buttons">
          <button type="button" className="btn btn-light-primary vergo-filter-reset-btn text-nowrap" onClick={() => setFilters({ search: '', status: '' })}>
            <i className="ti ti-refresh me-1" aria-hidden="true"></i>
            Zurücksetzen
          </button>
          <button type="button" className="btn btn-primary text-nowrap" onClick={openCreateModal}>
            <i className="ti ti-plus me-1"></i>
            Dienstleister erstellen
          </button>
        </div>
      </div>
    </div>

    {error && !isModalOpen ? <div className="alert alert-danger py-2">{error}</div> : null}
    {isLoading ? <p className="text-muted mb-0">Dienstleister werden geladen...</p> : null}

    {!isLoading ? (
      <div className="table-responsive rounded-2 mb-0 vergo-table-scroll">
        <table className="table border-none text-nowrap customize-table mb-0 align-middle">
          <thead className="text-dark fs-4">
            <tr>
              <th><h6 className="fs-4 fw-semibold mb-0">Code</h6></th>
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
                <td className="fw-semibold">{provider.customer_number || '-'}</td>
                <td className="fw-semibold">{provider.company_name}</td>
                <td>
                  <div className="text-muted">{provider.contact_email}</div>
                  <div className="text-muted small">{[provider.postal_code, provider.city, provider.canton].filter(Boolean).join(' ') || '-'}</div>
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
              <tr><td colSpan="9" className="text-center text-muted py-4">Keine Dienstleister gefunden.</td></tr>
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
        <h5 className="modal-title">{editingId ? 'Dienstleister bearbeiten' : 'Dienstleister erstellen'}</h5>
        <button type="button" className="btn-close" onClick={closeModal}></button>
      </div>
      <form onSubmit={handleSubmit} noValidate>
        <div className="modal-body">
          <div className="row">
            <div className="col-md-6 mb-3">
              <label className="form-label">Firmenname</label>
              <input className={`form-control${fieldErrors.company_name ? ' is-invalid' : ''}`} name="company_name" value={form.company_name} onChange={handleChange} />
            </div>
            <div className="col-md-6 mb-3">
              <label className="form-label">E-Mail für Aufträge</label>
              <input type="email" className={`form-control${fieldErrors.order_email ? ' is-invalid' : ''}`} name="order_email" value={form.order_email} onChange={handleChange} />
            </div>
            <div className="col-md-6 mb-3">
              <label className="form-label">Kontakt-E-Mail</label>
              <input type="email" className={`form-control${fieldErrors.contact_email ? ' is-invalid' : ''}`} name="contact_email" value={form.contact_email} onChange={handleChange} />
            </div>
            <div className="col-md-6 mb-3">
              <label className="form-label">Telefon</label>
              <input className={`form-control${fieldErrors.phone ? ' is-invalid' : ''}`} name="phone" value={form.phone} onChange={handleChange} />
            </div>
            <div className="col-12 mb-3">
              <label className="form-label">Adresse</label>
              <input className={`form-control${fieldErrors.address ? ' is-invalid' : ''}`} name="address" value={form.address} onChange={handleChange} />
            </div>
            <div className="col-md-4 mb-3">
              <label className="form-label">PLZ</label>
              <input className={`form-control${fieldErrors.postal_code ? ' is-invalid' : ''}`} name="postal_code" value={form.postal_code} onChange={handleChange} />
            </div>
            <div className="col-md-5 mb-3">
              <label className="form-label">Ort</label>
              <input className={`form-control${fieldErrors.city ? ' is-invalid' : ''}`} name="city" value={form.city} onChange={handleChange} />
            </div>
            <div className="col-md-3 mb-3">
              <label className="form-label">Kanton</label>
              <select className={`form-select${fieldErrors.canton ? ' is-invalid' : ''}`} name="canton" value={form.canton} onChange={handleChange}>
                <option value="">Kanton wählen</option>
                {SWISS_CANTONS.map((canton) => (
                  <option key={canton.value} value={canton.value}>{canton.label}</option>
                ))}
              </select>
            </div>
            <div className="col-12 mb-3">
              <label className="form-label">Gewerk</label>
              <select className={`form-select${fieldErrors.trade_groups ? ' is-invalid' : ''}`} name="trade_groups" value={form.trade_groups} onChange={handleChange} multiple size="5">
                {JOB_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <small className="text-muted">Mehrfachauswahl möglich.</small>
              {form.trade_groups.length > 0 ? (
                <div className="small text-muted mt-1">
                  {form.trade_groups.map((value) => getOptionLabel(JOB_TYPE_OPTIONS, value)).join(', ')}
                </div>
              ) : null}
            </div>
            <div className="col-md-6 mb-3">
              <label className="form-label">Status</label>
              <select className="form-select" name="status" value={form.status} onChange={handleChange}>
                <option value="active">Aktiv</option>
                <option value="inactive">Inaktiv</option>
              </select>
            </div>
            <div className="col-md-6 mb-0">
              <label className="form-label">Domain-Endung</label>
              <input className={`form-control${fieldErrors.domain_suffix ? ' is-invalid' : ''}`} name="domain_suffix" value={form.domain_suffix} onChange={handleChange} placeholder="beispiel.ch" />
            </div>
            <div className="col-12">
              <div className="alert alert-light border small mb-0">
                Kontakt-E-Mail und Telefonnummer dienen nur als Kontaktangaben. Aufträge werden an die E-Mail für Aufträge gesendet. Ein Passwort wird nicht gesetzt.
              </div>
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
