import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageContent from '../components/PageContent'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { getOptionLabel, JOB_TYPE_OPTIONS } from '../lib/vergoOptions'

const summaryCards = [
  {
    title: 'Gesamtimmobilien',
    key: 'properties',
    icon: 'ti ti-building-estate',
    color: 'primary',
  },
  {
    title: 'Aktive Aufträge',
    key: 'orders',
    icon: 'ti ti-file-invoice',
    color: 'secondary',
  },
  {
    title: 'Dokumentenverarbeitung',
    key: 'documents',
    icon: 'ti ti-file-analytics',
    color: 'warning',
  },
  {
    title: 'Anbieter',
    key: 'service_providers',
    icon: 'ti ti-users',
    color: 'success',
  },
]

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
const FINAL_ORDER_STATUSES = new Set(['completed', 'closed', 'cancelled', 'canceled', 'rejected', 'failed'])
const COMPLETED_ORDER_STATUSES = new Set(['completed', 'closed'])
const countFormatter = new Intl.NumberFormat('de-DE')

function normalizeStatus(status) {
  return String(status || '').trim().toLowerCase()
}

function isCompletedOrder(status) {
  return COMPLETED_ORDER_STATUSES.has(normalizeStatus(status))
}

function isActiveOrder(status) {
  const normalizedStatus = normalizeStatus(status)

  if (!normalizedStatus) {
    return false
  }

  return !FINAL_ORDER_STATUSES.has(normalizedStatus)
}

function getOrderPublishedAt(order) {
  return order?.requested_at ?? order?.created_at ?? order?.completed_at ?? null
}

