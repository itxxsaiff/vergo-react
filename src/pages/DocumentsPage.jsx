import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageContent from '../components/PageContent'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { confirmDelete, showDeleteSuccess } from '../lib/alerts'
import { api } from '../lib/api'
import { formatStatusLabel, getStatusBadgeClass } from '../lib/tableStatus'
import { DOCUMENT_TYPE_OPTIONS, JOB_TYPE_OPTIONS, getOptionLabel } from '../lib/vergoOptions'

const initialForm = {
  property_id: '',
  property_object_ids: [],
  service_type: '',
  service_provider_id: '',
  type: 'invoice',
  file: null,
}

const DISABLED_DOCUMENT_TYPES = ['contract', 'fm_contract']
const AVAILABLE_DOCUMENT_TYPE_OPTIONS = DOCUMENT_TYPE_OPTIONS.filter((option) => !DISABLED_DOCUMENT_TYPES.includes(option.value))

function DocumentsPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [searchParams, setSearchParams] = useSearchParams()
  const [documents, setDocuments] = useState([])
  const [properties, setProperties] = useState([])
  const [propertyObjects, setPropertyObjects] = useState([])
  const [serviceProviders, setServiceProviders] = useState([])
  const [form, setForm] = useState(initialForm)
  const queryType = searchParams.get('type') || ''
  const normalizedQueryType = DISABLED_DOCUMENT_TYPES.includes(queryType) ? 'invoice' : queryType
  const [filters, setFilters] = useState({ search: '', status: '', type: normalizedQueryType })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [error, setError] = useState('')

  const canUpload = ['admin', 'owner', 'manager', 'employee'].includes(user?.role)
  const isOwner = user?.role === 'owner'

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (!DISABLED_DOCUMENT_TYPES.includes(queryType)) {
      return
    }

    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('type', 'invoice')
    setSearchParams(nextParams, { replace: true })
  }, [queryType, searchParams, setSearchParams])

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
      const [documentsResponse, propertiesResponse, propertyObjectsResponse, serviceProvidersResponse] = await Promise.all([
        api.getDocuments(),
        api.getProperties(),
        api.getPropertyObjects(),
        api.getServiceProviders(),
      ])

      setDocuments(documentsResponse.data ?? [])
      setProperties(propertiesResponse.data ?? [])
      setPropertyObjects(propertyObjectsResponse.data ?? [])
      setServiceProviders(serviceProvidersResponse.data ?? [])
    } catch (loadError) {
      setError(t(loadError.message))
    } finally {
      setIsLoading(false)
    }
  }

  function handleFilterChange(event) {
    const { name, value } = event.target
    setFilters((current) => ({ ...current, [name]: value }))
  }

  useEffect(() => {
    setFilters((current) => ({
      ...current,
      type: normalizedQueryType,
    }))
  }, [normalizedQueryType])

  function handleChange(event) {
    const { name, value, files, selectedOptions } = event.target
    setForm((current) => ({
      ...current,
      [name]: files
        ? files[0]
        : name === 'property_object_ids'
          ? Array.from(selectedOptions, (option) => option.value)
          : value,
      ...(name === 'property_id'
        ? {
          property_object_ids: [],
        }
        : {}),
    }))
  }

  function openModal() {
    setForm({
      ...initialForm,
      type: AVAILABLE_DOCUMENT_TYPE_OPTIONS.some((option) => option.value === normalizedQueryType)
        ? normalizedQueryType
        : initialForm.type,
    })
    setError('')
    setIsModalOpen(true)
  }

  function closeModal() {
    setForm(initialForm)
    setError('')
    setIsModalOpen(false)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setIsSaving(true)
    setError('')

    if (!form.property_id) {
      setError('Bitte wählen Sie eine LI-Nummer aus.')
      setIsSaving(false)
      return
    }

    if (!form.service_type) {
      setError('Bitte wählen Sie ein Gewerk aus.')
      setIsSaving(false)
      return
    }

    if ((form.property_object_ids ?? []).length === 0) {
      setError('Bitte wählen Sie mindestens ein Objekt aus.')
      setIsSaving(false)
      return
    }

    if (!form.service_provider_id) {
      setError('Bitte wählen Sie einen Dienstleister aus.')
      setIsSaving(false)
      return
    }

    if (!form.file) {
      setError('Bitte wählen Sie eine Dokumentdatei aus..')
      setIsSaving(false)
      return
    }

    try {
      const payload = new FormData()
      payload.append('property_id', form.property_id)
      payload.append('type', form.type)
      payload.append('title', buildDocumentTitle())
      payload.append('service_type', form.service_type)
      payload.append('service_provider_id', form.service_provider_id)
      form.property_object_ids.forEach((id) => payload.append('property_object_ids[]', id))
      payload.append('property_object_id', form.property_object_ids[0])
      payload.append('file', form.file)

      const response = await api.createDocument(payload)
      setDocuments((current) => [response.data, ...current])
      closeModal()
    } catch (saveError) {
      setError(t(saveError.message))
    } finally {
      setIsSaving(false)
    }
  }

  function buildDocumentTitle() {
    const selectedProperty = properties.find((property) => String(property.id) === String(form.property_id))
    const selectedProvider = serviceProviders.find((provider) => String(provider.id) === String(form.service_provider_id))
    const selectedTrade = getOptionLabel(JOB_TYPE_OPTIONS, form.service_type)
    const fileName = form.file?.name?.replace(/\.[^.]+$/, '') || 'Rechnung'

    return [
      'Rechnung',
      selectedProperty?.li_number,
      selectedTrade !== '-' ? selectedTrade : null,
      selectedProvider?.company_name,
      fileName,
    ].filter(Boolean).join(' - ')
  }

  const availablePropertyObjects = propertyObjects.filter((propertyObject) => String(propertyObject.property_id) === String(form.property_id))

  async function handleDelete(documentId) {
    const shouldDelete = await confirmDelete('document')
    if (!shouldDelete) return

    try {
      await api.deleteDocument(documentId)
      setDocuments((current) => current.filter((document) => document.id !== documentId))
      showDeleteSuccess('document')
    } catch (deleteError) {
      setError(t(deleteError.message))
    }
  }

  const filteredDocuments = documents.filter((document) => {
    const searchValue = [
      document.title,
      document.file_name,
      document.type,
      document.property?.li_number,
      document.property?.title,
      document.order?.title,
    ].filter(Boolean).join(' ').toLowerCase()

    const searchMatch = !filters.search || searchValue.includes(filters.search.toLowerCase())
    const statusMatch = !filters.status || String(document.status || '').toLowerCase() === filters.status.toLowerCase()
    const typeMatch = !filters.type || String(document.type || '').toLowerCase() === filters.type.toLowerCase()
    return searchMatch && statusMatch && typeMatch
  })

  return (
    <PageContent
      title="Unterlagen"
      subtitle={isOwner
        ? 'Laden Sie Verträge und Rechnungen hoch, damit Vergo die Preise vergleichen und Ihnen zeigen kann, ob Sie möglicherweise zu viel bezahlen.'
        : 'Laden Sie Verträge, Rechnungen und Anlagendokumente hoch, die später in den Preisvergleich und die Gemini-Analyse einfließen.'}
      breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Unterlagen' }]}
    >
      <div className="card">
        <div className="card-body p-4">
          <div className="row g-3 mb-4 vergo-filter-bar vergo-filter-bar-compact">
            <div className="col-xl-5 col-lg-6 col-md-12">
              <label className="form-label">Suchen</label>
              <div className="vergo-search-input-wrap">
                <i className="ti ti-search vergo-search-input-icon" aria-hidden="true"></i>
                <input aria-label="Suche" className="form-control" name="search" value={filters.search} onChange={handleFilterChange} placeholder="Suche nach Titel, Akte, Objekt oder Bestellung" />
              </div>
            </div>
            <div className="col-xl-3 col-lg-6 col-md-6">
              <label className="form-label">Status</label>
              <div className="vergo-select-input-wrap">
                <i className="ti ti-adjustments vergo-select-input-icon" aria-hidden="true"></i>
                <select aria-label="Status" className="form-select" name="status" value={filters.status} onChange={handleFilterChange}>
                  <option value="">All Status</option>
                  <option value="uploaded">Hochgeladen</option>
                  <option value="processing">In Bearbeitung</option>
                  <option value="analyzed">Analysiert</option>
                </select>
              </div>
            </div>
            <div className="col-xl-4 col-lg-12 col-md-6">
              <div className="d-flex align-items-end justify-content-xl-end gap-2 flex-nowrap vergo-action-buttons">
                <button type="button" className="btn btn-light-primary vergo-filter-reset-btn text-nowrap" onClick={() => setFilters({ search: '', status: '', type: normalizedQueryType })}>
                  <i className="ti ti-refresh me-1" aria-hidden="true"></i>
                  Zurücksetzen
                </button>
                {canUpload ? (
                  <button type="button" className="btn btn-primary text-nowrap" onClick={openModal}>
                    <i className="ti ti-plus me-1"></i>
                    {isOwner ? t('Rechnung hochladen zur Preisprüfung') : 'Rechnung hochladen'}
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {error && !isModalOpen ? <div className="alert alert-danger py-2">{error}</div> : null}
          {isLoading ? <p className="text-muted mb-0">Dokumente werden geladen...</p> : null}

          {!isLoading ? (
            <div className="table-responsive rounded-2 mb-0 vergo-table-scroll">
              <table className="table border-none text-nowrap customize-table mb-0 align-middle">
                <thead className="text-dark fs-4">
                  <tr>
                    <th><h6 className="fs-4 fw-semibold mb-0">Titel</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">Kontext</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">Typ</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">Status</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">Aktion</h6></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments.map((document) => (
                    <tr key={document.id}>
                      <td>
                        <div className="fw-semibold">{document.title}</div>
                        <div className="text-muted">{document.file_name}</div>
                      </td>
                      <td>
                        <div>{document.property?.li_number ? `${document.property.li_number} - ${document.property.title}` : '-'}</div>
                        <div className="text-muted">{document.order?.title || '-'}</div>
                      </td>
                      <td>{getOptionLabel(DOCUMENT_TYPE_OPTIONS, document.type)}</td>
                      <td><span className={getStatusBadgeClass(document.status)}>{formatStatusLabel(document.status)}</span></td>
                      <td>
                        <div className="table-action-group">
                          <button
                            type="button"
                            className="table-action-btn table-action-edit"
                            onClick={() => api.downloadDocument(document.id, document.file_name)}
                            title="Dokument herunterladen"
                          >
                            <i className="ti ti-download"></i>
                          </button>
                          {canUpload ? (
                            <button type="button" className="table-action-btn table-action-delete" onClick={() => handleDelete(document.id)} title="Dokument löschen">
                              <i className="ti ti-trash"></i>
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredDocuments.length === 0 ? (
                    <tr><td colSpan="5" className="text-center text-muted py-4">Keine Dokumente gefunden.</td></tr>
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
                  <h5 className="modal-title">{isOwner ? 'Rechnung für Preisprüfung hochladen' : 'Rechnung hochladen'}</h5>
                  <button type="button" className="btn-close" onClick={closeModal}></button>
                </div>
                <form onSubmit={handleSubmit}>
                  <div className="modal-body">
                    <div className="row">
                      <div className="col-md-6 mb-3">
                        <label className="form-label">LI-Nummer</label>
                        <select className="form-select" name="property_id" value={form.property_id} onChange={handleChange}>
                          <option value="">LI-Nummer auswählen</option>
                          {properties.map((property) => (
                            <option key={property.id} value={property.id}>{property.li_number} - {property.title}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Gewerk</label>
                        <select className="form-select" name="service_type" value={form.service_type} onChange={handleChange}>
                          <option value="">Gewerk auswählen</option>
                          {JOB_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Objekte</label>
                        <select
                          className="form-select"
                          name="property_object_ids"
                          value={form.property_object_ids}
                          onChange={handleChange}
                          multiple
                          size="5"
                          disabled={!form.property_id}
                        >
                          {availablePropertyObjects.map((propertyObject) => (
                            <option key={propertyObject.id} value={propertyObject.id}>
                              {propertyObject.address || propertyObject.name}
                            </option>
                          ))}
                        </select>
                        <small className="text-muted">Mehrfachauswahl möglich.</small>
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Dienstleister</label>
                        <select className="form-select" name="service_provider_id" value={form.service_provider_id} onChange={handleChange}>
                          <option value="">Dienstleister auswählen</option>
                          {serviceProviders.map((provider) => (
                            <option key={provider.id} value={provider.id}>{provider.company_name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-12 mb-0">
                        <label className="form-label">Datei</label>
                        <input type="file" className="form-control" name="file" onChange={handleChange} />
                      </div>
                    </div>
                    {error ? <div className="alert alert-danger py-2 mt-3 mb-0">{error}</div> : null}
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-light-danger text-danger" onClick={closeModal}>Stornieren</button>
                    <button type="submit" className="btn btn-primary" disabled={isSaving}>{isSaving ? 'Hochladen...' : 'Dokument hochladen'}</button>
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

export default DocumentsPage
