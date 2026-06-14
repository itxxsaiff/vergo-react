import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageContent from '../components/PageContent'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { api } from '../lib/api'
import { formatStatusLabel, getStatusBadgeClass } from '../lib/tableStatus'
import { getOptionLabel, JOB_TYPE_OPTIONS } from '../lib/vergoOptions'

const ACTIVE_BID_STATUSES = new Set([
  'working',
  'inspection_requested',
  'inspection_interest',
  'inspection_confirmed',
  'awarded_pending_acceptance',
  'approved',
  'accepted',
])

function getOrderFromBid(bid) {
  return bid.order ?? {}
}

function getOrderLocation(order) {
  return [order.property?.postal_code, order.property?.city].filter(Boolean).join(' ') || '-'
}

function ProviderOrderCard({ title, order, bid, actionLabel }) {
  const { t } = useLanguage()

  return (
    <div className="border rounded-3 p-3 h-100 bg-white">
      <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
        <div>
          <div className="text-muted small mb-1">{title}</div>
          <h5 className="fw-semibold mb-1">{order.title || '-'}</h5>
          <div className="text-muted small">
            {order.property?.li_number || '-'} {order.property?.title || ''}
          </div>
        </div>
        {bid ? (
          <span className={getStatusBadgeClass(bid.status)}>
            {formatStatusLabel(bid.status)}
          </span>
        ) : null}
      </div>

      <div className="d-grid gap-2 small text-muted mb-3">
        <div><span className="fw-semibold text-dark">{t('Gewerk')}:</span> {getOptionLabel(JOB_TYPE_OPTIONS, order.service_type) || '-'}</div>
        <div><span className="fw-semibold text-dark">{t('Ort')}:</span> {getOrderLocation(order)}</div>
        {bid?.assigned_provider_email ? (
          <div><span className="fw-semibold text-dark">{t('Bearbeiter')}:</span> {bid.assigned_provider_email}</div>
        ) : null}
      </div>

      <Link className="btn btn-primary btn-sm" to={`/available-jobs?order_id=${order.id}`}>
        {actionLabel}
      </Link>
    </div>
  )
}

function ProviderDashboardPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [orders, setOrders] = useState([])
  const [bids, setBids] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const providerLoginEmail = String(user?.provider_login_email || user?.email || '').toLowerCase()

  useEffect(() => {
    let isMounted = true

    async function loadDashboard() {
      setIsLoading(true)
      setError('')

      try {
        const [ordersResponse, bidsResponse] = await Promise.all([
          api.getOrders(),
          api.getBids(),
        ])

        if (!isMounted) return

        setOrders(ordersResponse.data ?? [])
        setBids(bidsResponse.data ?? [])
      } catch (loadError) {
        if (isMounted) {
          setError(t(loadError.message))
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadDashboard()

    return () => {
      isMounted = false
    }
  }, [t])

  const bidByOrderId = useMemo(() => bids.reduce((map, bid) => {
    map[bid.order_id] = bid
    return map
  }, {}), [bids])

  const myActiveBids = useMemo(() => bids.filter((bid) => (
    String(bid.assigned_provider_email || '').toLowerCase() === providerLoginEmail
    && ACTIVE_BID_STATUSES.has(String(bid.status || '').toLowerCase())
  )), [bids, providerLoginEmail])

  const directAssignedBids = useMemo(() => bids.filter((bid) => (
    bid.workflow_meta?.source === 'manager_direct_selection'
    || ['inspection_requested', 'awarded_pending_acceptance'].includes(String(bid.status || '').toLowerCase())
  )), [bids])

  const publicOrders = useMemo(() => orders.filter((order) => (
    ['public_inspection_open', 'inspection_signup_closed', 'published_for_quotes'].includes(order.workflow_status)
    && bidByOrderId[order.id]?.workflow_meta?.source !== 'manager_direct_selection'
  )), [orders, bidByOrderId])

  return (
    <PageContent
      title={t('Dienstleister Dashboard')}
      subtitle={t('Ihre direkt zugewiesenen und öffentlichen Aufträge im Überblick.')}
      breadcrumbs={[
        { label: t('Dashboard') },
      ]}
    >
      {error ? <div className="alert alert-danger py-2">{error}</div> : null}
      {isLoading ? <p className="text-muted">{t('Aufträge werden geladen...')}</p> : null}

      {!isLoading ? (
        <>
          <div className="card mb-4">
            <div className="card-body p-4">
              <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap mb-3">
                <div>
                  <h4 className="fw-semibold mb-1">{t('Meine laufenden Aufträge')}</h4>
                  <div className="text-muted">{providerLoginEmail}</div>
                </div>
                <span className="badge bg-light-primary text-primary rounded-pill px-3 py-2">
                  {myActiveBids.length} {t('aktiv')}
                </span>
              </div>

              {myActiveBids.length > 0 ? (
                <div className="row g-3">
                  {myActiveBids.map((bid) => (
                    <div className="col-xl-4 col-md-6" key={bid.id}>
                      <ProviderOrderCard
                        title={t('In Bearbeitung')}
                        order={getOrderFromBid(bid)}
                        bid={bid}
                        actionLabel={t('Öffnen')}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border rounded-3 p-4 text-center text-muted">
                  {t('Sie bearbeiten aktuell keine Aufträge.')}
                </div>
              )}
            </div>
          </div>

          <div className="row g-4">
            <div className="col-xl-6">
              <div className="card h-100">
                <div className="card-body p-4">
                  <h4 className="fw-semibold mb-3">{t('Direkt zugewiesene Aufträge')}</h4>
                  <div className="d-grid gap-3">
                    {directAssignedBids.map((bid) => (
                      <ProviderOrderCard
                        key={bid.id}
                        title={t('Direkt zugewiesen')}
                        order={getOrderFromBid(bid)}
                        bid={bid}
                        actionLabel={t('Details öffnen')}
                      />
                    ))}
                    {directAssignedBids.length === 0 ? (
                      <div className="border rounded-3 p-4 text-center text-muted">
                        {t('Keine direkt zugewiesenen Aufträge vorhanden.')}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="col-xl-6">
              <div className="card h-100">
                <div className="card-body p-4">
                  <h4 className="fw-semibold mb-3">{t('Öffentliche Aufträge')}</h4>
                  <div className="d-grid gap-3">
                    {publicOrders.map((order) => (
                      <ProviderOrderCard
                        key={order.id}
                        title={t('Öffentlich')}
                        order={order}
                        bid={bidByOrderId[order.id]}
                        actionLabel={t('Details öffnen')}
                      />
                    ))}
                    {publicOrders.length === 0 ? (
                      <div className="border rounded-3 p-4 text-center text-muted">
                        {t('Keine öffentlichen Aufträge vorhanden.')}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </PageContent>
  )
}

export default ProviderDashboardPage
