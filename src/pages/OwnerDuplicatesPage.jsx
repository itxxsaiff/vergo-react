import { useEffect, useState } from 'react'
import PageContent from '../components/PageContent'
import { useLanguage } from '../context/LanguageContext'
import { api } from '../lib/api'
import { formatDateTimeDisplay } from '../lib/dateFormat'

function OwnerDuplicatesPage() {
  const { t } = useLanguage()
  const [rows, setRows] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getOwnerDuplicates()
      .then((response) => setRows(response.data ?? []))
      .catch((loadError) => setError(t(loadError.message)))
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <PageContent
      title={t('Erkannte Duplikate')}
      subtitle={t('Aufträge, die das System als ähnlich zu einem abgesagten oder bereits laufenden Auftrag erkannt hat.')}
      breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: t('Erkannte Duplikate') }]}
    >
      {error ? <div className="alert alert-danger py-2">{error}</div> : null}

      <div className="card">
        <div className="card-body p-4">
          {isLoading ? (
            <div className="text-muted">{t('Wird geladen...')}</div>
          ) : rows.length === 0 ? (
            <div className="text-muted">{t('Es wurden keine Duplikate erkannt.')}</div>
          ) : (
            <div className="d-flex flex-column gap-3">
              {rows.map((row) => (
                <div key={row.order_id} className="border rounded-3 p-3">
                  <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap mb-2">
                    <div>
                      <div className="fw-semibold">{row.order_number} · {row.title}</div>
                      <div className="text-muted small">
                        {row.property}
                        {row.manager_email ? ` · ${row.manager_name || ''} ${row.manager_email}` : ''}
                      </div>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      {row.similarity !== null ? (
                        <span className="badge bg-light-warning text-warning rounded-pill px-3 py-2">
                          {Math.round(row.similarity * 100)}% {t('Ähnlichkeit')}
                        </span>
                      ) : null}
                      <span className="badge bg-light-primary text-primary rounded-pill px-3 py-2">
                        {t(row.reason === 'cancelled_recreated' ? 'Nach Absage neu erstellt' : 'Ähnlicher laufender Auftrag')}
                      </span>
                    </div>
                  </div>

                  {row.duplicate_of ? (
                    <div className="text-muted small mb-2">
                      {t('Ähnlich zu')}: <strong>{row.duplicate_of.order_number}</strong> · {row.duplicate_of.title}
                      {row.duplicate_of.cancelled_at ? (
                        <> · {t('abgesagt am')} {formatDateTimeDisplay(row.duplicate_of.cancelled_at)}
                          {row.duplicate_of.cancellation_reason ? ` (${row.duplicate_of.cancellation_reason})` : ''}
                        </>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="border rounded-3 p-3 bg-light">
                    <div className="text-muted small text-uppercase fw-semibold mb-1">
                      {t('Begründung der Bewirtschaftung')}
                    </div>
                    <div>{row.explanation || '-'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageContent>
  )
}

export default OwnerDuplicatesPage
