import { Link } from 'react-router-dom'
import DashboardGreeting from '../components/DashboardGreeting'
import PageContent from '../components/PageContent'
import {
  PROVIDER_JOB_GROUP_ORDER,
  PROVIDER_JOB_GROUPS,
  ProviderOrderCard,
  useProviderJobs,
} from '../components/ProviderJobs'
import { useLanguage } from '../context/LanguageContext'

// How many of the newest jobs each column shows before "Show all".
const JOBS_PER_COLUMN = 3

/**
 * Three columns side by side - running, directly assigned and public - each
 * with its newest three jobs, so the page no longer grows as jobs come in.
 * "Show all" opens the full list for that column on its own page.
 */
function ProviderDashboardPage() {
  const { t } = useLanguage()
  const { groups, isLoading, error } = useProviderJobs()

  return (
    <PageContent>
      <DashboardGreeting />

      {error ? <div className="alert alert-danger py-2">{error}</div> : null}
      {isLoading ? <p className="text-muted">{t('Aufträge werden geladen...')}</p> : null}

      {!isLoading ? (
        <div className="row g-4 vergo-provider-columns">
          {PROVIDER_JOB_GROUP_ORDER.map((groupKey) => {
            const group = PROVIDER_JOB_GROUPS[groupKey]
            const jobs = groups[groupKey]

            return (
              <div className="col-xl-4" key={groupKey}>
                <div className="card h-100 mb-0">
                  <div className="card-body p-4 d-flex flex-column">
                    <div className="d-flex align-items-center justify-content-between gap-3 mb-3">
                      <h4 className="fw-semibold mb-0">{t(group.title)}</h4>
                      <span className="badge bg-light-primary text-primary rounded-pill px-3 py-2">
                        {jobs.length}
                      </span>
                    </div>

                    <div className="d-grid gap-3 flex-grow-1 align-content-start">
                      {jobs.slice(0, JOBS_PER_COLUMN).map((job) => (
                        <ProviderOrderCard
                          key={job.id}
                          title={t(group.cardTitle)}
                          order={job.order}
                          bid={job.bid}
                          actionLabel={t(group.actionLabel)}
                        />
                      ))}

                      {jobs.length === 0 ? (
                        <div className="border rounded-3 p-4 text-center text-muted">
                          {t(group.empty)}
                        </div>
                      ) : null}
                    </div>

                    {jobs.length > 0 ? (
                      <Link to={`/provider-jobs/${groupKey}`} className="btn btn-light border mt-3 vergo-provider-show-all">
                        <span>{t('Alle anzeigen')} ({jobs.length})</span>
                        <i className="ti ti-arrow-right"></i>
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : null}
    </PageContent>
  )
}

export default ProviderDashboardPage
