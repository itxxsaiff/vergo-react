import { useEffect, useState } from 'react'
import PageContent from '../components/PageContent'
import { useAuth } from '../context/AuthContext'
import { confirmDelete, showDeleteSuccess } from '../lib/alerts'
import { api } from '../lib/api'
import { formatStatusLabel, getStatusBadgeClass } from '../lib/tableStatus'

const initialForm = {
  amount: '',
  currency: 'EUR',
  estimated_start_date: '',
  estimated_completion_date: '',
  notes: '',
  status: 'submitted',
}

function BidsPage() {
  const { user } = useAuth()
  const [bids, setBids] = useState([])
  const [filters, setFilters] = useState({ search: '', status: '' })
  const [editingBid, setEditingBid] = useState(null)
  const [form, setForm] = useState(initialForm)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const isProvider = user?.role === 'provider'
  const canEdit = false

  useEffect(() => {
    loadBids()
  }, [])

  useEffect(() => {
    if (editingBid) {
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
  }, [editingBid])

  async function loadBids() {
    setIsLoading(true)
    setError('')

    try {
      const response = await api.getBids()
      setBids(response.data ?? [])
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
    setForm((current) => ({ ...current, [name]: value }))
  }

  function handleEdit(bid) {
    setEditingBid(bid)
    setForm({
      amount: bid.amount || '',
      currency: bid.currency || 'EUR',
      estimated_start_date: bid.estimated_start_date || '',
      estimated_completion_date: bid.estimated_completion_date || '',
      notes: bid.notes || '',
      status: bid.status || 'submitted',
    })
    setError('')
  }

  function closeModal() {
    setEditingBid(null)
    setForm(initialForm)
    setError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setIsSaving(true)
    setError('')

    if (!form.amount) {
      setError('Gebotsbetrag erforderlich.')
      setIsSaving(false)
      return
    }

    if (form.estimated_start_date && form.estimated_completion_date && form.estimated_completion_date < form.estimated_start_date) {
      setError('Das Fertigstellungsdatum muss nach dem Startdatum liegen.')
      setIsSaving(false)
      return
    }

    try {
      const payload = {
        amount: Number(form.amount),
        currency: form.currency.trim() || 'EUR',
        estimated_start_date: form.estimated_start_date || null,
        estimated_completion_date: form.estimated_completion_date || null,
        notes: form.notes || null,
      }

      const response = await api.updateBid(editingBid.id, payload)
      setBids((current) => current.map((bid) => (bid.id === editingBid.id ? response.data : bid)))
      closeModal()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(bidId) {
    const shouldDelete = await confirmDelete('bid')
    if (!shouldDelete) return

    try {
      await api.deleteBid(bidId)
      setBids((current) => current.filter((bid) => bid.id !== bidId))
      showDeleteSuccess('bid')
      if (editingBid?.id === bidId) closeModal()
    } catch (deleteError) {
      setError(deleteError.message)
    }
  }

  const filteredBids = bids.filter((bid) => {
    const searchValue = [
      bid.order?.title,
      bid.order?.property?.li_number,
      bid.order?.property?.title,
      bid.service_provider?.company_name,
      bid.service_provider?.contact_email,
    ].filter(Boolean).join(' ').toLowerCase()

    const searchMatch = !filters.search || searchValue.includes(filters.search.toLowerCase())
    const statusMatch = !filters.status || String(bid.status || '').toLowerCase() === filters.status.toLowerCase()
    return searchMatch && statusMatch
  })

  return (
    <PageContent
      title={isProvider ? 'Eingereichte Angebote' : 'Angebote'}
      subtitle={
        isProvider
          ? 'Verfolgen Sie Ihre eingereichten Angebote und deren Entscheidungsstatus.'
          : 'Überprüfen Sie die Angebotsaktivitäten über alle Aufträge hinweg.'
      }
      breadcrumbs={[
        { label: 'Armaturenbrett', href: '/dashboard' },
        { label: isProvider ? 'Eingereichte Angebote' : 'Angebote' },
      ]}
    >
      <div className="card">
        <div className="px-4 py-3 border-bottom">
          <h5 className="card-title fw-semibold mb-0 lh-sm">{isProvider ? 'Meine Angebotsliste' : 'Angebotsliste'}</h5>
        </div>
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
                  placeholder="Nach Auftrag, Immobilie oder Anbieter suchen"
                />
              </div>
            </div>

            <div className="col-md-3">
              <label className="form-label">Status</label>
              <div className="vergo-select-input-wrap">
                <i className="ti ti-adjustments vergo-select-input-icon" aria-hidden="true"></i>
                <select aria-label="Status" className="form-select" name="status" value={filters.status} onChange={handleFilterChange}>
                  <option value="">All Status</option>
                  <option value="submitted">Eingereicht</option>
                  <option value="shortlisted">Vorausgewählt</option>
                  <option value="approved">Genehmigt</option>
                  <option value="rejected">Abgelehnt</option>
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

          {error && !editingBid ? <div className="alert alert-danger py-2">{error}</div> : null}
          {isLoading ? <p className="text-muted mb-0">Angebote werden geladen...</p> : null}

          {!isLoading ? (
            <div className="table-responsive rounded-2 mb-0 vergo-table-scroll">
              <table className="table border-none text-nowrap customize-table mb-0 align-middle">
                <thead className="text-dark fs-4">
                  <tr>
                    <th><h6 className="fs-4 fw-semibold mb-0">Auftrag</h6></th>
                    {!isProvider ? <th><h6 className="fs-4 fw-semibold mb-0">Anbieter</h6></th> : null}
                    <th><h6 className="fs-4 fw-semibold mb-0">Betrag</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">Zeitraum</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">Anhang</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">Status</h6></th>
                    <th width="110"><h6 className="fs-4 fw-semibold mb-0">Aktion</h6></th>
                  </tr>
                </thead>

                <tbody>
                  {filteredBids.map((bid) => (
                    <tr key={bid.id}>
                      <td>
                        <div className="fw-semibold">{bid.order?.title ?? '-'}</div>
                        <div className="text-muted">
                          {bid.order?.property?.li_number ?? '-'} {bid.order?.property?.title ?? ''}
                        </div>
                      </td>

                      {!isProvider ? (
                        <td>
                          <div>{bid.service_provider?.company_name ?? '-'}</div>
                          <div className="text-muted">{bid.service_provider?.contact_email ?? '-'}</div>
                        </td>
                      ) : null}

                      <td>{bid.amount} {bid.currency}</td>

                      <td>
                        <div>{bid.estimated_start_date || '-'}</div>
                        <div className="text-muted">{bid.estimated_completion_date || '-'}</div>
                      </td>

                      <td>
                        {bid.attachment_name ? (
                          <button
                            type="button"
                            className="btn btn-light-primary btn-sm"
                            onClick={() => api.downloadBidAttachment(bid.id, bid.attachment_name)}
                          >
                            {bid.attachment_name}
                          </button>
                        ) : '-'}
                      </td>

                      <td>
                        <span className={getStatusBadgeClass(bid.status)}>
                          {formatStatusLabel(bid.status)}
                        </span>
                      </td>

                      <td>
                        {canEdit ? (
                          <div className="table-action-group">
                            <button
                              type="button"
                              className="table-action-btn table-action-edit"
                              onClick={() => handleEdit(bid)}
                              title="Angebot bearbeiten"
                            >
                              <i className="ti ti-pencil"></i>
                            </button>

                            <button
                              type="button"
                              className="table-action-btn table-action-delete"
                              onClick={() => handleDelete(bid.id)}
                              title="Angebot löschen"
                            >
                              <i className="ti ti-trash"></i>
                            </button>
                          </div>
                        ) : (
                          <span className="text-muted">Gesperrt</span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {filteredBids.length === 0 ? (
                    <tr>
                      <td colSpan={isProvider ? '6' : '7'} className="text-center text-muted py-4">
                        Keine Angebote gefunden.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>

      {editingBid && canEdit ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1" aria-hidden="false">
            <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
              <div className="modal-content rounded-1">
                <div className="modal-header border-bottom">
                  <h5 className="modal-title">Angebot bearbeiten</h5>
                  <button type="button" className="btn-close" onClick={closeModal}></button>
                </div>
                <form onSubmit={handleSubmit}>
                  <div className="modal-body">
                    <div className="row">
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Betrag</label>
                        <input className="form-control" name="amount" value={form.amount} onChange={handleChange} />
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Währung</label>
                        <select className="form-select" name="currency" value={form.currency} onChange={handleChange}>
                          <option value="EUR">EUR</option>
                          <option value="USD">USD</option>
                          <option value="GBP">GBP</option>
                          <option value="AED">AED</option>
                        </select>
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Geplantes Startdatum</label>
                        <input type="date" className="form-control" name="estimated_start_date" value={form.estimated_start_date} onChange={handleChange} />
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Geplantes Abschlussdatum</label>
                        <input type="date" className="form-control" name="estimated_completion_date" value={form.estimated_completion_date} onChange={handleChange} />
                      </div>
                      <div className="col-12 mb-0">
                        <label className="form-label">Notizen</label>
                        <textarea className="form-control" rows="4" name="notes" value={form.notes} onChange={handleChange}></textarea>
                      </div>
                    </div>
                    {error ? <div className="alert alert-danger py-2 mt-3 mb-0">{error}</div> : null}
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-light-danger text-danger" onClick={closeModal}>Abbrechen</button>
                    <button type="submit" className="btn btn-primary" disabled={isSaving}>
                      {isSaving ? 'Wird gespeichert...' : 'Angebot aktualisieren'}
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

export default BidsPage
