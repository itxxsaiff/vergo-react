import { useEffect, useMemo, useState } from 'react'
import PageContent from '../components/PageContent'
import { useLanguage } from '../context/LanguageContext'
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
  status: 'active',
}

function getDisplayName(owner) {
  return owner.name || owner.company_name || [owner.first_name, owner.last_name].filter(Boolean).join(' ') || '-'
}

function getOwnerTypeLabel(ownerType) {
  return ownerType === 'private_individual' ? 'Privatperson' : 'Firma'
}

function getLoginLabel(owner) {
  return owner.owner_type === 'private_individual'
    ? owner.email || '-'
    : owner.domain_suffix ? `@${owner.domain_suffix}` : '-'
}

function OwnersPage() {
  const { t } = useLanguage()
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
  const [fieldErrors, setFieldErrors] = useState({})

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

    setForm((current) => ({
      ...current,
      [name]: value,
    }))
    setFieldErrors((current) => {
      if (name === 'owner_type') {
        const next = { ...current }
        delete next.company_name
        delete next.domain_suffix
        delete next.first_name
        delete next.last_name
        return next
      }

      if (!current[name]) return current
      const next = { ...current }
      delete next[name]
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
    setFieldErrors({})

    const isPrivateIndividual = form.owner_type === 'private_individual'
    const requiredFields = [
      isPrivateIndividual ? 'first_name' : 'company_name',
      ...(isPrivateIndividual ? ['last_name'] : ['domain_suffix']),
      'address',
      'postal_code',
      'city',
      'email',
      'phone',
    ]
    const nextFieldErrors = requiredFields.reduce((errors, field) => {
      if (!String(form[field] ?? '').trim()) {
        errors[field] = true
      }
      return errors
    }, {})

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

    try {
      const payload = {
        owner_type: form.owner_type,
        company_name: isPrivateIndividual ? null : form.company_name.trim(),
        first_name: isPrivateIndividual ? form.first_name.trim() : null,
        last_name: isPrivateIndividual ? form.last_name.trim() : null,
        address: form.address.trim(),
        postal_code: form.postal_code.trim(),
        city: form.city.trim(),
        domain_suffix: isPrivateIndividual ? null : form.domain_suffix.trim().replace(/^@+/, '').toLowerCase(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        status: form.status,
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
      status: owner.status || 'active',
    })
    setError('')
    setFieldErrors({})
  }

  function handleCancelEdit() {
    setEditingOwnerId(null)
    setForm(initialForm)
    setError('')
    setFieldErrors({})
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
      title={t('Eigentümer')}
      subtitle={t('Erstellen Sie Eigentümer als Firma oder Privatperson und hinterlegen Sie nur die für den Login benötigten Stammdaten.')}
      breadcrumbs={[
        { label: t('Dashboard'), href: '/dashboard' },
        { label: t('Eigentümer') },
      ]}
    >
      <div className="row">
        <div className="col-xl-5">
          <div className="card">
            <div className="card-body">
              <h4 className="card-title mb-4">{editingOwnerId ? t('Eigentümer bearbeiten') : t('Eigentümer erstellen')}</h4>
              {editingOwnerId ? <p className="text-muted">{t('Ausgewählten Eigentümer bearbeiten.')}</p> : null}

              <form onSubmit={handleSubmit} noValidate>
                <div className="mb-3">
                  <label className="form-label">{t('Typ')}</label>
                  <div className="btn-group w-100" role="group" aria-label={t('Typ')}>
                    <input
                      type="radio"
                      className="btn-check"
                      name="owner_type"
                      id="owner-type-company"
                      value="company"
                      checked={form.owner_type === 'company'}
                      onChange={handleChange}
                    />
                    <label className="btn btn-outline-primary" htmlFor="owner-type-company">{t('Firma')}</label>

                    <input
                      type="radio"
                      className="btn-check"
                      name="owner_type"
                      id="owner-type-private"
                      value="private_individual"
                      checked={form.owner_type === 'private_individual'}
                      onChange={handleChange}
                    />
                    <label className="btn btn-outline-primary" htmlFor="owner-type-private">{t('Privatperson')}</label>
                  </div>
                </div>

                {form.owner_type === 'private_individual' ? (
                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">{t('Vorname')}</label>
                        <input className={`form-control${fieldErrors.first_name ? ' is-invalid' : ''}`} name="first_name" value={form.first_name} onChange={handleChange} />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">{t('Nachname')}</label>
                        <input className={`form-control${fieldErrors.last_name ? ' is-invalid' : ''}`} name="last_name" value={form.last_name} onChange={handleChange} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mb-3">
                    <label className="form-label">{t('Firmenname')}</label>
                    <input className={`form-control${fieldErrors.company_name ? ' is-invalid' : ''}`} name="company_name" value={form.company_name} onChange={handleChange} />
                  </div>
                )}

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
                  <div className="col-md-8">
                    <div className="mb-3">
                      <label className="form-label">{t('Ort')}</label>
                      <input className={`form-control${fieldErrors.city ? ' is-invalid' : ''}`} name="city" value={form.city} onChange={handleChange} />
                    </div>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label">{t('E-Mail')}</label>
                  <input type="email" className={`form-control${fieldErrors.email ? ' is-invalid' : ''}`} name="email" value={form.email} onChange={handleChange} />
                </div>

                <div className="mb-3">
                  <label className="form-label">{t('Telefon')}</label>
                  <input className={`form-control${fieldErrors.phone ? ' is-invalid' : ''}`} name="phone" value={form.phone} onChange={handleChange} />
                </div>

                {form.owner_type === 'company' ? (
                  <div className="mb-3">
                    <label className="form-label">{t('Domain-Endung')}</label>
                    <input className={`form-control${fieldErrors.domain_suffix ? ' is-invalid' : ''}`} name="domain_suffix" value={form.domain_suffix} onChange={handleChange} placeholder={t('beispiel.ch')} />
                  </div>
                ) : null}

                <div className="mb-3">
                  <label className="form-label">{t('Status')}</label>
                  <select className="form-select" name="status" value={form.status} onChange={handleChange}>
                    <option value="active">{t('Aktiv')}</option>
                    <option value="inactive">{t('Inaktiv')}</option>
                  </select>
                </div>

                <div className="alert alert-light border small">
                  {form.owner_type === 'company'
                    ? t('Firmen-Eigentümer melden sich über die Domain-Endung und einen Code an. Die E-Mail-Adresse dient hier nur als Kontaktoption. Ein Passwort wird nicht gesetzt.')
                    : t('Privatpersonen melden sich mit genau dieser E-Mail-Adresse und einem Code per E-Mail an. Ein Passwort wird nicht gesetzt.')}
                </div>

                {error ? <div className="alert alert-danger py-2">{error}</div> : null}

                <div className="d-flex gap-2">
                  <button type="submit" className="btn btn-primary waves-effect waves-light" disabled={isSaving}>
                    {isSaving ? t('Wird gespeichert...') : editingOwnerId ? t('Eigentümer aktualisieren') : t('Eigentümer erstellen')}
                  </button>
                  {editingOwnerId ? (
                    <button type="button" className="btn btn-light border" onClick={handleCancelEdit}>
                      {t('Abbrechen')}
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
              <h5 className="card-title fw-semibold mb-0 lh-sm">{t('Eigentümerliste')}</h5>
            </div>
            <div className="card-body p-4">
              <div className="row g-3 mb-4 vergo-filter-bar">
                <div className="col-md-6">
                  <label className="form-label">{t('Suche')}</label>
                  <div className="vergo-search-input-wrap">
                    <i className="ti ti-search vergo-search-input-icon" aria-hidden="true"></i>
                    <input
                      aria-label={t('Suche')}
                      className="form-control"
                      name="search"
                      value={filters.search}
                      onChange={handleFilterChange}
                      placeholder={t('Suche nach Name, Domain, E-Mail oder Ort')}
                    />
                  </div>
                </div>
                <div className="col-md-3">
                  <label className="form-label">{t('Status')}</label>
                  <div className="vergo-select-input-wrap">
                    <i className="ti ti-adjustments vergo-select-input-icon" aria-hidden="true"></i>
                    <select aria-label={t('Status')} className="form-select" name="status" value={filters.status} onChange={handleFilterChange}>
                      <option value="">{t('All Status')}</option>
                      <option value="active">{t('Aktiv')}</option>
                      <option value="inactive">{t('Inaktiv')}</option>
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
                    {t('Zurücksetzen')}
                  </button>
                </div>
              </div>

              {isLoading ? <p className="text-muted mb-0">{t('Eigentümer werden geladen...')}</p> : null}

              {!isLoading ? (
                <div className="table-responsive rounded-2 mb-0 vergo-table-scroll">
                  <table className="table border-none text-nowrap customize-table mb-0 align-middle">
                    <thead className="text-dark fs-4">
                      <tr>
                        <th><h6 className="fs-4 fw-semibold mb-0">{t('Kundennummer')}</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">{t('Name')}</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">{t('Typ')}</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">Login</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">{t('Ort')}</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">{t('Liegenschaften')}</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">{t('Status')}</h6></th>
                        <th width="90"><h6 className="fs-4 fw-semibold mb-0">{t('Aktion')}</h6></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOwners.map((owner) => (
                        <tr key={owner.id}>
                          <td>{owner.customer_number || '-'}</td>
                          <td className="fw-semibold">{getDisplayName(owner)}</td>
                          <td>{t(getOwnerTypeLabel(owner.owner_type))}</td>
                          <td>{getLoginLabel(owner)}</td>
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
                                title={t('Eigentümer bearbeiten')}
                              >
                                <i className="ti ti-pencil"></i>
                              </button>
                              <button
                                type="button"
                                className="table-action-btn table-action-delete"
                                onClick={() => handleDelete(owner.id)}
                                title={t('Eigentümer löschen')}
                              >
                                <i className="ti ti-trash"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {filteredOwners.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="text-center text-muted py-4">
                            {t('Keine Eigentümer gefunden.')}
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
