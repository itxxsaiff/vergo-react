import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageContent from '../components/PageContent'
import { useAuth } from '../context/AuthContext'
import { confirmDelete, showDeleteSuccess } from '../lib/alerts'
import { api } from '../lib/api'
import { PROPERTY_USAGE_OPTIONS, getOptionLabel } from '../lib/vergoOptions'
import vergoLogoUrl from '/VERGO.png'

const initialForm = {
  title: '',
  property_manager_profile_id: '',
  management: '',
  owner_id: '',
  postal_code: '',
  city: '',
  usage: '',
  lot_area: '',
  apartment_count: '',
  commercial_area: '',
}

const requiredFields = ['title', 'postal_code', 'city', 'usage', 'lot_area']

function getOwnerNames(property) {
  return (property?.owners ?? [])
    .map((owner) => owner?.name)
    .filter(Boolean)
    .join(', ')
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function getPrintablePropertyCards(property) {
  const objects = property?.objects ?? []

  if (objects.length > 0) {
    return objects.map((object) => ({
      id: object.id ?? `${object.address}-${object.postal_code}-${object.city}`,
      address: object.address || object.name || '-',
      postalCode: object.postal_code || property?.postal_code || '-',
      city: object.city || property?.city || '-',
    }))
  }

  return [{
    id: `property-${property?.id ?? 'summary'}`,
    address: property?.address_line_1 || property?.title || '-',
    postalCode: property?.postal_code || '-',
    city: property?.city || '-',
  }]
}

function buildPropertyPdfHtml(property, logoSrc) {
  const ownerLabel = getOwnerNames(property) || '-'
  const managerLabel = property?.assigned_manager_profile?.name || property?.management || '-'
  const cards = getPrintablePropertyCards(property)
  const usageLabel = getOptionLabel(PROPERTY_USAGE_OPTIONS, property?.usage)
  const cardsHtml = cards.map((card) => `
    <article class="property-card">
      <div class="property-card-icon-wrap">
        <div class="property-card-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 10.5 12 4l8 6.5"></path>
            <path d="M7.5 10v8h9v-8"></path>
            <path d="M10.5 18v-4h3v4"></path>
          </svg>
        </div>
      </div>
      <div class="property-card-label">Adresse</div>
      <div class="property-card-address">${escapeHtml(card.address)}</div>
      <div class="property-card-meta">
        <div>
          <div class="property-card-label">PLZ</div>
          <div class="property-card-value">${escapeHtml(card.postalCode)}</div>
        </div>
        <div>
          <div class="property-card-label">Ort</div>
          <div class="property-card-value">${escapeHtml(card.city)}</div>
        </div>
      </div>
    </article>
  `).join('')

  return `
    <!DOCTYPE html>
    <html lang="de">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(property?.li_number || 'Liegenschaft')} - Vergo PDF</title>
        <style>
          :root {
            --vergo-accent: #bb8867;
            --vergo-accent-soft: rgba(187, 136, 103, 0.18);
            --vergo-border: #efe7df;
            --vergo-text: #22304a;
            --vergo-muted: #8a93a8;
            --vergo-surface: #ffffff;
            --vergo-page: #f7f8fc;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            font-family: Arial, sans-serif;
            color: var(--vergo-text);
            background: var(--vergo-page);
          }

          .page {
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto;
            padding: 18mm 12mm 14mm;
            background: var(--vergo-surface);
          }

          .header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 24px;
            margin-bottom: 18px;
          }

          .property-number {
            margin: 0;
            font-size: 28px;
            line-height: 1.1;
            font-weight: 500;
            letter-spacing: 0.02em;
            color: #000;
          }

          .logo-wrap {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 10px 14px;
            border-radius: 0;
            background: var(--vergo-accent);
          }

          .logo {
            width: 190px;
            max-width: 100%;
            display: block;
            object-fit: contain;
          }

          .summary {
            display: grid;
            grid-template-columns: repeat(6, minmax(0, 1fr));
            gap: 14px;
            margin-bottom: 28px;
            width: 100%;
            padding: 20px 18px;
            border: 1px solid var(--vergo-border);
            border-radius: 20px;
            background: linear-gradient(180deg, #fff, #fcfbfa);
          }

          .summary-label,
          .property-card-label {
            margin-bottom: 6px;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.14em;
            font-weight: 700;
            color: var(--vergo-muted);
          }

          .summary-value {
            font-size: 13px;
            line-height: 1.4;
            font-weight: 700;
            word-break: break-word;
          }

          .cards {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 16px;
            align-items: start;
          }

          .property-card {
            position: relative;
            min-height: 110px;
            padding: 28px 14px 14px;
            border: 1px solid var(--vergo-border);
            border-radius: 18px;
            background: #fff;
            box-shadow: 0 8px 22px rgba(34, 48, 74, 0.05);
          }

          .property-card-icon-wrap {
            position: absolute;
            top: -19px;
            left: 50%;
            transform: translateX(-50%);
          }

          .property-card-icon {
            width: 38px;
            height: 38px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 999px;
            border: 1px solid rgba(187, 136, 103, 0.18);
            background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.98), rgba(255,245,239,0.95));
            box-shadow: 0 8px 20px rgba(187, 136, 103, 0.24);
          }

          .property-card-icon svg {
            width: 16px;
            height: 16px;
            stroke: var(--vergo-accent);
            stroke-width: 1.8;
            fill: none;
            stroke-linecap: round;
            stroke-linejoin: round;
          }

          .property-card-address {
            min-height: 34px;
            margin-bottom: 16px;
            font-size: 14px;
            line-height: 1.35;
            font-weight: 700;
            word-break: break-word;
          }

          .property-card-meta {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }

          .property-card-value {
            font-size: 14px;
            font-weight: 700;
          }

          @page {
            size: A4;
            margin: 0;
          }

          @media print {
            body {
              background: #fff;
            }

            .page {
              width: 210mm;
              min-height: 297mm;
              margin: 0;
            }
          }
        </style>
      </head>
      <body>
        <main class="page">
          <header class="header">
            <h1 class="property-number">${escapeHtml(property?.li_number || '-')}</h1>
            <div class="logo-wrap">
              <img class="logo" src="${logoSrc}" alt="Vergo" />
            </div>
          </header>

          <section class="summary">
            <div>
              <div class="summary-label">Bezeichnung</div>
              <div class="summary-value">${escapeHtml(property?.title || '-')}</div>
            </div>
            <div>
              <div class="summary-label">Bewirtschaftung</div>
              <div class="summary-value">${escapeHtml(managerLabel)}</div>
            </div>
            <div>
              <div class="summary-label">Eigentümer</div>
              <div class="summary-value">${escapeHtml(ownerLabel)}</div>
            </div>
            <div>
              <div class="summary-label">PLZ</div>
              <div class="summary-value">${escapeHtml(property?.postal_code || '-')}</div>
            </div>
            <div>
              <div class="summary-label">Ort</div>
              <div class="summary-value">${escapeHtml(property?.city || '-')}</div>
            </div>
            <div>
              <div class="summary-label">Nutzung</div>
              <div class="summary-value">${escapeHtml(usageLabel || '-')}</div>
            </div>
          </section>

          <section class="cards">
            ${cardsHtml}
          </section>
        </main>
      </body>
    </html>
  `
}

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('The logo image could not be prepared for printing.'))
    reader.readAsDataURL(blob)
  })
}

