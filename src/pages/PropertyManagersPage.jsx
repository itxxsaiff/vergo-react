import { useEffect, useState } from 'react'
import PageContent from '../components/PageContent'
import { useLanguage } from '../context/LanguageContext'
import { confirmDelete, showDeleteSuccess } from '../lib/alerts'
import { api } from '../lib/api'
import { formatStatusLabel, getStatusBadgeClass } from '../lib/tableStatus'
import { buildManagerCompanies } from '../lib/managerCompanies'

const initialForm = {
  property_id: '',
  name: '',
  email: '',
  phone: '',
  address: '',
  postal_code: '',
  city: '',
  canton: '',
  invoice_delivery_method: 'email',
  invoice_email: '',
  invoice_company_name: '',
  invoice_company_extra: '',
  invoice_address: '',
  invoice_postal_code: '',
  invoice_city: '',
  domain_suffix: '',
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

function PropertyManagersPage() {
  const { t } = useLanguage()
  const [managers, setManagers] = useState([])
  const [filters, setFilters] = useState({ search: '', status: '' })
  const [editingManager, setEditingManager] = useState(null)
  const [form, setForm] = useState(initialForm)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [detailKey, setDetailKey] = useState(null)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (isModalOpen || detailKey) {
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
  }, [isModalOpen, detailKey])

  async function loadData() {
    setIsLoading(true)
    setError('')

    try {
      const managersResponse = await api.getPropertyManagers()
      setManagers(managersResponse.data ?? [])
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

  function handleChange(event) {
    const { name, value } = event.target
    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === 'invoice_delivery_method' && value === 'email'
        ? {
          invoice_company_name: '',
          invoice_company_extra: '',
          invoice_address: '',
          invoice_postal_code: '',
          invoice_city: '',
        }
        : {}),
      ...(name === 'invoice_delivery_method' && value === 'mail'
        ? {
          invoice_email: '',
        }
        : {}),
    }))
    setFieldErrors((current) => {
      if (!current[name]) return current
      const next = { ...current }
      delete next[name]
      return next
    })
  }

  function openCreateModal() {
    setEditingManager(null)
    setForm(initialForm)
    setError('')
    setFieldErrors({})
    setDetailKey(null)
    setIsModalOpen(true)
  }

  function handleEdit(manager) {
    setDetailKey(null)
    setEditingManager(manager)
    setForm({
      property_id: String(manager.property?.id ?? manager.property_id ?? ''),
      name: manager.name || '',
      email: manager.email || '',
      phone: manager.phone || '',
      address: manager.address || '',
      postal_code: manager.postal_code || '',
      city: manager.city || '',
      canton: manager.canton || '',
      invoice_delivery_method: manager.invoice_delivery_method || 'email',
      invoice_email: manager.invoice_email || '',
      invoice_company_name: manager.invoice_company_name || '',
      invoice_company_extra: manager.invoice_company_extra || '',
      invoice_address: manager.invoice_address || '',
      invoice_postal_code: manager.invoice_postal_code || '',
      invoice_city: manager.invoice_city || '',
      domain_suffix: manager.domain_suffix || '',
    })
    setError('')
    setFieldErrors({})
    setIsModalOpen(true)
  }

  function closeModal() {
    setEditingManager(null)
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

    const requiredFields = ['name', 'email', 'phone', 'address', 'postal_code', 'city', 'canton', 'domain_suffix', 'invoice_delivery_method']
    const nextFieldErrors = requiredFields.reduce((errors, field) => {
      if (!String(form[field] ?? '').trim()) {
        errors[field] = true
      }
      return errors
    }, {})

    if (form.invoice_delivery_method === 'email') {
      if (!String(form.invoice_email ?? '').trim()) {
        nextFieldErrors.invoice_email = true
      }
    }

    if (form.invoice_delivery_method === 'mail') {
      ;['invoice_address', 'invoice_postal_code', 'invoice_city'].forEach((field) => {
        if (!String(form[field] ?? '').trim()) {
          nextFieldErrors[field] = true
        }
      })
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors)
      setError(t('Bitte alle Pflichtfelder ausfüllen.'))
      setIsSaving(false)
      return
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailPattern.test(form.email.trim())) {
      setFieldErrors({ email: true })
      setError(t('Bitte geben Sie eine gültige E-Mail-Adresse ein.'))
      setIsSaving(false)
      return
    }

    if (form.invoice_delivery_method === 'email' && !emailPattern.test(form.invoice_email.trim())) {
      setFieldErrors({ invoice_email: true })
      setError(t('Bitte geben Sie eine gültige Rechnungs-E-Mail-Adresse ein.'))
      setIsSaving(false)
      return
    }

    try {
      if (editingManager) {
        const response = await api.updatePropertyManager(editingManager.id, {
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          postal_code: form.postal_code.trim(),
          city: form.city.trim(),
          canton: form.canton.trim(),
          invoice_delivery_method: form.invoice_delivery_method.trim(),
          invoice_email: form.invoice_delivery_method === 'email' ? form.invoice_email.trim().toLowerCase() : null,
          invoice_company_name: form.invoice_delivery_method === 'mail' ? form.invoice_company_name.trim() || null : null,
          invoice_company_extra: form.invoice_delivery_method === 'mail' ? form.invoice_company_extra.trim() || null : null,
          invoice_address: form.invoice_delivery_method === 'mail' ? form.invoice_address.trim() : null,
          invoice_postal_code: form.invoice_delivery_method === 'mail' ? form.invoice_postal_code.trim() : null,
          invoice_city: form.invoice_delivery_method === 'mail' ? form.invoice_city.trim() : null,
          domain_suffix: form.domain_suffix.trim().replace(/^@+/, '').toLowerCase(),
        })
        setManagers((current) => current.map((manager) => (manager.id === editingManager.id ? response.data : manager)))
      } else {
        const response = await api.createPropertyManager({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          postal_code: form.postal_code.trim(),
          city: form.city.trim(),
          canton: form.canton.trim(),
          invoice_delivery_method: form.invoice_delivery_method.trim(),
          invoice_email: form.invoice_delivery_method === 'email' ? form.invoice_email.trim().toLowerCase() : null,
          invoice_company_name: form.invoice_delivery_method === 'mail' ? form.invoice_company_name.trim() || null : null,
          invoice_company_extra: form.invoice_delivery_method === 'mail' ? form.invoice_company_extra.trim() || null : null,
          invoice_address: form.invoice_delivery_method === 'mail' ? form.invoice_address.trim() : null,
          invoice_postal_code: form.invoice_delivery_method === 'mail' ? form.invoice_postal_code.trim() : null,
          invoice_city: form.invoice_delivery_method === 'mail' ? form.invoice_city.trim() : null,
          domain_suffix: form.domain_suffix.trim().replace(/^@+/, '').toLowerCase(),
        })
        setManagers((current) => [response.data, ...current])
      }

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

  const companies = buildManagerCompanies(managers)
  const detailCompany = detailKey ? companies.find((company) => company.key === detailKey) ?? null : null

  const filteredCompanies = companies.filter((company) => {
    const searchValue = [
      company.name,
      company.domain,
      company.canton,
      ...company.employees.flatMap((manager) => [
        manager.name,
        manager.email,
        manager.phone,
        manager.address,
        manager.postal_code,
        manager.city,
        manager.canton,
        manager.property?.li_number,
        manager.property?.title,
      ]),
    ].filter(Boolean).join(' ').toLowerCase()
    const searchMatch = !filters.search || searchValue.includes(filters.search.toLowerCase())
    const statusMatch = !filters.status || 'active' === filters.status.toLowerCase()
    return searchMatch && statusMatch
  })

  return (
    <PageContent
      title={t('Immobilienverwalter')}
      subtitle={t('Verwalten Sie OTP-basierte Immobilienverwalter, die mit Li-Nummern verknüpft sind, sowie deren Auftragshistorie.')}
      breadcrumbs={[
        { label: t('Dashboard'), href: '/dashboard' },
        { label: t('Immobilienverwalter') },
      ]}
    >
      <div className="card">
        <div className="px-4 py-3 border-bottom">
          <h5 className="card-title fw-semibold mb-0 lh-sm">{t('Liste der Immobilienverwalter')}</h5>
        </div>
        <div className="card-body p-4">
          <div className="row g-3 mb-4 vergo-filter-bar vergo-filter-bar-compact">
            <div className="col-xl-5 col-lg-6 col-md-12">
              <label className="form-label">{t('Suche')}</label>
              <div className="vergo-search-input-wrap">
                <i className="ti ti-search vergo-search-input-icon" aria-hidden="true"></i>
                <input
                  aria-label={t('Suche')}
                  className="form-control"
                  name="search"
                  value={filters.search}
                  onChange={handleFilterChange}
                  placeholder={t('Nach Name, E-Mail, Li-Nummer oder Immobilie suchen')}
                />
              </div>
            </div>
            <div className="col-xl-3 col-lg-6 col-md-6">
              <label className="form-label">{t('Status')}</label>
              <div className="vergo-select-input-wrap">
                <i className="ti ti-adjustments vergo-select-input-icon" aria-hidden="true"></i>
                <select aria-label={t('Status')} className="form-select" name="status" value={filters.status} onChange={handleFilterChange}>
                  <option value="">{t('All Status')}</option>
                  <option value="active">{t('Aktiv')}</option>
                </select>
              </div>
            </div>
            <div className="col-xl-4 col-lg-12 col-md-6">
              <div className="d-flex align-items-end justify-content-xl-end gap-2 flex-nowrap vergo-action-buttons">
                <button type="button" className="btn btn-light-primary vergo-filter-reset-btn text-nowrap" onClick={() => setFilters({ search: '', status: '' })}>
                  <i className="ti ti-refresh me-1" aria-hidden="true"></i>
                  {t('Zurücksetzen')}
                </button>
                <button type="button" className="btn btn-primary text-nowrap" onClick={openCreateModal}>
                  <i className="ti ti-plus me-1"></i>
                  {t('Immobilienverwalter erstellen')}
                </button>
              </div>
            </div>
          </div>

          {error && !isModalOpen ? <div className="alert alert-danger py-2">{t(error)}</div> : null}
          {isLoading ? <p className="text-muted mb-0">{t('Immobilienverwalter werden geladen...')}</p> : null}

          {!isLoading ? (
            <div className="table-responsive rounded-2 mb-0 vergo-table-scroll">
              <table className="table border-none text-nowrap customize-table mb-0 align-middle">
                <thead className="text-dark fs-4">
                  <tr>
                    <th><h6 className="fs-4 fw-semibold mb-0">{t('Verwaltung')}</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">{t('Kanton')}</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">{t('Liegenschaften')}</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">{t('Aufträge')}</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">{t('Mitarbeiter')}</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">{t('Status')}</h6></th>
                    <th width="150"><h6 className="fs-4 fw-semibold mb-0">{t('Aktion')}</h6></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCompanies.map((company) => (
                    <tr key={company.key}>
                      <td>
                        <div>{company.name}</div>
                        <div className="text-muted">{company.domain ? `@${company.domain}` : '-'}</div>
                        <div className="text-muted small">
                          {[company.representative.postal_code, company.representative.city].filter(Boolean).join(' ') || '-'}
                        </div>
                      </td>
                      <td>{company.canton || '-'}</td>
                      <td>
                        <div className="fw-semibold">{company.totalProperties}</div>
                        <div className="text-muted small">{t('zugewiesene Liegenschaften')}</div>
                      </td>
                      <td>
                        <div className="fw-semibold">{company.totalOrders}</div>
                        <div className="text-muted small">{company.activeOrders} {t('aktiv')}</div>
                      </td>
                      <td>
                        <button type="button" className="btn btn-sm btn-light-primary" onClick={() => setDetailKey(company.key)}>
                          {company.employees.length} {company.employees.length === 1 ? t('E-Mail') : t('E-Mails')}
                        </button>
                      </td>
                      <td><span className={getStatusBadgeClass('active')}>{t(formatStatusLabel('active'))}</span></td>
                      <td>
                        <div className="table-action-group">
                          <button type="button" className="table-action-btn" onClick={() => setDetailKey(company.key)} title={t('Details anzeigen')}>
                            <i className="ti ti-eye"></i>
                          </button>
                          <button type="button" className="table-action-btn table-action-edit" onClick={() => handleEdit(company.representative)} title={t('Verwaltung bearbeiten')}>
                            <i className="ti ti-pencil"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredCompanies.length === 0 ? (
                    <tr><td colSpan="7" className="text-center text-muted py-4">{t('Keine Immobilienverwaltungen gefunden.')}</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>

      {detailCompany ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1" aria-hidden="false">
            <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
              <div className="modal-content rounded-1">
                <div className="modal-header border-bottom">
                  <div>
                    <h5 className="modal-title mb-0">{detailCompany.name}</h5>
                    <div className="text-muted small">{detailCompany.domain ? `@${detailCompany.domain}` : ''}</div>
                  </div>
                  <button type="button" className="btn-close" aria-label={t('Schließen')} onClick={() => setDetailKey(null)}></button>
                </div>
                <div className="modal-body">
                  <div className="row g-3 mb-4">
                    <div className="col-sm-4">
                      <div className="border rounded-3 p-3 h-100">
                        <div className="text-muted small">{t('Kanton')}</div>
                        <div className="fw-semibold fs-4">{detailCompany.canton || '-'}</div>
                      </div>
                    </div>
                    <div className="col-sm-4">
                      <div className="border rounded-3 p-3 h-100">
                        <div className="text-muted small">{t('Liegenschaften')}</div>
                        <div className="fw-semibold fs-4">{detailCompany.totalProperties}</div>
                      </div>
                    </div>
                    <div className="col-sm-4">
                      <div className="border rounded-3 p-3 h-100">
                        <div className="text-muted small">{t('Aufträge gesamt')}</div>
                        <div className="fw-semibold fs-4">{detailCompany.totalOrders}</div>
                      </div>
                    </div>
                  </div>

                  <div className="fw-semibold mb-2">{t('Registrierte E-Mail-Adressen')}</div>
                  <div className="text-muted small mb-3">
                    {t('Mitarbeitende dieser Verwaltung melden sich über die Domain-Endung an. Diese Adressen erscheinen nicht in der Hauptliste.')}
                  </div>
                  <div className="table-responsive">
                    <table className="table align-middle mb-0">
                      <thead>
                        <tr>
                          <th>{t('E-Mail')}</th>
                          <th className="text-center">{t('Aufträge')}</th>
                          <th className="text-center">{t('Aktiv')}</th>
                          <th width="90"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailCompany.employees.map((employee) => (
                          <tr key={employee.id}>
                            <td>
                              <div>{employee.email}</div>
                              {employee.id === detailCompany.representative.id ? (
                                <span className="badge bg-light-primary text-primary">{t('Hauptverwaltung')}</span>
                              ) : (
                                <div className="text-muted small">{employee.name || '-'}</div>
                              )}
                            </td>
                            <td className="text-center fw-semibold">{employee.orders_count ?? 0}</td>
                            <td className="text-center">{employee.active_orders_count ?? 0}</td>
                            <td>
                              <div className="table-action-group">
                                <button type="button" className="table-action-btn table-action-edit" onClick={() => handleEdit(employee)} title={t('Bearbeiten')}>
                                  <i className="ti ti-pencil"></i>
                                </button>
                                <button type="button" className="table-action-btn table-action-delete" onClick={() => handleDelete(employee.id)} title={t('Löschen')}>
                                  <i className="ti ti-trash"></i>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-light-danger text-danger" onClick={() => setDetailKey(null)}>{t('Schließen')}</button>
                  <button type="button" className="btn btn-primary" onClick={() => handleEdit(detailCompany.representative)}>{t('Verwaltung bearbeiten')}</button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show"></div>
        </>
      ) : null}

      {isModalOpen ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1" aria-hidden="false">
            <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
              <div className="modal-content rounded-1">
                <div className="modal-header border-bottom">
                  <h5 className="modal-title">{editingManager ? t('Immobilienverwalter bearbeiten') : t('Immobilienverwalter erstellen')}</h5>
                  <button type="button" className="btn-close" aria-label={t('Schließen')} onClick={closeModal}></button>
                </div>
                <form onSubmit={handleSubmit} noValidate>
                  <div className="modal-body">
                    <div className="mb-3">
                      <label className="form-label">{t('Firmenname')}</label>
                      <input className={`form-control${fieldErrors.name ? ' is-invalid' : ''}`} name="name" value={form.name} onChange={handleChange} placeholder={t('Immobilienverwalter')} />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">{t('E-Mail')}</label>
                      <input type="email" className={`form-control${fieldErrors.email ? ' is-invalid' : ''}`} name="email" value={form.email} onChange={handleChange} />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">{t('Telefon')}</label>
                      <input className={`form-control${fieldErrors.phone ? ' is-invalid' : ''}`} name="phone" value={form.phone} onChange={handleChange} />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">{t('Adresse')}</label>
                      <input className={`form-control${fieldErrors.address ? ' is-invalid' : ''}`} name="address" value={form.address} onChange={handleChange} />
                    </div>
                    <div className="row">
                      <div className="col-md-4">
                        <div className="mb-3">
                          <label className="form-label">{t('PLZ')}</label>
                          <input className={`form-control${fieldErrors.postal_code ? ' is-invalid' : ''}`} name="postal_code" value={form.postal_code} onChange={handleChange} />
                        </div>
                      </div>
                      <div className="col-md-5">
                        <div className="mb-3">
                          <label className="form-label">{t('Ort')}</label>
                          <input className={`form-control${fieldErrors.city ? ' is-invalid' : ''}`} name="city" value={form.city} onChange={handleChange} />
                        </div>
                      </div>
                      <div className="col-md-3">
                        <div className="mb-3">
                          <label className="form-label">{t('Kanton')}</label>
                          <select className={`form-select${fieldErrors.canton ? ' is-invalid' : ''}`} name="canton" value={form.canton} onChange={handleChange}>
                            <option value="">{t('Kanton wählen')}</option>
                            {SWISS_CANTONS.map((canton) => (
                              <option key={canton.value} value={canton.value}>{canton.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                    <div className="border rounded-3 p-3 mb-3">
                      <div className="fw-semibold mb-3">{t('Rechnungsversand')}</div>
                      <div className="mb-3">
                        <label className="form-label">{t('Versandart')}</label>
                        <select className={`form-select${fieldErrors.invoice_delivery_method ? ' is-invalid' : ''}`} name="invoice_delivery_method" value={form.invoice_delivery_method} onChange={handleChange}>
                          <option value="email">{t('E-Mail')}</option>
                          <option value="mail">{t('Post')}</option>
                        </select>
                      </div>
                      {form.invoice_delivery_method === 'email' ? (
                        <div className="mb-0">
                          <label className="form-label">{t('E-Mail für Rechnungen')}</label>
                          <input
                            type="email"
                            className={`form-control${fieldErrors.invoice_email ? ' is-invalid' : ''}`}
                            name="invoice_email"
                            value={form.invoice_email}
                            onChange={handleChange}
                          />
                        </div>
                      ) : (
                        <div className="row">
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">{t('Firmenname')}</label>
                              <input className="form-control" name="invoice_company_name" value={form.invoice_company_name} onChange={handleChange} />
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">{t('Co.')}</label>
                              <input className="form-control" name="invoice_company_extra" value={form.invoice_company_extra} onChange={handleChange} />
                            </div>
                          </div>
                          <div className="col-12">
                            <div className="mb-3">
                              <label className="form-label">{t('Adresse')}</label>
                              <input className={`form-control${fieldErrors.invoice_address ? ' is-invalid' : ''}`} name="invoice_address" value={form.invoice_address} onChange={handleChange} />
                            </div>
                          </div>
                          <div className="col-md-4">
                            <div className="mb-0">
                              <label className="form-label">{t('PLZ')}</label>
                              <input className={`form-control${fieldErrors.invoice_postal_code ? ' is-invalid' : ''}`} name="invoice_postal_code" value={form.invoice_postal_code} onChange={handleChange} />
                            </div>
                          </div>
                          <div className="col-md-8">
                            <div className="mb-0">
                              <label className="form-label">{t('Ort')}</label>
                              <input className={`form-control${fieldErrors.invoice_city ? ' is-invalid' : ''}`} name="invoice_city" value={form.invoice_city} onChange={handleChange} />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="mb-3">
                      <label className="form-label">{t('Domain-Endung')}</label>
                      <input className={`form-control${fieldErrors.domain_suffix ? ' is-invalid' : ''}`} name="domain_suffix" value={form.domain_suffix} onChange={handleChange} placeholder={t('beispiel.ch')} />
                    </div>
                    {error ? <div className="alert alert-danger py-2 mb-0">{t(error)}</div> : null}
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-light-danger text-danger" onClick={closeModal}>{t('Abbrechen')}</button>
                    <button type="submit" className="btn btn-primary" disabled={isSaving}>
                      {isSaving ? t('Wird gespeichert...') : editingManager ? t('Verwalter aktualisieren') : t('Verwalter erstellen')}
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
