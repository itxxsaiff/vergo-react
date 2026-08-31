import { useEffect, useState } from 'react'
import PageContent from '../components/PageContent'
import { useLanguage } from '../context/LanguageContext'
import { api } from '../lib/api'
import { formatCurrencyAmount, getOptionLabel, JOB_TYPE_OPTIONS } from '../lib/vergoOptions'

function StatTile({ label, value }) {
  return (
    <div className="col-6 col-lg-2">
      <div className="border rounded-3 p-3 h-100">
        <div className="text-muted small">{label}</div>
        <div className="fw-semibold fs-5">{value}</div>
      </div>
    </div>
  )
}

function CountTable({ title, rows, labelHeading, valueHeading, valueKey, money }) {
  const { t } = useLanguage()

  return (
    <div className="card">
      <div className="px-4 py-3 border-bottom">
        <h5 className="card-title fw-semibold mb-0">{title}</h5>
      </div>
      <div className="card-body p-4">
        {rows.length === 0 ? (
          <div className="text-muted">{t('Keine Daten vorhanden.')}</div>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>{labelHeading}</th>
                  <th className="text-end">{valueHeading}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.label ?? index}-${index}`}>
                    <td>{row.label}</td>
                    <td className="text-end fw-semibold">
                      {money ? formatCurrencyAmount(Number(row[valueKey] || 0)) : row[valueKey]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function OwnerAnalyticsPage() {
  const { t } = useLanguage()
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getOwnerAnalytics()
      .then((response) => setData(response.data ?? null))
      .catch((loadError) => setError(t(loadError.message)))
      .finally(() => setIsLoading(false))
  }, [])

  const totals = data?.totals ?? {}

  return (
    <PageContent
      title={t('Auswertungen')}
      subtitle={t('Kennzahlen über alle Ihre Liegenschaften.')}
      breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: t('Auswertungen') }]}
    >
      {error ? <div className="alert alert-danger py-2">{error}</div> : null}
      {isLoading ? <div className="card"><div className="card-body">{t('Wird geladen...')}</div></div> : null}

      {!isLoading && data ? (
        <>
          <div className="row g-3 mb-4">
            <StatTile label={t('Aufträge gesamt')} value={totals.order_count ?? 0} />
            <StatTile label={t('Aktive Aufträge')} value={totals.active_order_count ?? 0} />
            <StatTile label={t('Abgeschlossen')} value={totals.completed_order_count ?? 0} />
            <StatTile label={t('Abgesagt')} value={totals.cancelled_order_count ?? 0} />
            <StatTile label={t('Liegenschaften')} value={totals.property_count ?? 0} />
            <StatTile label={t('Gesamtausgaben')} value={formatCurrencyAmount(Number(totals.total_spend || 0))} />
          </div>

          <div className="row">
            <div className="col-xl-6">
              <CountTable title={t('Ausgaben pro Liegenschaft')} rows={data.spend_by_property} labelHeading={t('Liegenschaft')} valueHeading={t('Ausgaben')} valueKey="total_spend" money />
            </div>
            <div className="col-xl-6">
              <CountTable title={t('Ausgaben pro Objekt')} rows={data.spend_by_object} labelHeading={t('Objekt')} valueHeading={t('Ausgaben')} valueKey="total_spend" money />
            </div>
            <div className="col-xl-6">
              <CountTable title={t('Ausgaben pro Kanton')} rows={data.spend_by_canton} labelHeading={t('Kanton')} valueHeading={t('Ausgaben')} valueKey="total_spend" money />
            </div>
            <div className="col-xl-6">
              <CountTable title={t('Aufträge pro Liegenschaft')} rows={data.orders_by_property} labelHeading={t('Liegenschaft')} valueHeading={t('Aufträge')} valueKey="order_count" />
            </div>
            <div className="col-xl-6">
              <CountTable title={t('Aufträge pro Objekt')} rows={data.orders_by_object} labelHeading={t('Objekt')} valueHeading={t('Aufträge')} valueKey="order_count" />
            </div>
            <div className="col-xl-6">
              <CountTable title={t('Aufträge pro Bewirtschaftung')} rows={data.orders_by_management} labelHeading={t('Bewirtschaftung')} valueHeading={t('Aufträge')} valueKey="order_count" />
            </div>
            <div className="col-xl-6">
              <CountTable title={t('Aufträge pro Bewirtschafter')} rows={data.orders_by_manager_email} labelHeading={t('E-Mail')} valueHeading={t('Aufträge')} valueKey="order_count" />
            </div>
            <div className="col-xl-6">
              <CountTable title={t('Stornierungen pro Bewirtschafter')} rows={(data.cancellations_by_manager ?? []).map((row) => ({ label: row.manager_email, cancelled_count: row.cancelled_count }))} labelHeading={t('E-Mail')} valueHeading={t('Abgesagt')} valueKey="cancelled_count" />
            </div>

            <div className="col-12">
              <div className="card">
                <div className="px-4 py-3 border-bottom">
                  <h5 className="card-title fw-semibold mb-0">{t('Dienstleister')}</h5>
                </div>
                <div className="card-body p-4">
                  {(data.providers ?? []).length === 0 ? (
                    <div className="text-muted">{t('Keine Daten vorhanden.')}</div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table align-middle mb-0">
                        <thead>
                          <tr>
                            <th>{t('Firma')}</th>
                            <th className="text-end">{t('Beauftragt')}</th>
                            <th className="text-end">{t('Abgeschlossen')}</th>
                            <th className="text-end">{t('Umsatz')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.providers.map((provider) => (
                            <tr key={provider.company_name}>
                              <td className="fw-semibold">{provider.company_name}</td>
                              <td className="text-end">{provider.awarded_count}</td>
                              <td className="text-end">{provider.completed_count}</td>
                              <td className="text-end fw-semibold">{formatCurrencyAmount(Number(provider.revenue || 0))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="col-xl-6">
              <div className="card">
                <div className="px-4 py-3 border-bottom">
                  <h5 className="card-title fw-semibold mb-0">{t('Dienstleister pro Liegenschaft')}</h5>
                </div>
                <div className="card-body p-4">
                  {(data.providers_by_property ?? []).length === 0 ? (
                    <div className="text-muted">{t('Keine Daten vorhanden.')}</div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table align-middle mb-0">
                        <thead>
                          <tr>
                            <th>{t('Liegenschaft')}</th>
                            <th>{t('Firma')}</th>
                            <th className="text-end">{t('Abgeschlossen')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.providers_by_property.map((row, index) => (
                            <tr key={`${row.property}-${row.company_name}-${index}`}>
                              <td>{row.property}</td>
                              <td>{row.company_name}</td>
                              <td className="text-end fw-semibold">{row.completed_count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="col-xl-6">
              <div className="card">
                <div className="px-4 py-3 border-bottom">
                  <h5 className="card-title fw-semibold mb-0">{t('Häufigste Leistungen pro Liegenschaft')}</h5>
                </div>
                <div className="card-body p-4">
                  {(data.top_services_by_property ?? []).length === 0 ? (
                    <div className="text-muted">{t('Keine Daten vorhanden.')}</div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table align-middle mb-0">
                        <thead>
                          <tr>
                            <th>{t('Liegenschaft')}</th>
                            <th>{t('Häufigste Leistung')}</th>
                            <th className="text-end">{t('Aufträge')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.top_services_by_property.map((row) => (
                            <tr key={row.property}>
                              <td>{row.property}</td>
                              <td>{getOptionLabel(JOB_TYPE_OPTIONS, row.top_service) || row.top_service || '-'}</td>
                              <td className="text-end">{row.services?.[0]?.order_count ?? 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </PageContent>
  )
}

export default OwnerAnalyticsPage