function getSafeDate(value) {
  if (!value) {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function getMonthlyCounts(orders, year) {
  const counts = Array(12).fill(0)

  orders.forEach((order) => {
    const publishedAt = getSafeDate(getOrderPublishedAt(order))

    if (!publishedAt || publishedAt.getFullYear() !== year) {
      return
    }

    counts[publishedAt.getMonth()] += 1
  })

  return counts
}

function formatCount(value) {
  return countFormatter.format(value ?? 0)
}

function OrderTrendChart({ monthlyCounts }) {
  const width = 760
  const height = 300
  const padding = {
    top: 20,
    right: 20,
    bottom: 48,
    left: 20,
  }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const maxValue = Math.max(...monthlyCounts, 1)
  const stepX = monthlyCounts.length > 1 ? chartWidth / (monthlyCounts.length - 1) : chartWidth
  const points = monthlyCounts.map((value, index) => {
    const x = padding.left + (stepX * index)
    const y = padding.top + chartHeight - ((value / maxValue) * chartHeight)
    return { x, y, value }
  })
  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')
  const areaPath = [
    `M ${points[0]?.x ?? padding.left} ${padding.top + chartHeight}`,
    ...points.map((point) => `L ${point.x} ${point.y}`),
    `L ${points[points.length - 1]?.x ?? padding.left} ${padding.top + chartHeight}`,
    'Z',
  ].join(' ')
  const gridValues = Array.from({ length: 4 }, (_, index) => {
    const value = Math.round((maxValue / 3) * index)
    const y = padding.top + chartHeight - ((value / maxValue) * chartHeight)

    return { value, y }
  }).reverse()

  return (
    <div className="vergo-dashboard-chart-wrap">
      <svg
        className="vergo-dashboard-chart-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Monatliche Auftragsveröffentlichungen"
      >
        <defs>
          <linearGradient id="vergoDashboardArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#5d87ff" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#5d87ff" stopOpacity="0.03" />
          </linearGradient>
        </defs>

        {gridValues.map((gridLine) => (
          <g key={`grid-${gridLine.value}`}>
            <line
              x1={padding.left}
              y1={gridLine.y}
              x2={width - padding.right}
              y2={gridLine.y}
              stroke="#dfe7f2"
              strokeDasharray="6 8"
            />
            <text x={width - padding.right} y={gridLine.y - 6} textAnchor="end" fill="#8a97ab" fontSize="12">
              {gridLine.value}
            </text>
          </g>
        ))}

        <path d={areaPath} fill="url(#vergoDashboardArea)" />
        <path d={linePath} fill="none" stroke="#5d87ff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />

        {points.map((point, index) => (
          <g key={MONTH_LABELS[index]}>
            <circle cx={point.x} cy={point.y} r="6" fill="#ffffff" stroke="#5d87ff" strokeWidth="3" />
            <text x={point.x} y={height - 18} textAnchor="middle" fill="#5a6a85" fontSize="12">
              {MONTH_LABELS[index]}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}

function getOrderAddress(order) {
  return order?.property_object?.address || order?.property_object?.name || order?.property?.title || '-'
}

function getOrderPostalCode(order) {
  return order?.property_object?.postal_code || order?.property?.postal_code || '-'
}

function getOrderCity(order) {
  return order?.property_object?.city || order?.property?.city || '-'
}

function DashboardPage({ role }) {
  const { user } = useAuth()
  const isEmployee = role === 'employee'
  const isManager = role === 'manager'
  const [overview, setOverview] = useState({
    properties: 0,
    owners: 0,
    orders: 0,
    documents: 0,
    service_providers: 0,
  })
  const [orders, setOrders] = useState([])
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(true)
  const [analyticsError, setAnalyticsError] = useState('')
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()))

  useEffect(() => {
    if (isEmployee) {
      return undefined
    }

    let isMounted = true

    Promise.allSettled([
      api.getDashboardOverview(),
      api.getOrders(),
    ]).then(([overviewResult, ordersResult]) => {
      if (!isMounted) {
        return
      }

      if (overviewResult.status === 'fulfilled') {
        setOverview(overviewResult.value.data ?? {})
      }

      if (ordersResult.status === 'fulfilled') {
        setOrders(ordersResult.value.data ?? [])
      } else {
        setAnalyticsError(ordersResult.reason?.message ?? 'Die Auftragsanalyse konnte nicht geladen werden.')
      }

      setIsAnalyticsLoading(false)
    })

    return () => {
      isMounted = false
    }
  }, [isEmployee])

  const availableYears = useMemo(() => {
    const years = orders.reduce((result, order) => {
      const publishedAt = getSafeDate(getOrderPublishedAt(order))

      if (publishedAt) {
        result.add(publishedAt.getFullYear())
      }

      return result
    }, new Set())

    const sortedYears = Array.from(years).sort((firstYear, secondYear) => secondYear - firstYear)

    return sortedYears.length > 0 ? sortedYears : [new Date().getFullYear()]
  }, [orders])

  const orderMetrics = useMemo(() => ({
    active: orders.filter((order) => isActiveOrder(order.status)).length,
    completed: orders.filter((order) => isCompletedOrder(order.status)).length,
    total: orders.length,
  }), [orders])

  const selectedYearNumber = availableYears.includes(Number(selectedYear))
    ? Number(selectedYear)
    : availableYears[0]
  const monthlyCounts = useMemo(() => getMonthlyCounts(orders, selectedYearNumber), [orders, selectedYearNumber])
  const publishedThisYear = monthlyCounts.reduce((sum, value) => sum + value, 0)
  const busiestMonthCount = Math.max(...monthlyCounts, 0)
  const busiestMonthIndex = monthlyCounts.findIndex((value) => value === busiestMonthCount)
  const analyticsMetrics = [
    {
      key: 'active',
      label: 'Aktive Aufträge',
      helper: 'Alle aktuell laufenden Vorgänge',
      value: orderMetrics.active,
      icon: 'ti ti-loader-2',
      color: '#5d87ff',
      background: 'rgba(93, 135, 255, 0.13)',
    },
    {
      key: 'completed',
      label: 'Abgeschlossene Aufträge',
      helper: 'Fertig bearbeitete Vorgänge',
      value: orderMetrics.completed,
      icon: 'ti ti-circle-check',
      color: '#13deb9',
      background: 'rgba(19, 222, 185, 0.14)',
    },
    {
      key: 'total',
      label: 'Gesamtaufträge',
      helper: 'Alle erfassten Vorgänge',
      value: orderMetrics.total,
      icon: 'ti ti-file-analytics',
      color: '#ffae1f',
      background: 'rgba(255, 174, 31, 0.16)',
    },
  ]

  const activeOrders = useMemo(() => orders.filter((order) => isActiveOrder(order.status)), [orders])
  const activeOrderPreview = useMemo(() => activeOrders.slice(0, 3), [activeOrders])
  const remainingActiveOrders = Math.max(activeOrders.length - activeOrderPreview.length, 0)

  return (
    <PageContent
      title={isManager ? '' : 'Vergo Armaturenbrett'}
      subtitle={`Willkommen im Armaturenbrett als ${role}.`}
      variant="dashboard"
      breadcrumbs={isManager ? [] : ['Armaturenbrett']}
    >
      {isManager ? (
        <>
          <div className="card bg-light-info overflow-hidden mb-4">
              <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-4 py-3 px-5">
                <div>
                  <h2 className="mb-2">Guten Tag</h2>
                  <div className="text-muted">{user?.email || '(Mail Adresse)'}</div>
                </div>

                <div className="d-flex flex-wrap gap-2">
                  <Link to="/properties" className="btn vergo-manager-quick-link">
                    Liegenschaften
                  </Link>
                  <Link to="/orders" className="btn vergo-manager-quick-link">
                    Auftrag erfassen
                  </Link>
                </div>
              </div>
          </div>

          {analyticsError ? <div className="alert alert-danger py-2 mb-4">{analyticsError}</div> : null}

          {!analyticsError ? (
            <div className="card vergo-dashboard-analytics-card overflow-hidden">
              <div className="card-body p-4">
                <div className="row g-4 align-items-stretch">
                  <div className="col-xl-4">
                    <div className="vergo-dashboard-analytics-panel h-100">
                      <div className="mb-3">
                        <h5 className="fw-semibold mb-1">Auftragsübersicht</h5>
                        <p className="text-muted mb-0">Die wichtigsten Kennzahlen der aktuell sichtbaren Aufträge.</p>
                      </div>

                      {isAnalyticsLoading ? (
                        <p className="text-muted mb-0">Auftragsanalyse wird geladen...</p>
                      ) : (
                        <div className="d-grid gap-3">
                          {analyticsMetrics.map((metric) => (
                            <div className="vergo-dashboard-metric-card" key={metric.key}>
                              <span
                                className="vergo-dashboard-metric-icon"
                                style={{
                                  '--metric-color': metric.color,
                                  '--metric-background': metric.background,
                                }}
                              >
                                <i className={metric.icon}></i>
                              </span>

                              <div>
                                <div className="vergo-dashboard-metric-value">{formatCount(metric.value)}</div>
                                <div className="fw-semibold text-dark">{metric.label}</div>
                                <div className="text-muted small">{metric.helper}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="col-xl-8">
                    <div className="d-flex flex-column gap-4 h-100">
                      <div className="vergo-dashboard-analytics-panel">
                        <div className="d-flex align-items-center justify-content-between gap-3 mb-3">
                          <h5 className="fw-semibold mb-0">Aktive Aufträge</h5>
                          <span className="badge bg-light-primary text-primary px-3 py-2 rounded-pill">
                            {formatCount(activeOrders.length)} aktiv
                          </span>
                        </div>

                        {isAnalyticsLoading ? (
                          <div className="vergo-dashboard-chart-empty">
                            <div>
                              <div className="fw-semibold mb-1">Aktive Aufträge werden geladen</div>
                              <div>Die aktuellen Karten werden vorbereitet.</div>
                            </div>
                          </div>
                        ) : activeOrders.length > 0 ? (
                          <div className="row g-3">
                            {activeOrderPreview.map((order) => (
                              <div className="col-lg-4 col-sm-6" key={order.id}>
                                <Link to={`/orders/${order.id}`} className="vergo-manager-order-card">
                                  <div className="vergo-manager-order-card-label">Gewerk</div>
                                  <div className="vergo-manager-order-card-value">{getOptionLabel(JOB_TYPE_OPTIONS, order.service_type)}</div>
                                  <div className="vergo-manager-order-card-meta">
                                    <span>Adresse</span>
                                    <strong>{getOrderAddress(order)}</strong>
                                  </div>
                                  <div className="vergo-manager-order-card-grid">
                                    <div>
                                      <span>PLZ</span>
                                      <strong>{getOrderPostalCode(order)}</strong>
                                    </div>
                                    <div>
                                      <span>Ort</span>
                                      <strong>{getOrderCity(order)}</strong>
                                    </div>
                                  </div>
                                </Link>
                              </div>
                            ))}

                            {remainingActiveOrders > 0 ? (
                              <div className="col-lg-4 col-sm-6">
                                <div className="vergo-manager-order-card vergo-manager-order-card-more">
                                  <span>Weitere Aufträge</span>
                                  <strong>+{formatCount(remainingActiveOrders)}</strong>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="vergo-dashboard-chart-empty">
                            <div>
                              <div className="fw-semibold mb-1">Keine aktiven Aufträge</div>
                              <div>Zurzeit sind keine laufenden Aufträge für diese Liegenschaft vorhanden.</div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="vergo-dashboard-analytics-panel vergo-dashboard-chart-panel flex-grow-1">
                        <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-3">
                          <div>
                            <h5 className="fw-semibold mb-1">Monatliche Auftragsveröffentlichungen</h5>
                            <p className="text-muted mb-0">
                              Januar bis Dezember, basierend auf Anfragedatum oder Erstellungsdatum.
                            </p>
                          </div>

                          <div className="vergo-dashboard-year-filter">
                            <label className="form-label mb-1">Jahr</label>
                            <select
                              className="form-select"
                              value={String(selectedYearNumber)}
                              onChange={(event) => setSelectedYear(event.target.value)}
                            >
                              {availableYears.map((year) => (
                                <option key={year} value={year}>
                                  {year}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {isAnalyticsLoading ? (
                          <div className="vergo-dashboard-chart-empty">
                            <div>
                              <div className="fw-semibold mb-1">Diagramm wird geladen</div>
                              <div>Die monatliche Auftragsentwicklung wird vorbereitet.</div>
                            </div>
                          </div>
                        ) : publishedThisYear > 0 ? (
                          <>
                            <div className="vergo-dashboard-chart-summary">
                              <span>{formatCount(publishedThisYear)} veröffentlichte Aufträge in {selectedYearNumber}</span>
                              <span>
                                Stärkster Monat: {busiestMonthIndex >= 0 ? MONTH_LABELS[busiestMonthIndex] : '-'} ({formatCount(busiestMonthCount)})
                              </span>
                            </div>
                            <OrderTrendChart monthlyCounts={monthlyCounts} />
                          </>
                        ) : (
                          <div className="vergo-dashboard-chart-empty">
                            <div>
                              <div className="fw-semibold mb-1">Keine Aufträge in diesem Jahr</div>
                              <div>Für {selectedYearNumber} wurden noch keine Veröffentlichungen gefunden.</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {!isEmployee && !isManager ? (
        <>
          <div className="row">
            {summaryCards.map((card) => (
              <div className="col-xl-3 col-md-6" key={card.key}>
                <div className="card overflow-hidden">
                  <div className="card-body">
                    <div className="d-flex align-items-center">
                      <div className="flex-grow-1">
                        <p className="text-muted fw-medium">{card.title}</p>
                        <h3 className="mb-0 fw-semibold">{overview[card.key] ?? 0}</h3>
                      </div>
                      <div className="flex-shrink-0 ms-3">
                        <div className={`round-48 rounded-circle bg-light-${card.color} d-flex align-items-center justify-content-center`}>
                          <span className={`text-${card.color} d-flex align-items-center justify-content-center fs-8`}>
                            <i className={card.icon}></i>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="row">
            <div className="col-12">
              <div className="card vergo-dashboard-analytics-card overflow-hidden">
                <div className="card-body p-4">
                  <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
                    <div>
                      <h4 className="fw-semibold mb-2 mt-3">Auftragsstatus und monatliche Veröffentlichungen</h4>
                      <p className="text-muted mb-0">
                        Links sehen Sie die aktuellen Auftragszahlen, rechts die monatliche Entwicklung nach Jahr.
                      </p>
                    </div>

                    <div className="text-md-end">
                      <div className="text-muted small mb-1">Ausgewähltes Jahr</div>
                      <div className="fw-semibold fs-5">{selectedYearNumber}</div>
                    </div>
                  </div>

                  {analyticsError ? <div className="alert alert-danger py-2 mb-0">{analyticsError}</div> : null}

                  {!analyticsError ? (
                    <div className="row g-4 align-items-stretch">
                      <div className="col-xl-4">
                        <div className="vergo-dashboard-analytics-panel h-100">
                          <div className="mb-3">
                            <h5 className="fw-semibold mb-1">Auftragsübersicht</h5>
                            <p className="text-muted mb-0">Die wichtigsten Kennzahlen der aktuell sichtbaren Aufträge.</p>
                          </div>

                          {isAnalyticsLoading ? (
                            <p className="text-muted mb-0">Auftragsanalyse wird geladen...</p>
                          ) : (
                            <div className="d-grid gap-3">
                              {analyticsMetrics.map((metric) => (
                                <div className="vergo-dashboard-metric-card" key={metric.key}>
                                  <span
                                    className="vergo-dashboard-metric-icon"
                                    style={{
                                      '--metric-color': metric.color,
                                      '--metric-background': metric.background,
                                    }}
                                  >
                                    <i className={metric.icon}></i>
                                  </span>

                                  <div>
                                    <div className="vergo-dashboard-metric-value">{formatCount(metric.value)}</div>
                                    <div className="fw-semibold text-dark">{metric.label}</div>
                                    <div className="text-muted small">{metric.helper}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="col-xl-8">
                        <div className="vergo-dashboard-analytics-panel vergo-dashboard-chart-panel h-100">
                          <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-3">
                            <div>
                              <h5 className="fw-semibold mb-1">Monatliche Auftragsveröffentlichungen</h5>
                              <p className="text-muted mb-0">
                                Januar bis Dezember, basierend auf Anfragedatum oder Erstellungsdatum.
                              </p>
                            </div>

                            <div className="vergo-dashboard-year-filter">
                              <label className="form-label mb-1">Jahr</label>
                              <select
                                className="form-select"
                                value={String(selectedYearNumber)}
                                onChange={(event) => setSelectedYear(event.target.value)}
                              >
                                {availableYears.map((year) => (
                                  <option key={year} value={year}>
                                    {year}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {isAnalyticsLoading ? (
                            <div className="vergo-dashboard-chart-empty">
                              <div>
                                <div className="fw-semibold mb-1">Diagramm wird geladen</div>
                                <div>Die monatliche Auftragsentwicklung wird vorbereitet.</div>
                              </div>
                            </div>
                          ) : publishedThisYear > 0 ? (
                            <>
                              <div className="vergo-dashboard-chart-summary">
                                <span>{formatCount(publishedThisYear)} veröffentlichte Aufträge in {selectedYearNumber}</span>
                                <span>
                                  Stärkster Monat: {busiestMonthIndex >= 0 ? MONTH_LABELS[busiestMonthIndex] : '-'} ({formatCount(busiestMonthCount)})
                                </span>
                              </div>
                              <OrderTrendChart monthlyCounts={monthlyCounts} />
                            </>
                          ) : (
                            <div className="vergo-dashboard-chart-empty">
                              <div>
                                <div className="fw-semibold mb-1">Keine Aufträge in diesem Jahr</div>
                                <div>Für {selectedYearNumber} wurden noch keine Veröffentlichungen gefunden.</div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </PageContent>
  )
}

export default DashboardPage
