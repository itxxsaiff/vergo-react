import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageContent from '../components/PageContent'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { api } from '../lib/api'
import { getOptionLabel, JOB_TYPE_OPTIONS } from '../lib/vergoOptions'
import { formatDateDisplay } from '../lib/dateFormat'

const MANAGER_HERO_IMAGE = '/assets/images/ui-images/manager-dashboard.jpg'
const PRIVACY_URL = 'https://www.vergo.ch/privacy-policy'
const IMPRINT_URL = 'https://www.vergo.ch/legal-notice'
// Orders sitting with the manager: offers or quotes are in, and somebody
// has to decide before the job can move on.
const REVIEW_ORDER_STATUSES = new Set([
  'submitted', 'shortlisted', 'awaiting_owner_approval', 'inspection_quote_created',
  'in_review', 'review', 'pending', 'awarded_pending_acceptance',
])

const summaryCards = [
  {
    title: 'Anzahl Liegenschaften',
    key: 'properties',
    icon: 'ti ti-building-estate',
    color: 'primary',
    helper: 'Gesamtzahl der Liegenschaften',
  },
  {
    title: 'Eigentümer',
    key: 'owners',
    icon: 'ti ti-building-community',
    color: 'secondary',
    helper: 'Gesamtzahl der Eigentümer',
  },
  {
    title: 'Dienstleister',
    key: 'service_providers',
    icon: 'ti ti-users',
    color: 'success',
    helper: 'Gesamtzahl der Dienstleister',
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

function isReviewOrder(status) {
  return REVIEW_ORDER_STATUSES.has(normalizeStatus(status))
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

function OrderTrendChart({ monthlyCounts, monthLabels = MONTH_LABELS, ariaLabel = 'Monatliche Auftragsveröffentlichungen' }) {
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
        aria-label={ariaLabel}
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
          <g key={monthLabels[index]}>
            <circle cx={point.x} cy={point.y} r="6" fill="#ffffff" stroke="#5d87ff" strokeWidth="3" />
            <text x={point.x} y={height - 18} textAnchor="middle" fill="#5a6a85" fontSize="12">
              {monthLabels[index]}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}

/**
 * The manager's monthly chart: a bar per month with a dashed trend line laid
 * over it, as in the design.
 */
function OrderBarChart({ monthlyCounts, monthLabels, ariaLabel }) {
  const width = 720
  const height = 260
  const padding = { top: 18, right: 12, bottom: 34, left: 34 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const rawMax = Math.max(...monthlyCounts, 1)
  // Round the top of the scale up so the gridline labels stay whole numbers.
  const maxValue = Math.max(2, Math.ceil(rawMax / 2) * 2)
  const slotWidth = chartWidth / monthlyCounts.length
  const barWidth = Math.min(26, slotWidth * 0.42)
  const yFor = (value) => padding.top + chartHeight - ((value / maxValue) * chartHeight)
  const gridValues = Array.from({ length: (maxValue / 2) + 1 }, (_, index) => index * 2)
  const points = monthlyCounts.map((value, index) => ({
    x: padding.left + (slotWidth * index) + (slotWidth / 2),
    y: yFor(value),
    value,
  }))
  const trendPath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')

  return (
    <svg
      className="vergo-md-chart-svg"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="none"
    >
      {gridValues.map((value) => (
        <g key={value}>
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={yFor(value)}
            y2={yFor(value)}
            className="vergo-md-chart-grid"
          />
          <text x={padding.left - 10} y={yFor(value) + 4} className="vergo-md-chart-axis" textAnchor="end">
            {value}
          </text>
        </g>
      ))}

      {points.map((point, index) => (
        point.value > 0 ? (
          <rect
            key={`bar-${index}`}
            className="vergo-md-chart-bar"
            x={point.x - (barWidth / 2)}
            y={point.y}
            width={barWidth}
            height={Math.max(padding.top + chartHeight - point.y, 0)}
            rx="4"
          />
        ) : null
      ))}

      <path d={trendPath} className="vergo-md-chart-trend" />

      {points.map((point, index) => (
        <circle key={`dot-${index}`} cx={point.x} cy={point.y} r="4" className="vergo-md-chart-dot" />
      ))}

      {monthLabels.map((label, index) => (
        <text
          key={label}
          x={padding.left + (slotWidth * index) + (slotWidth / 2)}
          y={height - 12}
          className="vergo-md-chart-axis"
          textAnchor="middle"
        >
          {label}
        </text>
      ))}
    </svg>
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

function isInspectionOrder(order) {
  return order?.workflow_type === 'inspection'
    || order?.workflow_meta?.flow_type === 'inspection'
    || (order?.workflow_meta?.inspection?.preferred_slots ?? []).length > 0
    || ['inspection_requested', 'public_inspection_open', 'inspection_signup_closed', 'inspection_company_selected'].includes(order?.workflow_status)
}

function getOrderFlowTypeLabel(order) {
  return isInspectionOrder(order) ? 'Besichtigung' : 'Auftrag'
}

function DashboardPage({ role }) {
  const { user } = useAuth()
  const { t } = useLanguage()
  const isManager = role === 'manager'
  const isInternalDashboard = !isManager
  // An owner has no business seeing how many owners or service providers exist
  // in the system - only how many properties are theirs.
  const isOwner = user?.role === 'owner'
  const visibleSummaryCards = isOwner
    ? summaryCards.filter((card) => card.key === 'properties')
    : summaryCards
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
    let isMounted = true

    Promise.allSettled([
      isInternalDashboard ? api.getDashboardOverview() : Promise.resolve({ data: {} }),
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
        setAnalyticsError(ordersResult.reason?.message ?? t('Die Auftragsanalyse konnte nicht geladen werden.'))
      }

      setIsAnalyticsLoading(false)
    })

    return () => {
      isMounted = false
    }
  }, [isInternalDashboard, t])

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
    review: orders.filter((order) => isReviewOrder(order.status)).length,
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

  // The four cards along the top of the manager dashboard.
  const managerKpis = [
    {
      key: 'active',
      label: 'Aktive Aufträge',
      helper: 'Alle aktuell laufenden Vorgänge',
      value: orderMetrics.active,
      href: '/orders',
      icon: 'ti ti-file-description',
      color: '#2563eb',
      background: '#e8f0fe',
    },
    {
      key: 'review',
      label: 'Zu prüfen',
      helper: 'Noch zu prüfen',
      value: orderMetrics.review,
      href: '/orders',
      icon: 'ti ti-clock',
      color: '#f59e0b',
      background: '#fef3c7',
    },
    {
      key: 'completed',
      label: 'Abgeschlossene Aufträge',
      helper: 'Fertig bearbeitete Vorgänge',
      value: orderMetrics.completed,
      href: '/orders',
      icon: 'ti ti-circle-check',
      color: '#10b981',
      background: '#d1fae5',
    },
    {
      key: 'total',
      label: 'Gesamtaufträge',
      helper: 'Alle erfassten Vorgänge',
      value: orderMetrics.total,
      href: '/orders',
      icon: 'ti ti-file-analytics',
      color: '#2563eb',
      background: '#e8f0fe',
    },
  ]

  const activeOrders = useMemo(() => orders.filter((order) => isActiveOrder(order.status)), [orders])
  const activeOrderPreview = useMemo(() => activeOrders.slice(0, 3), [activeOrders])
  const translatedMonthLabels = MONTH_LABELS.map((month) => t(month))

  return (
    <PageContent
      title={isManager ? '' : t('Vergo Dashboard')}
      subtitle={isOwner || isManager ? '' : `${t('Willkommen im Dashboard als')} ${t(role)}.`}
      variant="dashboard"
    >
      {isManager ? (
        <div className="vergo-md">
          <div className="vergo-md-greeting">
            <span className="vergo-md-eyebrow">{t('Dashboard')}</span>
            <h1>{t('Guten Tag')}</h1>
            <p>{user?.email || t('(Mail Adresse)')}</p>
          </div>

          <div className="vergo-md-kpis">
            {managerKpis.map((kpi) => (
              <Link key={kpi.key} to={kpi.href} className="vergo-md-kpi">
                <span
                  className="vergo-md-kpi-icon"
                  style={{ '--kpi-color': kpi.color, '--kpi-background': kpi.background }}
                >
                  <i className={kpi.icon}></i>
                </span>
                <span className="vergo-md-kpi-text">
                  <span className="vergo-md-kpi-label">{t(kpi.label)}</span>
                  <span className="vergo-md-kpi-value">{formatCount(kpi.value)}</span>
                  <span className="vergo-md-kpi-helper">{t(kpi.helper)}</span>
                </span>
                <i className="ti ti-chevron-right vergo-md-kpi-arrow"></i>
              </Link>
            ))}
          </div>

          {analyticsError ? <div className="alert alert-danger py-2 mb-4">{analyticsError}</div> : null}

          <div className="vergo-md-split">
            <div className="vergo-md-hero" style={{ backgroundImage: `url("${MANAGER_HERO_IMAGE}")` }}>
              <div className="vergo-md-hero-body">
                <h2>{t('Effizient. Digital. Verlässlich.')}</h2>
                <Link to="/order-create" className="vergo-md-hero-cta">
                  <span>{t('Auftrag erfassen')}</span>
                  <i className="ti ti-arrow-right"></i>
                </Link>
              </div>
            </div>

            <div className="vergo-md-panel vergo-md-chart">
              <div className="vergo-md-chart-head">
                <div>
                  <h3>{t('Monatliche Auftragsveröffentlichungen')}</h3>
                  <p>{t('Januar bis Dezember, basierend auf Auftragsdatum oder Erstellungsdatum.')}</p>
                </div>

                <div className="vergo-md-year">
                  <label htmlFor="vergo-md-year">{t('Jahr')}</label>
                  <select
                    id="vergo-md-year"
                    className="form-select"
                    value={String(selectedYearNumber)}
                    onChange={(event) => setSelectedYear(event.target.value)}
                  >
                    {availableYears.map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              </div>

              {isAnalyticsLoading ? (
                <div className="vergo-md-empty">{t('Diagramm wird geladen')}</div>
              ) : (
                <OrderBarChart
                  monthlyCounts={monthlyCounts}
                  monthLabels={translatedMonthLabels}
                  ariaLabel={t('Monatliche Auftragsveröffentlichungen')}
                />
              )}

              <div className="vergo-md-chart-legend">
                <span className="vergo-md-legend-item">
                  <span className="vergo-md-legend-bar" aria-hidden="true"></span>
                  {t('Veröffentlichte Aufträge')}
                </span>
                <span className="vergo-md-legend-item">
                  <span className="vergo-md-legend-trend" aria-hidden="true"></span>
                  {t('Trend')}
                </span>
                <span className="vergo-md-legend-count">
                  {formatCount(publishedThisYear)} {t('veröffentlichte Aufträge in')} {selectedYearNumber}
                </span>
              </div>
            </div>
          </div>

          <div className="vergo-md-panel vergo-md-active">
            <div className="vergo-md-active-head">
              <h3>{t('Aktive Aufträge')}</h3>
              <Link to="/orders" className="vergo-md-active-link">
                <span>{formatCount(activeOrders.length)} {t('aktiv')}</span>
                <i className="ti ti-chevron-right"></i>
              </Link>
            </div>

            {isAnalyticsLoading ? (
              <div className="vergo-md-empty">{t('Aktive Aufträge werden geladen')}</div>
            ) : activeOrders.length > 0 ? (
              <div className="vergo-md-rows">
                {activeOrderPreview.map((order) => (
                  <Link key={order.id} to={`/orders/${order.id}`} className="vergo-md-row">
                    <span className="vergo-md-row-icon">
                      <i className="ti ti-building-estate"></i>
                    </span>

                    <span className="vergo-md-row-main">
                      <strong>{order.title || t(getOrderFlowTypeLabel(order))}</strong>
                      <span className="vergo-md-row-address">
                        <i className="ti ti-map-pin"></i>
                        {getOrderAddress(order)}, {getOrderPostalCode(order)} {getOrderCity(order)}
                      </span>
                    </span>

                    <span className="vergo-md-row-field">
                      <span>{t('Gewerk')}</span>
                      <strong>{getOptionLabel(JOB_TYPE_OPTIONS, order.service_type)}</strong>
                    </span>

                    <span className="vergo-md-row-field">
                      <span>{t('PLZ / Ort')}</span>
                      <strong>{getOrderPostalCode(order)} {getOrderCity(order)}</strong>
                    </span>

                    <span className="vergo-md-row-field">
                      <span>{t('Erstellt am')}</span>
                      <strong>{formatDateDisplay(getOrderPublishedAt(order)) || '-'}</strong>
                    </span>

                    <span className={`vergo-md-row-status${isReviewOrder(order.status) ? ' is-review' : ''}`}>
                      {isReviewOrder(order.status) ? t('Zu prüfen') : t('Aktiv')}
                    </span>

                    <i className="ti ti-chevron-right vergo-md-row-arrow"></i>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="vergo-md-empty">
                {t('Zurzeit sind keine laufenden Aufträge für diese Liegenschaft vorhanden.')}
              </div>
            )}
          </div>

          <div className="vergo-md-footer">
            <span className="vergo-md-footer-links">
              <a href={PRIVACY_URL} target="_blank" rel="noreferrer">{t('Datenschutz')}</a>
              <span aria-hidden="true">|</span>
              <a href={IMPRINT_URL} target="_blank" rel="noreferrer">{t('Impressum')}</a>
            </span>
            <span>{t('Digitale Immobilienprozesse. Einfach. Effizient. Verlässlich.')}</span>
          </div>
        </div>
      ) : null}

      {isInternalDashboard ? (
        <>
          <div className="row">
            {visibleSummaryCards.map((card) => (
              <div className={isOwner ? 'col-xl-4 col-md-6' : 'col-xl-4 col-md-6'} key={card.key}>
                <div className="card overflow-hidden">
                  <div className="card-body">
                    <div className="d-flex align-items-center">
                      <div className="flex-grow-1">
                        <p className="text-muted fw-medium">{t(card.title)}</p>
                        <h3 className="mb-0 fw-semibold">{overview[card.key] ?? 0}</h3>
                        <div className="text-muted small mt-1">{t(card.helper)}</div>
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
                      <h4 className="fw-semibold mb-2 mt-3">{t('Auftragsstatus und monatliche Veröffentlichungen')}</h4>
                      <p className="text-muted mb-0">
                        {t('Links sehen Sie die aktuellen Auftragszahlen, rechts die monatliche Entwicklung nach Jahr.')}
                      </p>
                    </div>

                    <div className="text-md-end">
                      <div className="text-muted small mb-1">{t('Ausgewähltes Jahr')}</div>
                      <div className="fw-semibold fs-5">{selectedYearNumber}</div>
                    </div>
                  </div>

                  {analyticsError ? <div className="alert alert-danger py-2 mb-0">{analyticsError}</div> : null}

                  {!analyticsError ? (
                    <div className="row g-4 align-items-stretch">
                      <div className="col-xl-4">
                        <div className="vergo-dashboard-analytics-panel h-100">
                          <div className="mb-3">
                            <h5 className="fw-semibold mb-1">{t('Auftragsübersicht')}</h5>
                          </div>

                          {isAnalyticsLoading ? (
                            <p className="text-muted mb-0">{t('Auftragsanalyse wird geladen...')}</p>
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
                                    <div className="fw-semibold text-dark">{t(metric.label)}</div>
                                    <div className="text-muted small">{t(metric.helper)}</div>
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
                              <h5 className="fw-semibold mb-1">{t('Monatliche Auftragsveröffentlichungen')}</h5>
                              <p className="text-muted mb-0">
                                {t('Januar bis Dezember, basierend auf Anfragedatum oder Erstellungsdatum.')}
                              </p>
                            </div>

                            <div className="vergo-dashboard-year-filter">
                              <label className="form-label mb-1">{t('Jahr')}</label>
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
                                <div className="fw-semibold mb-1">{t('Diagramm wird geladen')}</div>
                                <div>{t('Die monatliche Auftragsentwicklung wird vorbereitet.')}</div>
                              </div>
                            </div>
                          ) : publishedThisYear > 0 ? (
                            <>
                              <div className="vergo-dashboard-chart-summary">
                                <span>{t(`${formatCount(publishedThisYear)} veröffentlichte Aufträge in ${selectedYearNumber}`)}</span>
                                <span>
                                  {t('Stärkster Monat')}: {busiestMonthIndex >= 0 ? translatedMonthLabels[busiestMonthIndex] : '-'} ({formatCount(busiestMonthCount)})
                                </span>
                              </div>
                              <OrderTrendChart monthlyCounts={monthlyCounts} monthLabels={translatedMonthLabels} ariaLabel={t('Monatliche Auftragsveröffentlichungen')} />
                            </>
                          ) : (
                            <div className="vergo-dashboard-chart-empty">
                              <div>
                                <div className="fw-semibold mb-1">{t('Keine Aufträge in diesem Jahr')}</div>
                                <div>{t(`Für ${selectedYearNumber} wurden noch keine Veröffentlichungen gefunden.`)}</div>
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
