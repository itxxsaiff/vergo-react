import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PageContent from '../components/PageContent'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { formatStatusLabel, getStatusBadgeClass } from '../lib/tableStatus'
import { getOptionLabel, JOB_TYPE_OPTIONS } from '../lib/vergoOptions'

function PropertyDetailsPage() {
  const { user } = useAuth()
  const { propertyId } = useParams()
  const [property, setProperty] = useState(null)
  const [latestPropertyAnalysis, setLatestPropertyAnalysis] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isComparingPrice, setIsComparingPrice] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadProperty()
  }, [propertyId])

  async function loadProperty() {
    setIsLoading(true)
    setError('')

    try {
      const response = await api.getProperty(propertyId)
      setProperty(response.data ?? null)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleComparePrice() {
    setIsComparingPrice(true)
    setError('')

    try {
      const response = await api.comparePropertyPrice(propertyId)
      setLatestPropertyAnalysis(response.data?.analysis ?? null)
      await loadProperty()
    } catch (compareError) {
      setError(compareError.message)
    } finally {
      setIsComparingPrice(false)
    }
  }

  const propertyPriceRecommendation = useMemo(() => {
    const propertyAnalyses = property?.analysis_results ?? []
    const persistedAnalysis = propertyAnalyses.find(
      (result) => result?.comparison_data?.analysis_type === 'property_price_recommendation',
    ) ?? null

    if (persistedAnalysis) return persistedAnalysis

    if (latestPropertyAnalysis?.comparison_data?.analysis_type === 'property_price_recommendation') {
      return latestPropertyAnalysis
    }

    const documentFallback = (property?.documents ?? [])
      .flatMap((document) => document.analysis_results ?? [])
      .find((result) => result?.comparison_data?.analysis_type === 'property_price_recommendation')

    return documentFallback ?? null
  }, [property, latestPropertyAnalysis])

  const propertyBenchmarkHistory = useMemo(() => {
    const persistedResults = (property?.analysis_results ?? []).filter(
      (result) => result?.comparison_data?.analysis_type === 'property_price_recommendation',
    )

    const mergedResults = latestPropertyAnalysis
      ? [latestPropertyAnalysis, ...persistedResults.filter((result) => result.id !== latestPropertyAnalysis.id)]
      : persistedResults

    return mergedResults
  }, [property, latestPropertyAnalysis])

  return (
    <PageContent
      title="Objektdetails"
      subtitle="Überprüfen Sie die Immobilie, ihre Dokumente, verknüpfte Bestellungen und das Ergebnis des Preisvergleichs auf Objektebene."
      breadcrumbs={[
        { label: 'Armaturenbrett', href: '/dashboard' },
        { label: 'Eigenschaften', href: '/properties' },
        { label: 'Objektdetails' },
      ]}
    >
      {error ? <div className="alert alert-danger py-2">{error}</div> : null}
      {isLoading ? <div className="card"><div className="card-body">Objektdetails werden geladen...</div></div> : null}

      {!isLoading && property ? (
        <div className="row">
          <div className="col-xl-4">
            <div className="card">
              <div className="card-body">
                <h5 className="fw-semibold mb-3">{property.li_number} - {property.title}</h5>
                <div className="mb-2"><strong>Eigentümer:</strong> {property.owners?.[0]?.name || '-'}</div>
                <div className="mb-2"><strong>Stadt:</strong> {property.city || '-'}</div>
                <div className="mb-2"><strong>Land:</strong> {property.country || '-'}</div>
                <div className="mb-2"><strong>Größe:</strong> {property.size ? `${property.size} m²` : '-'}</div>
                <div className="mb-2"><strong>Objekte:</strong> {property.objects_count ?? 0}</div>
                <div className="mb-2"><strong>Bestellungen:</strong> {property.orders_count ?? 0}</div>
                <div className="mb-3"><strong>Dokumente:</strong> {property.documents_count ?? 0}</div>
                <div className="mb-3">
                  <strong>Status:</strong>{' '}
                  <span className={getStatusBadgeClass(property.status)}>{formatStatusLabel(property.status)}</span>
                </div>
                <div className="d-flex gap-2 flex-wrap">
                  <button type="button" className="btn btn-success" onClick={handleComparePrice} disabled={isComparingPrice}>
                    {isComparingPrice ? 'Preisvergleich...' : user?.role === 'owner' ? 'Prüfen, ob ich zu viel bezahle' : 'Preis vergleichen'}
                  </button>
                  <Link className="btn btn-light-primary" to="/documents">
                    Dokumente ansehen
                  </Link>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <h5 className="fw-semibold mb-3">Ergebnis der Immobilienpreisentwicklung</h5>
                {propertyPriceRecommendation ? (
                  <>
                    <div className="d-flex align-items-center justify-content-between gap-3 mb-3">
                      <span className="text-muted">Aktuelles Signal</span>
                      <span className={getStatusBadgeClass(propertyPriceRecommendation.comparison_data?.pricing_signal)}>
                        {formatStatusLabel(propertyPriceRecommendation.comparison_data?.pricing_signal)}
                      </span>
                    </div>
                    <div className="mb-2"><strong>Benchmark:</strong> {propertyPriceRecommendation.comparison_data?.benchmark_amount ?? '-'} {propertyPriceRecommendation.comparison_data?.lowest_bid_currency ?? 'EUR'}</div>
                    <div className="mb-2"><strong>Niedrigstes Gebot:</strong> {propertyPriceRecommendation.comparison_data?.lowest_bid_amount ?? '-'} {propertyPriceRecommendation.comparison_data?.lowest_bid_currency ?? 'EUR'}</div>
                    <div className="mb-2"><strong>Varianz:</strong> {propertyPriceRecommendation.comparison_data?.variance_percentage ?? '-'}%</div>
                    <div className="mb-2"><strong>Service:</strong> {getOptionLabel(JOB_TYPE_OPTIONS, propertyPriceRecommendation.comparison_data?.service_category) || propertyPriceRecommendation.comparison_data?.service_category || '-'}</div>
                    <div className="mb-2"><strong>Intervall:</strong> {propertyPriceRecommendation.comparison_data?.service_interval || '-'}</div>
                    <div className="mb-2"><strong>Ersparnis:</strong> {propertyPriceRecommendation.comparison_data?.estimated_savings ?? '-'} {propertyPriceRecommendation.comparison_data?.lowest_bid_currency ?? 'EUR'}</div>
                    <div className="mb-0"><strong>Quellen:</strong> {propertyPriceRecommendation.comparison_data?.benchmark_source_count ?? 0} analysierte Dokumente</div>
                  </>
                ) : (
                  <div className="text-muted">Keine Empfehlung auf Objektebene vorhanden. Analysieren Sie zuerst die Objektdokumente und klicken Sie dann auf <strong>Preis vergleichen</strong>.</div>)}
              </div>
            </div>
          </div>

          <div className="col-xl-8">
            {propertyPriceRecommendation ? (
              <div className={`alert ${propertyPriceRecommendation.comparison_data?.pricing_signal === 'too_high'
                  ? 'alert-light-danger'
                  : propertyPriceRecommendation.comparison_data?.pricing_signal === 'too_low'
                    ? 'alert-light-warning'
                    : 'alert-light-success'
                } border mb-4`}>
                <div className="fw-semibold mb-1">Preisvergleichsergebnis</div>
                <div>{propertyPriceRecommendation.summary}</div>
                {(propertyPriceRecommendation.comparison_data?.reasons ?? []).length > 0 ? (
                  <ul className="mb-0 mt-2 ps-3">
                    {propertyPriceRecommendation.comparison_data.reasons.map((reason, index) => (
                      <li key={`${reason}-${index}`}>{reason}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            <div className="card">
              <div className="px-4 py-3 border-bottom">
                <h5 className="card-title fw-semibold mb-0">Benchmark-Historie</h5>
              </div>
              <div className="card-body p-4">
                {propertyBenchmarkHistory.length > 0 ? (
                  <div className="table-responsive rounded-2 mb-0">
                    <table className="table border-none text-nowrap customize-table mb-0 align-middle">
                      <thead className="text-dark fs-4">
                        <tr>
                          <th><h6 className="fs-4 fw-semibold mb-0">Erstellt</h6></th>
                          <th><h6 className="fs-4 fw-semibold mb-0">Signal</h6></th>
                          <th><h6 className="fs-4 fw-semibold mb-0">Benchmark</h6></th>
                          <th><h6 className="fs-4 fw-semibold mb-0">Quellen</h6></th>
                          <th><h6 className="fs-4 fw-semibold mb-0">Zusammenfassung</h6></th>
                        </tr>
                      </thead>
                      <tbody>
                        {propertyBenchmarkHistory.map((result) => (
                          <tr key={result.id}>
                            <td>{result.created_at || '-'}</td>
                            <td>
                              <span className={getStatusBadgeClass(result.comparison_data?.pricing_signal)}>
                                {formatStatusLabel(result.comparison_data?.pricing_signal)}
                              </span>
                            </td>
                            <td>{result.comparison_data?.benchmark_amount ?? '-'}</td>
                            <td>{result.comparison_data?.benchmark_source_count ?? 0}</td>
                            <td className="text-wrap">{result.summary}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-muted">Keine Benchmark-Historie verfügbar.</div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="px-4 py-3 border-bottom">
                <h5 className="card-title fw-semibold mb-0">Eigentumsdokumente</h5>
              </div>
              <div className="card-body p-4">
                {(property.documents ?? []).length > 0 ? (
                  <div className="table-responsive rounded-2 mb-0">
                    <table className="table border-none text-nowrap customize-table mb-0 align-middle">
                      <thead className="text-dark fs-4">
                        <tr>
                          <th><h6 className="fs-4 fw-semibold mb-0">Titel</h6></th>
                          <th><h6 className="fs-4 fw-semibold mb-0">Typ</h6></th>
                          <th><h6 className="fs-4 fw-semibold mb-0">Status</h6></th>
                          <th><h6 className="fs-4 fw-semibold mb-0">Geschätzter Betrag</h6></th>
                          <th><h6 className="fs-4 fw-semibold mb-0">KI-Ergebnisse</h6></th>
                        </tr>
                      </thead>
                      <tbody>
                        {property.documents.map((document) => (
                          <tr key={document.id}>
                            <td>{document.title}</td>
                            <td>{formatStatusLabel(document.type)}</td>
                            <td><span className={getStatusBadgeClass(document.status)}>{formatStatusLabel(document.status)}</span></td>
                            <td>{document.analysis_results?.[0]?.comparison_data?.estimated_amount ?? '-'}</td>
                            <td>{document.analysis_results?.length ?? 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-muted">Es sind noch keine Eigentumsdokumente verknüpft..</div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="px-4 py-3 border-bottom">
                <h5 className="card-title fw-semibold mb-0">Eigentumsbestellungen</h5>
              </div>
              <div className="card-body p-4">
                {(property.orders ?? []).length > 0 ? (
                  <div className="table-responsive rounded-2 mb-0">
                    <table className="table border-none text-nowrap customize-table mb-0 align-middle">
                      <thead className="text-dark fs-4">
                        <tr>
                          <th><h6 className="fs-4 fw-semibold mb-0">Auftrag</h6></th>
                          <th><h6 className="fs-4 fw-semibold mb-0">Objekt</h6></th>
                          <th><h6 className="fs-4 fw-semibold mb-0">Fälligkeitsdatum</h6></th>
                          <th><h6 className="fs-4 fw-semibold mb-0">Status</h6></th>
                          <th><h6 className="fs-4 fw-semibold mb-0">Aktion</h6></th>
                        </tr>
                      </thead>
                      <tbody>
                        {property.orders.map((order) => (
                          <tr key={order.id}>
                            <td>
                              <div className="fw-semibold">{order.title}</div>
                              <div className="text-muted">{getOptionLabel(JOB_TYPE_OPTIONS, order.service_type)}</div>
                            </td>
                            <td>{order.property_object?.name || '-'}</td>
                            <td>{order.due_date || '-'}</td>
                            <td><span className={getStatusBadgeClass(order.status)}>{formatStatusLabel(order.status)}</span></td>
                            <td>
                              <Link className="btn btn-light-primary btn-sm" to={`/orders/${order.id}`}>
                                Offene Bestellung
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-muted">Es sind noch keine Eigentumsbestellungen verknüpft..</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </PageContent>
  )
}

export default PropertyDetailsPage
