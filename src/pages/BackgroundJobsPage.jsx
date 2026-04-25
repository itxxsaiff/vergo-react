import { useEffect, useMemo, useState } from 'react'
import PageContent from '../components/PageContent'
import { api } from '../lib/api'
import { formatStatusLabel, getStatusBadgeClass } from '../lib/tableStatus'
import { DOCUMENT_TYPE_OPTIONS, getOptionLabel } from '../lib/vergoOptions'

function BackgroundJobsPage() {
  const [jobs, setJobs] = useState([])
  const [filters, setFilters] = useState({ search: '', status: '' })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadJobs()
  }, [])

  async function loadJobs() {
    setIsLoading(true)
    setError('')

    try {
      const response = await api.getBackgroundJobs()
      setJobs(response.data ?? [])
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

  const filteredJobs = useMemo(() => jobs.filter((job) => {
    const searchValue = [
      job.document?.title,
      job.document?.property?.li_number,
      job.document?.property?.title,
      job.order?.title,
      job.summary,
    ].filter(Boolean).join(' ').toLowerCase()

    const searchMatch = !filters.search || searchValue.includes(filters.search.toLowerCase())
    const statusMatch = !filters.status || String(job.status || '').toLowerCase() === filters.status.toLowerCase()

    return searchMatch && statusMatch
  }), [filters.search, filters.status, jobs])

  const summary = {
    queued: jobs.filter((job) => job.status === 'queued').length,
    processing: jobs.filter((job) => job.status === 'processing').length,
    analyzed: jobs.filter((job) => job.status === 'analyzed').length,
    failed: jobs.filter((job) => job.status === 'failed').length,
  }

  return (
    <PageContent
      title="Hintergrundaufgaben"
      subtitle="Verfolgen Sie in der Warteschlange befindliche Gemini-Analysen und überwachen Sie, welche Dokumentaufträge erfolgreich abgeschlossen wurden oder fehlgeschlagen sind."
      breadcrumbs={[
        { label: 'Armaturenbrett', href: '/dashboard' },
        { label: 'Hintergrundaufgaben' },
      ]}
    >
      {error ? <div className="alert alert-danger py-2">{error}</div> : null}

      <div className="row g-3 mb-3">
        {[
          { label: 'In Warteschlange', value: summary.queued, color: 'primary' },
          { label: 'In Bearbeitung', value: summary.processing, color: 'warning' },
          { label: 'Analysiert', value: summary.analyzed, color: 'success' },
          { label: 'Fehlgeschlagen', value: summary.failed, color: 'danger' },
        ].map((item) => (
          <div className="col-md-3" key={item.label}>
            <div className="card mb-0">
              <div className="card-body p-3">
                <div className="text-muted fs-2 mb-1">{item.label}</div>
                <div className={`fw-semibold text-${item.color}`}>{item.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="px-4 py-3 border-bottom">
          <h5 className="card-title fw-semibold mb-0">KI-Auftragswarteschlange</h5>
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
                placeholder="Nach Dokument, Immobilie, Auftrag oder Zusammenfassung suchen"
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Status</label>
              <select className="form-select" name="status" value={filters.status} onChange={handleFilterChange}>
                <option value="">All Status</option>
                <option value="queued">In Warteschlange</option>
                <option value="processing">In Bearbeitung</option>
                <option value="analyzed">Analysiert</option>
                <option value="failed">Fehlgeschlagen</option>
              </select>
            </div>
            <div className="col-md-2 d-flex align-items-end">
              <button
                type="button"
                className="btn btn-light-primary w-100"
                onClick={() => setFilters({ search: '', status: '' })}
              >
                Zurücksetzen
              </button>
            </div>
          </div>

          {isLoading ? <div className="text-muted">Hintergrundaufgaben werden geladen...</div> : null}

          {!isLoading ? (
            <div className="table-responsive rounded-2 mb-0 vergo-table-scroll">
              <table className="table border-none text-nowrap customize-table mb-0 align-middle">
                <thead className="text-dark fs-4">
                  <tr>
                    <th><h6 className="fs-4 fw-semibold mb-0">Dokument</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">Kontext</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">Status</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">Bewertung</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">Aktualisiert</h6></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJobs.map((job) => (
                    <tr key={job.id}>
                      <td>
                        <div className="fw-semibold">{job.document?.title ?? '-'}</div>
                        <div className="text-muted">{job.summary || '-'}</div>
                        <div className="text-muted small">{getOptionLabel(DOCUMENT_TYPE_OPTIONS, job.document?.type)}</div>
                      </td>
                      <td>
                        <div>{job.document?.property?.li_number ?? '-'} - {job.document?.property?.title ?? '-'}</div>
                        <div className="text-muted">{job.order?.title || job.document?.order?.title || '-'}</div>
                      </td>
                      <td>
                        <span className={getStatusBadgeClass(job.status)}>
                          {formatStatusLabel(job.status)}
                        </span>
                      </td>
                      <td>{job.score ?? '-'}</td>
                      <td>{job.updated_at || '-'}</td>
                    </tr>
                  ))}
                  {filteredJobs.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="text-center text-muted py-4">Keine Hintergrundaufgaben gefunden.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </PageContent>
  )
}

export default BackgroundJobsPage