async function getPrintableLogoSrc() {
  const response = await fetch(vergoLogoUrl)

  if (!response.ok) {
    throw new Error('The logo image could not be loaded for the PDF preview.')
  }

  const blob = await response.blob()
  return readBlobAsDataUrl(blob)
}

function printPropertyPdf(html) {
  const existingFrame = document.getElementById('vergo-property-pdf-frame')

  if (existingFrame) {
    existingFrame.remove()
  }

  const iframe = document.createElement('iframe')
  iframe.id = 'vergo-property-pdf-frame'
  iframe.style.position = 'fixed'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.style.opacity = '0'
  iframe.style.pointerEvents = 'none'
  document.body.appendChild(iframe)

  const frameDocument = iframe.contentWindow?.document

  if (!frameDocument || !iframe.contentWindow) {
    iframe.remove()
    throw new Error('PDF preview could not be prepared.')
  }

  frameDocument.open()
  frameDocument.write(html)
  frameDocument.close()

  iframe.onload = () => {
    const frameWindow = iframe.contentWindow
    const images = Array.from(frameDocument.images)
    const imageLoadPromises = images.map((image) => {
      if (image.complete) {
        return Promise.resolve()
      }

      return new Promise((resolve) => {
        image.addEventListener('load', resolve, { once: true })
        image.addEventListener('error', resolve, { once: true })
      })
    })

    Promise.all(imageLoadPromises).finally(() => {
      frameWindow?.focus()
      frameWindow?.print()
      window.setTimeout(() => iframe.remove(), 1000)
    })
  }
}

