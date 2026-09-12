import { Link, Navigate, useParams } from 'react-router-dom'
import PageContent from '../components/PageContent'
import { PROVIDER_JOB_GROUPS, ProviderOrderCard, useProviderJobs } from '../components/ProviderJobs'
import { useLanguage } from '../context/LanguageContext'

/**
 * Every job in one of the three dashboard groups - what "Show all" opens.
 */
function ProviderJobsPage() {
  const { category } = useParams()
  const { t } = useLanguage()
  const { groups, isLoading, error } = useProviderJobs()
  const group = PROVIDER_JOB_GROUPS[category]

  if (!group) {
    return <Navigate to="/dashboard" replace />
  }

  const jobs = groups[category]

  return (
    <PageContent
      title={t(group.title)}
      breadcrumbs={[
        { label: t('Dashboard'), href: '/dashboard' },
        { label: t(group.title) },
      ]}
    >
      <Link to="/dashboard" className="vergo-provider-back">
        <i className="ti ti-arrow-left"></i>
        <span>{t('Zurück zum Dashboard')}</span>
      </Link>

      {error ? <div className="alert alert-danger py-2">{error}</div> : null}
      {isLoading ? <p className="text-muted">{t('Aufträge werden geladen...')}</p> : null}

      {!isLoading ? (
        jobs.length > 0 ? (
          <div className="row g-3">
            {jobs.map((job) => (
              <div className="col-xl-4 col-md-6" key={job.id}>
                <ProviderOrderCard
                  title={t(job.label ?? group.cardTitle)}
                  order={job.order}
                  bid={job.bid}
                  actionLabel={t(group.actionLabel)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="card">
            <div className="card-body p-4 text-center text-muted">{t(group.empty)}</div>
          </div>
        )
      ) : null}
    </PageContent>
  )
}

export default ProviderJobsPage
