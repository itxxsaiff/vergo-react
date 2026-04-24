import { Navigate, useParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import PageContent from '../components/PageContent'
import { api } from '../lib/api'
import { formatStatusLabel, getStatusBadgeClass } from '../lib/tableStatus'

const CATEGORY_CONFIG = {
  owners: {
    label: 'Eigentümer',
    subtitle: 'Alle Eigentümer mit Kundennummer, Adresse und Anzahl der Liegenschaften in einer Übersicht.',
  },
  'service-providers': {
    label: 'Dienstleister',
    subtitle: 'Alle Dienstleister in einer kompakten Leseansicht ohne Verwaltungsaktionen.',
  },
  admins: {
    label: 'Admins',
    subtitle: 'Alle Admins als Kartenansicht mit Bild, Namen und hinterlegtem Standort.',
  },
}

function EmployeeUsersPage() {
  const { category = 'owners' } = useParams()
  const [items, setItems] = useState([])
  const [filters, setFilters] = useState({ search: '' })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const activeCategory = CATEGORY_CONFIG[category]

  useEffect(() => {
    if (!activeCategory) {
      return undefined
    }

    async function loadItems() {
      setIsLoading(true)
      setError('')

      try {
        let response

        if (category === 'owners') {
          response = await api.getUserDirectoryOwners()
        } else if (category === 'service-providers') {
          response = await api.getUserDirectoryServiceProviders()
        } else {
          response = await api.getUserDirectoryAdmins()
        }

        setItems(response.data ?? [])
      } catch (loadError) {
        setError(loadError.message)
      } finally {
        setIsLoading(false)
      }
    }

    loadItems()
  }, [activeCategory, category])

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (category === 'owners') {
        const searchValue = [
          item.customer_number,
          item.company_name,
          item.address,
          item.postal_code,
          item.city,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        return !filters.search || searchValue.includes(filters.search.toLowerCase())
      }

      if (category === 'service-providers') {
        const searchValue = [
          item.company_name,
          item.contact_name,
          item.contact_email,
          item.phone,
          item.status,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        return !filters.search || searchValue.includes(filters.search.toLowerCase())
      }

      const searchValue = [
        item.first_name,
        item.last_name,
        item.location,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return !filters.search || searchValue.includes(filters.search.toLowerCase())
    })
  }, [category, filters.search, items])

  if (!activeCategory) {
    return <Navigate to="/users/owners" replace />
  }

  function handleFilterChange(event) {
    const { name, value } = event.target

    setFilters((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function renderOwnersTable() {
    return (
      <div className="table-responsive rounded-2 mb-0 vergo-table-scroll">
        <table className="table border text-nowrap customize-table mb-0 align-middle">
          <thead className="text-dark fs-4">
            <tr>
              <th><h6 className="fs-4 fw-semibold mb-0">Kundennummer</h6></th>
              <th><h6 className="fs-4 fw-semibold mb-0">Firmenname</h6></th>
              <th><h6 className="fs-4 fw-semibold mb-0">Adresse</h6></th>
              <th><h6 className="fs-4 fw-semibold mb-0">PLZ</h6></th>
              <th><h6 className="fs-4 fw-semibold mb-0">Ort</h6></th>
              <th><h6 className="fs-4 fw-semibold mb-0">Anzahl Liegenschaften</h6></th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((owner) => (
              <tr key={owner.id}>
                <td className="fw-semibold">{owner.customer_number}</td>
                <td>{owner.company_name || '-'}</td>
                <td>{owner.address || '-'}</td>
                <td>{owner.postal_code || '-'}</td>
                <td>{owner.city || '-'}</td>
                <td>{owner.properties_count ?? 0}</td>
              </tr>
            ))}
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center text-muted py-4">
                  Keine Eigentümer gefunden.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    )
  }

  function renderServiceProvidersTable() {
    return (
      <div className="table-responsive rounded-2 mb-0 vergo-table-scroll">
        <table className="table border text-nowrap customize-table mb-0 align-middle">
          <thead className="text-dark fs-4">
            <tr>
              <th><h6 className="fs-4 fw-semibold mb-0">Firmenname</h6></th>
              <th><h6 className="fs-4 fw-semibold mb-0">Kontakt</h6></th>
              <th><h6 className="fs-4 fw-semibold mb-0">E-Mail</h6></th>
              <th><h6 className="fs-4 fw-semibold mb-0">Telefon</h6></th>
              <th><h6 className="fs-4 fw-semibold mb-0">Status</h6></th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((provider) => (
              <tr key={provider.id}>
                <td className="fw-semibold">{provider.company_name || '-'}</td>
                <td>{provider.contact_name || '-'}</td>
                <td>{provider.contact_email || '-'}</td>
                <td>{provider.phone || '-'}</td>
                <td>
                  <span className={getStatusBadgeClass(provider.status)}>
                    {formatStatusLabel(provider.status)}
                  </span>
                </td>
              </tr>
            ))}
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center text-muted py-4">
                  Keine Dienstleister gefunden.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    )
  }

  function renderAdminCards() {
    return (
      <div className="row g-4">
        {filteredItems.map((admin) => (
          <div className="col-xl-3 col-lg-4 col-sm-6" key={admin.id}>
            <div className="card vergo-admin-directory-card overflow-hidden h-100">
              <div className="vergo-admin-directory-card-inner">
                <div className="vergo-admin-directory-photo-wrap">
                  <img
                    src={admin.photo_url}
                    alt={`${admin.first_name} ${admin.last_name}`.trim() || 'Admin'}
                    className="vergo-admin-directory-photo"
                  />
                </div>
                <div className="vergo-admin-directory-content">
                  <h5 className="fw-semibold mb-1">{admin.first_name || 'Admin'}</h5>
                  <div className="fw-semibold text-dark mb-2">{admin.last_name || '-'}</div>
                  <div className="text-muted small">{admin.location || '-'}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
        {filteredItems.length === 0 ? (
          <div className="col-12">
            <div className="text-center text-muted py-4">Keine Admins gefunden.</div>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <PageContent
      title="Nutzer"
      subtitle={activeCategory.subtitle}
      breadcrumbs={[
        { label: 'Armaturenbrett', href: '/dashboard' },
        { label: 'Nutzer' },
        { label: activeCategory.label },
      ]}
    >
      <div className="card">
        <div className="px-4 py-3 border-bottom">
          <h5 className="card-title fw-semibold mb-0 lh-sm">{activeCategory.label}</h5>
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
                placeholder={`Suche in ${activeCategory.label.toLowerCase()}`}
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
          {isLoading ? <p className="text-muted mb-0">Daten werden geladen...</p> : null}

          {!isLoading ? (
            category === 'owners'
              ? renderOwnersTable()
              : category === 'service-providers'
                ? renderServiceProvidersTable()
                : renderAdminCards()
          ) : null}
        </div>
      </div>
    </PageContent>
  )
}

export default EmployeeUsersPage
