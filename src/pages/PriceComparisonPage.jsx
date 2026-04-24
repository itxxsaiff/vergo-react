import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageContent from '../components/PageContent'
import { api } from '../lib/api'
import { formatStatusLabel, getStatusBadgeClass } from '../lib/tableStatus'
import { getOptionLabel, JOB_TYPE_OPTIONS } from '../lib/vergoOptions'

function getLatestBidComparison(results) {
  return [...(results ?? [])]
    .filter((result) => result?.comparison_data?.analysis_type === 'bid_comparison')
    .sort((firstResult, secondResult) => new Date(secondResult?.created_at ?? 0) - new Date(firstResult?.created_at ?? 0))[0] ?? null
}

function PriceComparisonPage() {
  const [orders, setOrders] = useState([])
  const [selectedOrderId, setSelectedOrderId] = useState(null)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [filters, setFilters] = useState({ search: '', status: '' })
  const [isLoadingOrders, setIsLoadingOrders] = useState(true)
  const [isLoadingOrder, setIsLoadingOrder] = useState(false)
  const [isComparing, setIsComparing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadOrders()
  }, [])

  useEffect(() => {
    if (selectedOrderId) {
      loadOrder(selectedOrderId)
    } else {
      setSelectedOrder(null)
    }
  }, [selectedOrderId])

  async function loadOrders() {
    setIsLoadingOrders(true)
    setError('')

    try {
      const response = await api.getOrders()
      const nextOrders = response.data ?? []
      setOrders(nextOrders)

      if (!selectedOrderId && nextOrders.length > 0) {
        setSelectedOrderId(nextOrders[0].id)
      }
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setIsLoadingOrders(false)
    }
  }

  async function loadOrder(orderId) {
    setIsLoadingOrder(true)
    setError('')

    try {
      const response = await api.getOrder(orderId)
      setSelectedOrder(response.data ?? null)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setIsLoadingOrder(false)
    }
  }

  async function handleCompare(orderId) {
    setIsComparing(true)
    setError('')

    try {
      await api.compareOrderBids(orderId)
      await Promise.all([loadOrders(), loadOrder(orderId)])
    } catch (compareError) {
      setError(compareError.message)
    } finally {
      setIsComparing(false)
    }
  }

  function handleFilterChange(event) {
    const { name, value } = event.target
    setFilters((current) => ({ ...current, [name]: value }))
  }

  const filteredOrders = useMemo(() => orders.filter((order) => {
    const searchValue = [
      order.title,
      getOptionLabel(JOB_TYPE_OPTIONS, order.service_type),
      order.property?.li_number,
      order.property?.title,
      order.property_object?.name,
    ].filter(Boolean).join(' ').toLowerCase()

    const searchMatch = !filters.search || searchValue.includes(filters.search.toLowerCase())
    const statusMatch = !filters.status || String(order.status || '').toLowerCase() === filters.status.toLowerCase()

    return searchMatch && statusMatch
  }), [filters.search, filters.status, orders])

  const comparison = getLatestBidComparison(selectedOrder?.analysis_results)
  const rankings = comparison?.comparison_data?.rankings ?? []
  const bidScoreMap = Object.fromEntries(rankings.map((item) => [item.bid_id, item]))
  const rankedBids = [...(selectedOrder?.bids ?? [])].sort((firstBid, secondBid) => {
    const firstScore = Number(bidScoreMap[firstBid.id]?.final_score ?? -1)
    const secondScore = Number(bidScoreMap[secondBid.id]?.final_score ?? -1)
    return secondScore - firstScore
  })

  return (
    <PageContent
      title="Preisvergleich"
      subtitle="Vergleichen Sie Angebote für Aufträge an einem Ort und überprüfen Sie die aktuelle Empfehlung, bevor Sie eine endgültige Entscheidung treffen."
      breadcrumbs={[
        { label: 'Armaturenbrett', href: '/dashboard' },
        { label: 'Preisvergleich' },
      ]}
    >
      {error ? <div className="alert alert-danger py-2">{error}</div> : null}

      <div className="row">
        <div className="col-xl-4">
          <div className="card">
            <div className="px-4 py-3 border-bottom">
              <h5 className="card-title fw-semibold mb-0">Bestellungen zum Vergleich bereit</h5>
            </div>
            <div className="card-body p-4">
              <div className="row g-3 mb-4">
                <div className="col-md-8">
                  <label className="form-label">Suchen</label>
                  <input
                    className="form-control"
                    name="search"
                    value={filters.search}
                    onChange={handleFilterChange}
                    placeholder="Suche nach Titel, Immobilie oder Objekt"
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Status</label>
                  <select className="form-select" name="status" value={filters.status} onChange={handleFilterChange}>
                    <option value="">All Status</option>
                    <option value="open">Offen</option>
                    <option value="in_review">In Prüfung</option>
                    <option value="awaiting_owner_approval">Warten auf Eigentümerfreigabe</option>
                    <option value="approved">Genehmigt</option>
                    <option value="completed">Abgeschlossen</option>
                    <option value="closed">Geschlossen</option>
                  </select>
                </div>
              </div>

              {isLoadingOrders ? <div className="text-muted">Ladeaufträge...</div> : null}

              {!isLoadingOrders ? (
                <div className="list-group list-group-flush">
                  {filteredOrders.map((order) => (
                    <button
                      key={order.id}
                      type="button"
                      className={`list-group-item list-group-item-action border rounded mb-2 text-start${selectedOrderId === order.id ? ' active' : ''}`}
                      onClick={() => setSelectedOrderId(order.id)}
                    >
                      <div className="d-flex align-items-center justify-content-between gap-3 mb-1">
                        <span className="fw-semibold">{order.title}</span>
                        <span className={getStatusBadgeClass(order.status)}>{formatStatusLabel(order.status)}</span>
                      </div>
                      <div className="small opacity-75">{order.property?.li_number ?? '-'} - {order.property?.title ?? '-'}</div>
                      <div className="small opacity-75">{getOptionLabel(JOB_TYPE_OPTIONS, order.service_type)} • {order.bids_count ?? 0} bids</div>
                    </button>
                  ))}
                  {filteredOrders.length === 0 ? <div className="text-muted">Keine Aufträge für den Vergleich gefunden.</div> : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="col-xl-8">
          <div className="card">
            <div className="px-4 py-3 border-bottom d-flex align-items-center justify-content-between gap-3">
              <h5 className="card-title fw-semibold mb-0">
                {selectedOrder ? selectedOrder.title : 'Vergleichsdetails'}
              </h5>
              {selectedOrder ? (
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleCompare(selectedOrder.id)}
                    disabled={isComparing}
                  >
                    {isComparing ? 'Vergleiche...' : 'Vergleich ausführen'}
                  </button>
                  <Link className="btn btn-light-primary" to={`/orders/${selectedOrder.id}`}>
                    Auftrag öffnen
                  </Link>
                </div>
              ) : null}
            </div>
            <div className="card-body p-4">
              {isLoadingOrder ? <div className="text-muted">Lade Vergleichsdetails...</div> : null}

              {!isLoadingOrder && !selectedOrder ? (
                <div className="text-muted">Wählen Sie links eine Bestellung aus, um deren Gebote einzusehen..</div>
              ) : null}

              {!isLoadingOrder && selectedOrder ? (
                <>
                  <div className="row g-3 mb-4">
                    <div className="col-md-6">
                      <div className="border rounded p-3 h-100">
                        <div className="text-muted fs-2 mb-1">Eigentum</div>
                        <div className="fw-semibold">{selectedOrder.property?.li_number ?? '-'} - {selectedOrder.property?.title ?? '-'}</div>
                        <div className="text-muted">{selectedOrder.property_object?.name || 'No object linked'}</div>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="border rounded p-3 h-100">
                        <div className="text-muted fs-2 mb-1">Status</div>
                        <span className={getStatusBadgeClass(selectedOrder.status)}>{formatStatusLabel(selectedOrder.status)}</span>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="border rounded p-3 h-100">
                        <div className="text-muted fs-2 mb-1">Gebote</div>
                        <div className="fw-semibold">{selectedOrder.bids?.length ?? 0}</div>
                      </div>
                    </div>
                  </div>

                  {comparison ? (
                    <>
                      <div className="alert alert-light-primary border mb-4">
                        <div className="fw-semibold mb-1">Vergleichsübersicht</div>
                        <div>{comparison.summary}</div>
                      </div>

                      <div className="row g-3 mb-4">
                        <div className="col-md-3">
                          <div className="border rounded p-3 h-100">
                            <div className="text-muted fs-2">Durchschnitt</div>
                            <div className="fw-semibold">{comparison.comparison_data?.average_amount ?? '-'} EUR</div>
                          </div>
                        </div>
                        <div className="col-md-3">
                          <div className="border rounded p-3 h-100">
                            <div className="text-muted fs-2">Niedrigster</div>
                            <div className="fw-semibold">{comparison.comparison_data?.lowest_amount ?? '-'}</div>
                          </div>
                        </div>
                        <div className="col-md-3">
                          <div className="border rounded p-3 h-100">
                            <div className="text-muted fs-2">Höchster</div>
                            <div className="fw-semibold">{comparison.comparison_data?.highest_amount ?? '-'}</div>
                          </div>
                        </div>
                        <div className="col-md-3">
                          <div className="border rounded p-3 h-100">
                            <div className="text-muted fs-2">Spread</div>
                            <div className="fw-semibold">{comparison.comparison_data?.spread_percentage ?? '-'}%</div>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="alert alert-light-warning border mb-4">
                      Für diese Bestellung wurde noch kein Vergleich erstellt. <strong>Laufvergleich</strong> um das erste Ergebnis zu erzeugen.
                    </div>
                  )}

                  <div className="table-responsive rounded-2 mb-0">
                    <table className="table border text-nowrap customize-table mb-0 align-middle">
                      <thead className="text-dark fs-4">
                        <tr>
                          <th><h6 className="fs-4 fw-semibold mb-0">Anbieter</h6></th>
                          <th><h6 className="fs-4 fw-semibold mb-0">Betrag</h6></th>
                          <th><h6 className="fs-4 fw-semibold mb-0">Zeitraum</h6></th>
                          <th><h6 className="fs-4 fw-semibold mb-0">Status</h6></th>
                          <th><h6 className="fs-4 fw-semibold mb-0">Punkte</h6></th>
                        </tr>
                      </thead>
                      <tbody>
                        {rankedBids.map((bid, index) => (
                          <tr key={bid.id}>
                            <td>
                              <div className="fw-semibold">{bid.service_provider?.company_name ?? '-'}</div>
                              <div className="text-muted">
                                {bid.service_provider?.contact_email ?? '-'}
                                {bidScoreMap[bid.id] ? ` • Rang #${index + 1}` : ''}
                              </div>
                            </td>
                            <td>{bid.amount} {bid.currency}</td>
                            <td>
                              <div>{bid.estimated_start_date || '-'}</div>
                              <div className="text-muted">{bid.estimated_completion_date || '-'}</div>
                            </td>
                            <td><span className={getStatusBadgeClass(bid.status)}>{formatStatusLabel(bid.status)}</span></td>
                            <td>{bidScoreMap[bid.id]?.final_score ?? '-'}</td>
                          </tr>
                        ))}
                        {rankedBids.length === 0 ? (
                          <tr>
                            <td colSpan="5" className="text-center text-muted py-4">Keine Gebote verfügbar für diese Bestellung.</td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </PageContent>
  )
}

export default PriceComparisonPage
