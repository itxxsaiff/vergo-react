import { useEffect, useState } from 'react'
import PageContent from '../components/PageContent'
import { api } from '../lib/api'
import { getStatusBadgeClass } from '../lib/tableStatus'
import { getOptionLabel, JOB_TYPE_OPTIONS } from '../lib/vergoOptions'

const COMPLETED_ORDER_STATUSES = new Set(['completed', 'closed', 'cancelled', 'canceled', 'rejected', 'failed'])

function getEmployeeOrderStatus(order) {
  return COMPLETED_ORDER_STATUSES.has(String(order?.status || '').toLowerCase()) ? 'completed' : 'active'
}

function getEmployeeOrderStatusLabel(order) {
  return getEmployeeOrderStatus(order) === 'completed' ? 'Abgeschlossen' : 'Aktiv'
}

function isOrderApproved(order) {
  if (typeof order?.is_approved === 'boolean') {
    return order.is_approved
  }

  return Boolean(order?.approved_bid)
}

function getApprovedBadgeClass(order) {
  return getStatusBadgeClass(isOrderApproved(order) ? 'approved' : 'pending')
}

function getApprovedLabel(order) {
  return isOrderApproved(order) ? 'Ja' : 'Nein'
}

function getOrderNumber(order) {
  return order?.order_number || `AUF-${String(order?.id ?? '').padStart(5, '0')}`
}

function EmployeeOrdersPage() {
  const [orders, setOrders] = useState([])
  const [filters, setFilters] = useState({ search: '' })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadOrders() {
      setIsLoading(true)
      setError('')

      try {
        const response = await api.getOrders()
        setOrders(response.data ?? [])
      } catch (loadError) {
        setError(loadError.message)
      } finally {
        setIsLoading(false)
      }
    }

    loadOrders()
  }, [])

  function handleFilterChange(event) {
    const { name, value } = event.target

    setFilters((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const filteredOrders = orders.filter((order) => {
    const searchValue = [
      getOrderNumber(order),
      order.property?.li_number,
      order.property?.postal_code,
      order.property?.city,
      getOptionLabel(JOB_TYPE_OPTIONS, order.service_type ?? order.job_type),
      getEmployeeOrderStatusLabel(order),
      getApprovedLabel(order),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return !filters.search || searchValue.includes(filters.search.toLowerCase())
  })

  return (
    <PageContent
      title="Aufträge"
      subtitle="Sehen Sie alle Aufträge mit Status, Objektbezug und Freigabestand in einer kompakten Übersicht."
      breadcrumbs={[
        { label: 'Armaturenbrett', href: '/dashboard' },
        { label: 'Aufträge' },
      ]}
    >
      <div className="card">
        <div className="px-4 py-3 border-bottom">
          <h5 className="card-title fw-semibold mb-0 lh-sm">Auftragsübersicht</h5>
        </div>

        <div className="card-body p-4">
          <div className="row g-3 mb-4">
            <div className="col-md-10">
              <label className="form-label">Suche</label>
              <input
                className="form-control"
                name="search"
                value={filters.search}
                onChange={handleFilterChange}
                placeholder="Nach Auftragsnummer, LI-Nummer, PLZ, Ort, Gewerk oder Genehmigung suchen"
              />
            </div>

            <div className="col-md-2 d-flex align-items-end">
              <button
                type="button"
                className="btn btn-light-primary w-100"
                onClick={() => setFilters({ search: '' })}
              >
                Zurücksetzen
              </button>
            </div>
          </div>

          {error ? <div className="alert alert-danger py-2">{error}</div> : null}
          {isLoading ? <p className="text-muted mb-0">Aufträge werden geladen...</p> : null}

          {!isLoading ? (
            <div className="table-responsive rounded-2 mb-0 vergo-table-scroll">
              <table className="table border text-nowrap customize-table mb-0 align-middle">
                <thead className="text-dark fs-4">
                  <tr>
                    <th><h6 className="fs-4 fw-semibold mb-0">Status</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">Auftragsnummer</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">LI-Nummer</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">PLZ</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">Ort</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">Gewerk</h6></th>
                    <th><h6 className="fs-4 fw-semibold mb-0">Genehmigt</h6></th>
                  </tr>
                </thead>

                <tbody>
                  {filteredOrders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <span className={getStatusBadgeClass(getEmployeeOrderStatus(order))}>
                          {getEmployeeOrderStatusLabel(order)}
                        </span>
                      </td>
                      <td className="fw-semibold">{getOrderNumber(order)}</td>
                      <td>{order.property?.li_number || '-'}</td>
                      <td>{order.property?.postal_code || '-'}</td>
                      <td>{order.property?.city || '-'}</td>
                      <td>{getOptionLabel(JOB_TYPE_OPTIONS, order.service_type ?? order.job_type)}</td>
                      <td>
                        <span className={getApprovedBadgeClass(order)}>
                          {getApprovedLabel(order)}
                        </span>
                      </td>
                    </tr>
                  ))}

                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center text-muted py-4">
                        Keine Aufträge gefunden.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </PageContent>
  )
}

export default EmployeeOrdersPage
