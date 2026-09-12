/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { api } from '../lib/api'
import { formatStatusLabel, getStatusBadgeClass } from '../lib/tableStatus'
import { getOptionLabel, JOB_TYPE_OPTIONS } from '../lib/vergoOptions'

/**
 * The service provider's jobs, split into the three groups the dashboard shows
 * side by side. The dashboard shows the newest three of each; the overview page
 * for a group shows all of them. Both read from here, so they always agree.
 */
export const PROVIDER_JOB_GROUPS = {
  current: {
    key: 'current',
    title: 'Aktuelle Aufträge',
    cardTitle: 'Aktuell',
    actionLabel: 'Öffnen',
    empty: 'Sie haben aktuell keine bestätigten oder offerierten Aufträge.',
  },
  direct: {
    key: 'direct',
    title: 'Direkt zugewiesene Aufträge',
    cardTitle: 'Direkt zugewiesen',
    actionLabel: 'Details öffnen',
    empty: 'Keine direkt zugewiesenen Aufträge vorhanden.',
  },
  public: {
    key: 'public',
    title: 'Öffentliche Aufträge',
    cardTitle: 'Öffentlich',
    actionLabel: 'Details öffnen',
    empty: 'Keine öffentlichen Aufträge vorhanden.',
  },
  cancelled: {
    key: 'cancelled',
    title: 'Stornierte Aufträge',
    cardTitle: 'Storniert',
    actionLabel: 'Details öffnen',
    empty: 'Keine stornierten Aufträge vorhanden.',
  },
}

// The three shown side by side on the dashboard. Cancelled has its own menu
// entry only.
export const PROVIDER_JOB_GROUP_ORDER = ['current', 'direct', 'public']

// Confirmed or quoted: the provider has committed to the job in some form.
const CURRENT_BID_STATUSES = new Set([
  'working',
  'submitted',
  'shortlisted',
  'inspection_interest',
  'inspection_confirmed',
  'accepted',
  'approved',
])

// Assigned directly by the manager, still waiting for the provider to confirm.
const UNCONFIRMED_DIRECT_BID_STATUSES = new Set([
  'inspection_requested',
  'awarded_pending_acceptance',
])

// Confirmed but not received.
const LOST_BID_STATUSES = new Set([
  'rejected',
  'inspection_rejected',
  'cancelled',
])

function getOrderLocation(order) {
  const address = order?.property_object?.address || order?.property_object?.name || ''
  const postalCode = order?.property_object?.postal_code || order?.property?.postal_code || ''
  const city = order?.property_object?.city || order?.property?.city || ''
  const locality = [postalCode, city].filter(Boolean).join(' ')

  return [address, locality].filter(Boolean).join(', ') || locality || address || '-'
}

function getAssignedProviderEmail(bid) {
  return String(
    bid?.assigned_provider_email
    || bid?.workflow_meta?.assigned_provider_email
    || ''
  ).toLowerCase()
}

function toTime(value) {
  const time = value ? new Date(value).getTime() : NaN

  return Number.isNaN(time) ? 0 : time
}

// Newest first: the most recent movement on the job, falling back to when it
// was created.
function byNewest(first, second) {
  return second.sortTime - first.sortTime
}

export function useProviderJobs() {
  const { t } = useLanguage()
  const [orders, setOrders] = useState([])
  const [bids, setBids] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadJobs() {
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

    loadJobs()

    return () => {
      isMounted = false
    }
  }, [t])

  const groups = useMemo(() => {
    const bidByOrderId = bids.reduce((map, bid) => {
      map[bid.order_id] = bid
      return map
    }, {})

    const fromBid = (bid) => ({
      id: `bid-${bid.id}`,
      order: bid.order ?? {},
      bid,
      sortTime: toTime(bid.updated_at) || toTime(bid.created_at),
    })

    const statusOf = (bid) => String(bid?.status || '').toLowerCase()
    // Cancelled by the administrator: the order itself is off, whatever the
    // provider's own bid says.
    const isOrderCancelled = (order) => String(order?.status || '').toLowerCase() === 'cancelled'
      || Boolean(order?.cancelled_at)

    const current = bids
      .filter((bid) => CURRENT_BID_STATUSES.has(statusOf(bid)) && !isOrderCancelled(bid.order))
      .map(fromBid)
      .sort(byNewest)

    const direct = bids
      .filter((bid) => UNCONFIRMED_DIRECT_BID_STATUSES.has(statusOf(bid)) && !isOrderCancelled(bid.order))
      .map(fromBid)
      .sort(byNewest)

    const publicJobs = orders
      .filter((order) => (
        ['public_inspection_open', 'inspection_signup_closed', 'published_for_quotes'].includes(order.workflow_status)
        && !bidByOrderId[order.id]
        && !isOrderCancelled(order)
      ))
      .map((order) => ({
        id: `order-${order.id}`,
        order,
        bid: bidByOrderId[order.id],
        sortTime: toTime(order.requested_at) || toTime(order.created_at),
      }))
      .sort(byNewest)

    // Each cancelled card says why: the job went to someone else, or it was
    // called off altogether.
    const cancelled = bids
      .filter((bid) => LOST_BID_STATUSES.has(statusOf(bid)) || isOrderCancelled(bid.order))
      .map((bid) => ({
        ...fromBid(bid),
        label: isOrderCancelled(bid.order) ? 'Vom Administrator storniert' : 'Nicht erhalten',
      }))
      .sort(byNewest)

    return { current, direct, public: publicJobs, cancelled }
  }, [bids, orders])

  return { groups, isLoading, error }
}

export function ProviderOrderCard({ title, order, bid, actionLabel }) {
  const { t } = useLanguage()

  return (
    <div className="border rounded-3 p-3 h-100 bg-white">
      <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
        <div className="min-w-0">
          <div className="text-muted small mb-1">{title}</div>
          <h5 className="fw-semibold mb-1">{order.title || '-'}</h5>
          <div className="text-muted small">
            {order.property?.li_number || '-'} {order.property?.title || ''}
          </div>
        </div>
        {bid ? (
          <span className={getStatusBadgeClass(bid.status)}>
            {t(formatStatusLabel(bid.status))}
          </span>
        ) : null}
      </div>

      <div className="d-grid gap-2 small text-muted mb-3">
        <div><span className="fw-semibold text-dark">{t('Gewerk')}:</span> {getOptionLabel(JOB_TYPE_OPTIONS, order.service_type) || '-'}</div>
        <div><span className="fw-semibold text-dark">{t('Standort')}:</span> {getOrderLocation(order)}</div>
        {getAssignedProviderEmail(bid) ? (
          <div><span className="fw-semibold text-dark">{t('Bearbeiter')}:</span> {getAssignedProviderEmail(bid)}</div>
        ) : null}
      </div>

      <Link className="btn btn-primary btn-sm" to={`/available-jobs?order_id=${order.id}`}>
        {actionLabel}
      </Link>
    </div>
  )
}
