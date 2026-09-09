import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageContent from '../components/PageContent'
import { useLanguage } from '../context/LanguageContext'
import { api } from '../lib/api'
import { formatDateDisplay } from '../lib/dateFormat'
import { formatSwissMoney } from '../lib/numberFormat'
import { getOptionLabel, JOB_TYPE_OPTIONS } from '../lib/vergoOptions'
import { formatStatusLabel, getStatusBadgeClass } from '../lib/tableStatus'

const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

const initialFilters = {
  year: String(new Date().getFullYear()), month: '', quarter: '', provider_id: '', status: '',
}

// Two groupings that span several raw statuses, then every status the data
// actually contains is listed underneath.
const STATUS_GROUPS = [
  { value: '', label: 'Alle Status' },
  { value: 'active', label: 'Alle offenen' },
  { value: 'completed', label: 'Abgeschlossen' },
]

function CompletedJobsPage() {
  const { language, t } = useLanguage()
  const [jobs, setJobs] = useState([])
  const [providers, setProviders] = useState([])
  const [statuses, setStatuses] = useState([])
  const [totals, setTotals] = useState({ job_count: 0, total_value: 0 })
  const [filters, setFilters] = useState(initialFilters)
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const years = useMemo(() => {
    const current = new Date().getFullYear()
    return Array.from({ length: 6 }, (_, index) => String(current - index))
  }, [])

  useEffect(() => {
    let cancelled = false

    api.getCompletedJobs(filters)
      .then((response) => {
        if (cancelled) {
          return
        }

        setJobs(response.data ?? [])
        setTotals(response.totals ?? { job_count: 0, total_value: 0 })

        if (Array.isArray(response.providers)) {
          setProviders(response.providers)
        }

        if (Array.isArray(response.statuses)) {
          setStatuses(response.statuses)
        }
      })
      .catch((loadError) => !cancelled && setError(t(loadError.message)))
      .finally(() => !cancelled && setIsLoading(false))

    return () => {
      cancelled = true
    }
  }, [filters])

  // Month and quarter describe the same thing, so choosing one clears the other.
  function handleFilterChange(event) {
    const { name, value } = event.target

    setFilters((current) => ({
      ...current,
      [name]: value,
      ...(name === 'month' && value ? { quarter: '' } : {}),
      ...(name === 'quarter' && value ? { month: '' } : {}),
    }))
  }

  const visibleJobs = useMemo(() => {
    const term = search.trim().toLowerCase()

    if (!term) {
      return jobs
    }

    return jobs.filter((job) => [job.order_number, job.provider, job.address, job.property, job.title]
      .some((value) => String(value ?? '').toLowerCase().includes(term)))
  }, [jobs, search])

  return (
    <PageContent
      title={t('Aufträge')}
      subtitle={t('Alle Aufträge mit Status, Dienstleister, Adresse, Datum und Preis.')}
      breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: t('Aufträge') }]}
    >
      <div className="card">
        <div className="card-body p-4">
          <div className="row g-3 align-items-end">
            <div className="col-lg-2 col-md-4">
              <label className="form-label">{t('Status')}</label>
              <select className="form-select" name="status" value={filters.status} onChange={handleFilterChange}>
                {STATUS_GROUPS.map((option) => (
                  <option key={option.value} value={option.value}>{t(option.label)}</option>
                ))}
                {statuses.length > 0 ? (
                  <optgroup label={t('Einzelner Status')}>
                    {statuses.map((status) => (
                      <option key={status.value} value={status.value}>
                        {t(formatStatusLabel(status.value))} ({status.count})
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
            </div>

            <div className="col-lg-2 col-md-4">
              <label className="form-label">{t('Jahr')}</label>
              <select className="form-select" name="year" value={filters.year} onChange={handleFilterChange}>
                <option value="">{t('Alle')}</option>
                {years.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </div>

            <div className="col-lg-2 col-md-4">
              <label className="form-label">{t('Monat')}</label>
              <select className="form-select" name="month" value={filters.month} onChange={handleFilterChange}>
                <option value="">{t('Alle')}</option>
                {MONTHS.map((month, index) => (
                  <option key={month} value={index + 1}>{t(month)}</option>
                ))}
              </select>
            </div>

            <div className="col-lg-2 col-md-4">
              <label className="form-label">{t('Quartal')}</label>
              <select className="form-select" name="quarter" value={filters.quarter} onChange={handleFilterChange}>
                <option value="">{t('Alle')}</option>
                {[1, 2, 3, 4].map((quarter) => <option key={quarter} value={quarter}>Q{quarter}</option>)}
              </select>
            </div>

            <div className="col-lg-3 col-md-6">
              <label className="form-label">{t('Dienstleister')}</label>
              <select className="form-select" name="provider_id" value={filters.provider_id} onChange={handleFilterChange}>
                <option value="">{t('Alle Dienstleister')}</option>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>{provider.company_name}</option>
                ))}
              </select>
            </div>

            <div className="col-lg-3 col-md-6">
              <label className="form-label">{t('Suche')}</label>
              <input
                type="search"
                className="form-control"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('Auftragsnummer, Firma oder Adresse')}
              />
            </div>
          </div>

          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mt-4">
            <div className="d-flex flex-wrap gap-4">
              <div>
                <div className="text-muted small">{t('Aufträge')}</div>
                <div className="fw-semibold fs-5">{totals.job_count ?? 0}</div>
              </div>
              <div>
                <div className="text-muted small">{t('Gesamtsumme')}</div>
                <div className="fw-semibold fs-5">{formatSwissMoney(totals.total_value)} CHF</div>
              </div>
            </div>

            <div className="d-flex gap-2">
              <button type="button" className="btn btn-light-primary" onClick={() => setFilters(initialFilters)}>
                <i className="ti ti-refresh me-1"></i>
                {t('Zurücksetzen')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={jobs.length === 0}
                onClick={() => api.openCompletedJobsPdf({ ...filters, language })}
              >
                <i className="ti ti-file-text me-1"></i>
                {t('PDF erstellen')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {error ? <div className="alert alert-danger py-2">{error}</div> : null}

      <div className="card">
        <div className="card-body p-4">
          {isLoading ? (
            <div className="text-muted">{t('Wird geladen...')}</div>
          ) : (
            <div className="table-responsive rounded-2 vergo-table-scroll">
              <table className="table border text-nowrap customize-table mb-0 align-middle">
                <thead className="text-dark fs-4">
                  <tr>
                    <th><h6 className="fs-4 fw-semibold mb-0">{t('Auftragsnummer')}</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">{t('Abgeschlossen am')}</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">{t('Dienstleister')}</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">{t('Adresse')}</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">{t('Gewerk')}</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">{t('Status')}</h6></th>
                    <th className="text-end"><h6 className="fs-4 fw-semibold mb-0">{t('Preis')}</h6></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleJobs.map((job) => (
                    <tr key={job.order_id}>
                      <td>
                        <Link to={`/orders/${job.order_id}`} className="fw-semibold">{job.order_number || '-'}</Link>
                        <div className="text-muted">{job.title}</div>
                      </td>
                      <td>{job.completed_at ? formatDateDisplay(job.completed_at) : '-'}</td>
                      <td>{job.provider || '-'}</td>
                      <td>
                        <div>{job.address || '-'}</div>
                        <div className="text-muted">{job.property || ''}</div>
                      </td>
                      <td>{getOptionLabel(JOB_TYPE_OPTIONS, job.trade) || job.trade || '-'}</td>
                      <td>
                        <span className={getStatusBadgeClass(job.status)}>
                          {t(formatStatusLabel(job.status))}
                        </span>
                      </td>
                      <td className="text-end fw-semibold">
                        {formatSwissMoney(job.amount)} {job.currency || 'CHF'}
                      </td>
                    </tr>
                  ))}

                  {visibleJobs.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center text-muted py-4">
                        {t('Keine Aufträge im Zeitraum gefunden.')}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </PageContent>
  )
}

export default CompletedJobsPage
