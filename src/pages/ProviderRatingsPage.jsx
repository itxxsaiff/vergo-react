import { useEffect, useState } from 'react'
import PageContent from '../components/PageContent'
import { useLanguage } from '../context/LanguageContext'
import { api } from '../lib/api'
import { formatDateTimeDisplay } from '../lib/dateFormat'

function ProviderRatingsPage() {
  const { t } = useLanguage()
  const [ratings, setRatings] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getAdminProviderRatings()
      .then((response) => setRatings(response.data ?? []))
      .catch((loadError) => setError(loadError.message))
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <PageContent
      title={t('Dienstleister-Bewertungen')}
      subtitle={t('Vertrauliche Bewertungen der Auftraggeber. Nur für Administratoren sichtbar.')}
      breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: t('Dienstleister-Bewertungen') }]}
    >
      {error ? <div className="alert alert-danger py-2">{error}</div> : null}

      <div className="card">
        <div className="card-body">
          {isLoading ? (
            <div className="text-muted">{t('Wird geladen...')}</div>
          ) : ratings.length === 0 ? (
            <div className="text-muted">{t('Noch keine Bewertungen vorhanden.')}</div>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th>{t('Dienstleister')}</th>
                    <th>{t('Auftragsnummer')}</th>
                    <th className="text-center">{t('Bewertung')}</th>
                    <th>{t('Begründung')}</th>
                    <th className="text-end">{t('VERGO-Ranking')}</th>
                    <th className="text-end">{t('Datum')}</th>
                  </tr>
                </thead>
                <tbody>
                  {ratings.map((entry) => (
                    <tr key={entry.id}>
                      <td className="fw-semibold">{entry.company_name || '-'}</td>
                      <td>
                        <div>{entry.order_number || '-'}</div>
                        <div className="text-muted small">{entry.order_title}</div>
                      </td>
                      <td className="text-center">
                        <span className={`badge ${entry.rating <= 2 ? 'bg-light-danger text-danger' : 'bg-light-success text-success'} rounded-pill px-3 py-2`}>
                          {entry.rating} / 5
                        </span>
                      </td>
                      <td className="text-muted small">{entry.reason || '-'}</td>
                      <td className="text-end">{entry.vergo_ranking_score ?? t('unbewertet')}</td>
                      <td className="text-end text-muted small">{formatDateTimeDisplay(entry.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </PageContent>
  )
}

export default ProviderRatingsPage