function getOwnerCompanyLabel(property) {
  const ownerNames = (property?.owners ?? [])
    .map((owner) => owner?.name)
    .filter(Boolean)

  return ownerNames.length > 0 ? ownerNames.join(', ') : '-'
}

function PropertiesPage() {
  const { user } = useAuth()
  const [properties, setProperties] = useState([])
  const [owners, setOwners] = useState([])
  const [propertyManagers, setPropertyManagers] = useState([])
  const [form, setForm] = useState(initialForm)
  const [filters, setFilters] = useState({ search: '', usage: '' })
  const [editingProperty, setEditingProperty] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const isInternalUser = ['admin', 'employee'].includes(user?.role)
  const canManageProperties = ['admin', 'employee', 'owner'].includes(user?.role)

  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      setError('')

      try {
        const requests = [api.getProperties()]

        if (isInternalUser) {
          requests.push(api.getUserDirectoryOwners(), api.getPropertyManagers())
        }

        const [propertiesResponse, ownersResponse, propertyManagersResponse] = await Promise.all(requests)

        setProperties(propertiesResponse.data ?? [])
        setOwners(ownersResponse?.data ?? [])
        setPropertyManagers(propertyManagersResponse?.data ?? [])
      } catch (loadError) {
        setError(loadError.message)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [isInternalUser])

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

  const filteredProperties = useMemo(() => {
    return properties.filter((property) => {
      const searchValue = [
        property.li_number,
        property.title,
        property.postal_code,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const searchMatch = !filters.search || searchValue.includes(filters.search.toLowerCase())
      const usageMatch = !filters.usage || property.usage === filters.usage

      return searchMatch && usageMatch
    })
  }, [filters.search, filters.usage, properties])

  function handleChange(event) {
    const { name, value } = event.target

    setForm((current) => ({
      ...current,
      [name]: value,
    }))

    setFieldErrors((current) => {
      if (!current[name]) {
        return current
      }

      const nextErrors = { ...current }
      delete nextErrors[name]
      return nextErrors
    })
  }

  function handleFilterChange(event) {
    const { name, value } = event.target

    setFilters((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function openCreateModal() {
    setEditingProperty(null)
    setForm(initialForm)
    setError('')
    setFieldErrors({})
    setIsModalOpen(true)
  }

  function handleEdit(property) {
    setEditingProperty(property)
    setForm({
      title: property.title || '',
      property_manager_profile_id: String(
        property.property_manager_profile_id
          ?? property.assigned_manager_profile?.id
          ?? propertyManagers.find((manager) => {
            const managerLabel = (manager.name || manager.email || '').trim().toLowerCase()
            return managerLabel && managerLabel === String(property.management || '').trim().toLowerCase()
          })?.id
          ?? ''
      ),
      management: property.management || '',
      owner_id: isInternalUser && property.owners?.[0]?.id ? String(property.owners[0].id) : '',
      postal_code: property.postal_code || '',
      city: property.city || '',
      usage: property.usage || '',
      lot_area: property.lot_area ?? '',
      apartment_count: property.apartment_count ?? '',
      commercial_area: property.commercial_area ?? '',
    })
    setError('')
    setFieldErrors({})
    setIsModalOpen(true)
  }

  function closeModal() {
    setEditingProperty(null)
    setForm(initialForm)
    setError('')
    setFieldErrors({})
    setIsModalOpen(false)
  }

  function validateForm() {
    const nextErrors = {}

    requiredFields.forEach((fieldName) => {
      const value = form[fieldName]
      const normalizedValue = typeof value === 'string' ? value.trim() : value

      if (normalizedValue === '' || normalizedValue === null || normalizedValue === undefined) {
        nextErrors[fieldName] = true
      }
    })

    if (isInternalUser && !String(form.owner_id || '').trim()) {
      nextErrors.owner_id = true
    }

    if (isInternalUser && !String(form.property_manager_profile_id || '').trim()) {
      nextErrors.property_manager_profile_id = true
    }

    if (form.usage !== 'commercial' && !String(form.apartment_count ?? '').trim()) {
      nextErrors.apartment_count = true
    }

    if (form.usage !== 'residential' && !String(form.commercial_area ?? '').trim()) {
      nextErrors.commercial_area = true
    }

    return nextErrors
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    const validationErrors = validateForm()

    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors)
      setError('Bitte alle Pflichtfelder ausfüllen.')
      return
    }

    setFieldErrors({})
    setIsSaving(true)

    try {
      const payload = {
        title: form.title.trim(),
        management: form.management.trim() || null,
        postal_code: form.postal_code.trim() || null,
        city: form.city.trim() || null,
        usage: form.usage,
        lot_area: form.lot_area ? Number(form.lot_area) : null,
        apartment_count: form.usage === 'commercial' ? null : Number(form.apartment_count),
        commercial_area: form.usage === 'residential' ? null : Number(form.commercial_area),
        size: form.lot_area ? Number(form.lot_area) : null,
        status: 'active',
      }

      if (isInternalUser) {
        payload.owner_id = Number(form.owner_id)
        payload.property_manager_profile_id = Number(form.property_manager_profile_id)
      }

      if (editingProperty) {
        const response = await api.updateProperty(editingProperty.id, payload)
        setProperties((current) => current.map((property) => (
          property.id === editingProperty.id ? response.data : property
        )))
      } else {
        const response = await api.createProperty(payload)
        setProperties((current) => [response.data, ...current])
      }

      closeModal()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(propertyId) {
    const shouldDelete = await confirmDelete('property')

    if (!shouldDelete) {
      return
    }

    try {
      await api.deleteProperty(propertyId)
      setProperties((current) => current.filter((property) => property.id !== propertyId))
      showDeleteSuccess('property')

      if (editingProperty?.id === propertyId) {
        closeModal()
      }
    } catch (deleteError) {
      setError(deleteError.message)
    }
  }

  async function handleGeneratePdf(propertyId) {
    setError('')

    try {
      const response = await api.getProperty(propertyId)
      const property = response.data ?? null

      if (!property) {
        throw new Error('Die Liegenschaft konnte nicht geladen werden.')
      }

      const logoSrc = await getPrintableLogoSrc()
      printPropertyPdf(buildPropertyPdfHtml(property, logoSrc))
    } catch (pdfError) {
      setError(pdfError.message)
    }
  }

  return (
    <PageContent
      title="Liegenschaften"
      subtitle={
        isInternalUser
          ? ''
          : ''
      }
      breadcrumbs={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Liegenschaften' },
      ]}
    >
      <div className="card">
        <div className="card-body p-4">
          <div className="row g-3 mb-4 vergo-filter-bar vergo-filter-bar-compact">
            <div className="col-xl-6 col-md-12">
              <div className="vergo-search-input-wrap">
                <i className="ti ti-search vergo-search-input-icon" aria-hidden="true"></i>
                <input
                  aria-label="Suche"
                  className="form-control"
                  name="search"
                  value={filters.search}
                  onChange={handleFilterChange}
                  placeholder="Nach Liegenschaftsnummer, Name oder PLZ suchen"
                />
              </div>
            </div>

            <div className="col-xl-2 col-md-6">
              <select className="form-select" name="usage" value={filters.usage} onChange={handleFilterChange}>
                <option value="">Nutzung auswählen</option>
                {PROPERTY_USAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="col-xl-4 col-md-6">
              <div className="d-flex justify-content-lg-end gap-2 flex-nowrap vergo-action-buttons">
                <button
                  type="button"
                  className="btn btn-light-primary text-nowrap"
                  onClick={() => setFilters({ search: '', usage: '' })}
                >
                  <i className="ti ti-refresh me-1"></i>
                  Zurücksetzen
                </button>

                {canManageProperties ? (
                  <button
                    type="button"
                    className="btn btn-primary text-nowrap"
                    onClick={openCreateModal}
                  >
                    <i className="ti ti-plus me-1"></i>
                    Liegenschaft erstellen
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {error && !isModalOpen ? <div className="alert alert-danger py-2">{error}</div> : null}
          {isLoading ? <p className="text-muted mb-0">Eigenschaften werden geladen...</p> : null}

          {!isLoading ? (
            <div className="table-responsive rounded-2 mb-0 vergo-table-scroll">
              <table className="table border-none text-nowrap customize-table mb-0 align-middle">
                <thead className="text-dark fs-4">
                  <tr>
                    <th><h6 className="fs-4 fw-semibold mb-0">Code</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">Bezeichnung</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">PLZ</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">Ort</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">Anzahl</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">Eigentümerschaft</h6></th>
                    <th width="170"><h6 className="fs-4 fw-semibold mb-0">Aktion</h6></th>
                  </tr>
                </thead>

                <tbody>
                  {filteredProperties.map((property) => (
                    <tr key={property.id}>
                      <td className="fw-semibold">{property.li_number || '-'}</td>
                      <td>
                        <div className="fw-semibold">{property.title || '-'}</div>
                        <div className="text-muted small">{getOptionLabel(PROPERTY_USAGE_OPTIONS, property.usage)}</div>
                      </td>
                      <td>{property.postal_code || '-'}</td>
                      <td>{property.city || '-'}</td>
                      <td>{property.objects_count ?? 0}</td>
                      <td>{getOwnerCompanyLabel(property)}</td>
                      <td>
                        <div className="table-action-group">
                          <Link
                            to={`/properties/${property.id}`}
                            className="table-action-btn table-action-view"
                            title="Objekte anzeigen"
                          >
                            <i className="ti ti-building-community"></i>
                          </Link>

                          <button
                            type="button"
                            className="table-action-btn table-action-view"
                            onClick={() => handleGeneratePdf(property.id)}
                            title="Liegenschaft als PDF drucken"
                          >
                            <i className="ti ti-file-invoice"></i>
                          </button>

                          {canManageProperties ? (
                            <button
                              type="button"
                              className="table-action-btn table-action-edit"
                              onClick={() => handleEdit(property)}
                              title="Liegenschaft bearbeiten"
                            >
                              <i className="ti ti-pencil"></i>
                            </button>
                          ) : null}

                          {isInternalUser ? (
                            <button
                              type="button"
                              className="table-action-btn table-action-delete"
                              onClick={() => handleDelete(property.id)}
                              title="Liegenschaft löschen"
                            >
                              <i className="ti ti-trash"></i>
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredProperties.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center text-muted py-4">
                        Keine Eigenschaften gefunden.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>

      {canManageProperties && isModalOpen ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1" aria-hidden="false">
            <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
              <div className="modal-content rounded-1">
                <div className="modal-header border-bottom">
                  <div>
                    <h5 className="modal-title mb-1">{editingProperty ? 'Liegenschaft bearbeiten' : 'Liegenschaft erstellen'}</h5>
                    <p className="text-muted mb-0">Pflegen Sie die Stammdaten der Liegenschaft inklusive Eigentümer und Nutzung.</p>
                  </div>
                  <button type="button" className="btn-close" aria-label="Schließen" onClick={closeModal}></button>
                </div>

                <form onSubmit={handleSubmit}>
                  <div className="modal-body">
                    <div className="row">
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Bezeichnung</label>
                          <input className={`form-control${fieldErrors.title ? ' is-invalid' : ''}`} name="title" value={form.title} onChange={handleChange} />
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Bewirtschaftung</label>
                          {isInternalUser ? (
                            <select
                              className={`form-select${fieldErrors.property_manager_profile_id ? ' is-invalid' : ''}`}
                              name="property_manager_profile_id"
                              value={form.property_manager_profile_id}
                              onChange={(event) => {
                                const selectedId = event.target.value
                                const selectedManager = propertyManagers.find((manager) => String(manager.id) === selectedId)
                                setForm((current) => ({
                                  ...current,
                                  property_manager_profile_id: selectedId,
                                  management: selectedManager?.name || selectedManager?.email || '',
                                }))
                                setFieldErrors((current) => {
                                  const nextErrors = { ...current }
                                  delete nextErrors.property_manager_profile_id
                                  delete nextErrors.management
                                  return nextErrors
                                })
                              }}
                            >
                              <option value="">Verwalter auswählen</option>
                              {propertyManagers.map((manager) => (
                                <option key={manager.id} value={manager.id}>
                                  {manager.name || 'Immobilienverwalter'}{manager.email ? ` (${manager.email})` : ''}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input className={`form-control${fieldErrors.management ? ' is-invalid' : ''}`} name="management" value={form.management} onChange={handleChange} />
                          )}
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Nutzung</label>
                          <select className={`form-select${fieldErrors.usage ? ' is-invalid' : ''}`} name="usage" value={form.usage} onChange={handleChange}>
                            <option value="">Nutzung auswählen</option>
                            {PROPERTY_USAGE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {isInternalUser ? (
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Eigentümer</label>
                            <select className={`form-select${fieldErrors.owner_id ? ' is-invalid' : ''}`} name="owner_id" value={form.owner_id} onChange={handleChange}>
                              <option value="">Eigentümer auswählen</option>
                              {owners.map((owner) => (
                                <option key={owner.id} value={owner.id}>
                                  {owner.company_name || owner.name || owner.customer_number}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ) : null}

                      <div className={isInternalUser ? 'col-md-3' : 'col-md-6'}>
                        <div className="mb-3">
                          <label className="form-label">PLZ</label>
                          <input className={`form-control${fieldErrors.postal_code ? ' is-invalid' : ''}`} name="postal_code" value={form.postal_code} onChange={handleChange} />
                        </div>
                      </div>
                      <div className={isInternalUser ? 'col-md-3' : 'col-md-6'}>
                        <div className="mb-3">
                          <label className="form-label">Ort</label>
                          <input className={`form-control${fieldErrors.city ? ' is-invalid' : ''}`} name="city" value={form.city} onChange={handleChange} />
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Grundstücksfläche (m²)</label>
                          <input className={`form-control${fieldErrors.lot_area ? ' is-invalid' : ''}`} name="lot_area" type="number" min="0" step="0.01" value={form.lot_area} onChange={handleChange} />
                        </div>
                      </div>
                      {form.usage !== 'commercial' ? (
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Anzahl Wohnungen</label>
                            <input className={`form-control${fieldErrors.apartment_count ? ' is-invalid' : ''}`} name="apartment_count" type="number" min="0" value={form.apartment_count} onChange={handleChange} />
                          </div>
                        </div>
                      ) : null}
                      {form.usage !== 'residential' ? (
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Quadratmeter Gewerbefläche</label>
                            <input className={`form-control${fieldErrors.commercial_area ? ' is-invalid' : ''}`} name="commercial_area" type="number" min="0" step="0.01" value={form.commercial_area} onChange={handleChange} />
                          </div>
                        </div>
                      ) : null}
                    </div>
                    {error ? <div className="alert alert-danger py-2 mt-3 mb-0">{error}</div> : null}
                  </div>

                  <div className="modal-footer">
                    <button type="button" className="btn btn-light-danger text-danger" onClick={closeModal}>Abbrechen</button>
                    <button type="submit" className="btn btn-primary" disabled={isSaving}>
                      {isSaving ? 'Wird gespeichert...' : editingProperty ? 'Liegenschaft aktualisieren' : 'Liegenschaft speichern'}
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

export default PropertiesPage
