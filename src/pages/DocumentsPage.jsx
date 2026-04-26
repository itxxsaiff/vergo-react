import { useEffect, useState } from 'react'
import PageContent from '../components/PageContent'
import { useAuth } from '../context/AuthContext'
import { confirmDelete, showDeleteSuccess } from '../lib/alerts'
import { api } from '../lib/api'
import { formatStatusLabel, getStatusBadgeClass } from '../lib/tableStatus'
import { DOCUMENT_TYPE_OPTIONS, getOptionLabel } from '../lib/vergoOptions'

const initialForm = {
  property_id: '',
  order_id: '',
  type: 'contract',
  title: '',
  file: null,
}

function DocumentsPage() {
  const { user } = useAuth()
  const [documents, setDocuments] = useState([])
  const [properties, setProperties] = useState([])
  const [orders, setOrders] = useState([])
  const [form, setForm] = useState(initialForm)
  const [filters, setFilters] = useState({ search: '', status: '' })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [error, setError] = useState('')

  const canUpload = ['admin', 'owner', 'manager'].includes(user?.role)
  const isOwner = user?.role === 'owner'

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
      const [documentsResponse, propertiesResponse, ordersResponse] = await Promise.all([
        api.getDocuments(),
        api.getProperties(),
        api.getOrders(),
      ])

      setDocuments(documentsResponse.data ?? [])
      setProperties(propertiesResponse.data ?? [])
      setOrders(ordersResponse.data ?? [])
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
    const { name, value, files } = event.target
    setForm((current) => ({
      ...current,
      [name]: files ? files[0] : value,
    }))
  }

  function openModal() {
    setForm(initialForm)
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

    if (!form.title.trim()) {
      setError('Ein Dokumenttitel ist erforderlich..')
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
      if (form.property_id) payload.append('property_id', form.property_id)
      if (form.order_id) payload.append('order_id', form.order_id)
      payload.append('type', form.type)
      payload.append('title', form.title)
      payload.append('file', form.file)

      const response = await api.createDocument(payload)
      setDocuments((current) => [response.data, ...current])
      closeModal()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(documentId) {
    const shouldDelete = await confirmDelete('document')
    if (!shouldDelete) return

    try {
      await api.deleteDocument(documentId)
      setDocuments((current) => current.filter((document) => document.id !== documentId))
      showDeleteSuccess('document')
    } catch (deleteError) {
      setError(deleteError.message)
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
    return searchMatch && statusMatch
  })

  return (
    <PageContent
      title="Unterlagen"
      subtitle={isOwner
        ? 'Laden Sie Verträge und Rechnungen hoch, damit Vergo die Preise vergleichen und Ihnen zeigen kann, ob Sie möglicherweise zu viel bezahlen.'
        : 'Laden Sie Verträge, Rechnungen und Anlagendokumente hoch, die später in den Preisvergleich und die Gemini-Analyse einfließen.'}
      breadcrumbs={[{ label: 'Armaturenbrett', href: '/dashboard' }, { label: 'Unterlagen' }]}
      actions={canUpload ? (
        <button type="button" className="btn btn-primary" onClick={openModal}>
          <i className="ti ti-plus me-1"></i>
          {isOwner ? 'Vertrag hochladen zur Preisprüfung' : 'Dokument hochladen'}
        </button>
      ) : null}
    >
      <div className="card">
        <div className="card-body p-4">
          <div className="row g-3 mb-4 vergo-filter-bar">
            <div className="col-md-7">
              <label className="form-label">Suchen</label>
              <div className="vergo-search-input-wrap">
                <i className="ti ti-search vergo-search-input-icon" aria-hidden="true"></i>
                <input aria-label="Suche" className="form-control" name="search" value={filters.search} onChange={handleFilterChange} placeholder="Suche nach Titel, Akte, Objekt oder Bestellung" />
              </div>
            </div>
            <div className="col-md-3">
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
            <div className="col-md-2 d-flex align-items-end justify-content-end vergo-filter-reset-wrap">
              <button type="button" className="btn btn-light-primary vergo-filter-reset-btn" onClick={() => setFilters({ search: '', status: '' })}>
                <i className="ti ti-refresh me-1" aria-hidden="true"></i>
                Zurücksetzen
              </button>
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
                  <h5 className="modal-title">{isOwner ? 'Vertrag für Preisprüfung hochladen' : 'Dokument hochladen'}</h5>
                  <button type="button" className="btn-close" onClick={closeModal}></button>
                </div>
                <form onSubmit={handleSubmit}>
                  <div className="modal-body">
                    <div className="row">
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Eigentum</label>
                        <select className="form-select" name="property_id" value={form.property_id} onChange={handleChange}>
                          <option value="">Eigenschaft auswählen</option>
                          {properties.map((property) => (
                            <option key={property.id} value={property.id}>{property.li_number} - {property.title}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Befehl</label>
                        <select className="form-select" name="order_id" value={form.order_id} onChange={handleChange}>
                          <option value="">Befehl auswählen</option>
                          {orders.map((order) => (
                            <option key={order.id} value={order.id}>{order.title}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Typ</label>
                        <select className="form-select" name="type" value={form.type} onChange={handleChange}>
                          {DOCUMENT_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Titel</label>
                        <input className="form-control" name="title" value={form.title} onChange={handleChange} />
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
