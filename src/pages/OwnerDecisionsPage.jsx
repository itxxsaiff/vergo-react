import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageContent from '../components/PageContent'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { api } from '../lib/api'
import { formatDateTimeDisplay } from '../lib/dateFormat'
import { formatSwissMoney } from '../lib/numberFormat'

// The three kinds of manager decision an owner may want to question, each with
// the reason that was recorded at the time.
const SECTIONS = [
  {
    key: 'rejected_offers',
    title: 'Abgelehnte Bestangebote',
    hint: 'Aufträge, bei denen die Bewirtschaftung das beste Angebot abgelehnt hat.',
    icon: 'ti ti-thumb-down',
  },
  {
    key: 'cancellations',
    title: 'Stornierte Aufträge',
    hint: 'Aufträge, die von der Bewirtschaftung storniert wurden.',
    icon: 'ti ti-ban',
  },
  {
    key: 'duplicates',
    title: 'Erkannte Duplikate',
    hint: 'Aufträge, die das System als Duplikat eines bestehenden Auftrags erkannt hat.',
    icon: 'ti ti-copy',
  },
]

function OwnerDecisionsPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [owners, setOwners] = useState([])
  const [ownerId, setOwnerId] = useState('')
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const canFilterByOwner = user?.role === 'admin'
    || (user?.role === 'employee' && user?.accessLevel === 'power_user')

  useEffect(() => {
    let cancelled = false

    api.getOwnerDecisions(canFilterByOwner && ownerId ? ownerId : null)
      .then((response) => {
        if (cancelled) {
          return
        }

        setData(response.data ?? null)

        if (Array.isArray(response.owners)) {
          setOwners(response.owners)
        }
      })
      .catch((loadError) => !cancelled && setError(t(loadError.message)))
      .finally(() => !cancelled && setIsLoading(false))

    return () => {
      cancelled = true
    }
  }, [ownerId, canFilterByOwner])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()

    return SECTIONS.reduce((carry, section) => {
      const rows = data?.[section.key] ?? []

      carry[section.key] = term
        ? rows.filter((row) => [
          row.order_number,
          row.order_title,
          row.property,
          row.company_name,
          row.manager_name,
          row.manager_email,
          row.reason,
        ].some((value) => String(value ?? '').toLowerCase().includes(term)))
        : rows

      return carry
    }, {})
  }, [data, search])

  return (
    <PageContent
      title={t('Berichte')}
      subtitle={t('Entscheidungen der Bewirtschaftung mit der jeweils angegebenen Begründung.')}
      breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: t('Berichte') }]}
    >
      <div className="card">
        <div className="card-body">
          <div className="row g-3 align-items-end">
            {canFilterByOwner ? (
              <div className="col-lg-4 col-md-6">
                <label className="form-label">{t('Eigentümer')}</label>
                <select className="form-select" value={ownerId} onChange={(event) => setOwnerId(event.target.value)}>
                  <option value="">{t('Alle Eigentümer')}</option>
                  {owners.map((owner) => (
                    <option key={owner.id} value={owner.id}>{owner.name || owner.email}</option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="col-lg-5 col-md-6">
              <label className="form-label">{t('Suche')}</label>
              <input
                type="search"
                className="form-control"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('Auftrag, Liegenschaft, Firma oder Begründung')}
              />
            </div>
          </div>
        </div>
      </div>

      {error ? <div className="alert alert-danger py-2">{error}</div> : null}
      {isLoading ? <div className="card"><div className="card-body">{t('Wird geladen...')}</div></div> : null}

      {!isLoading && data ? SECTIONS.map((section) => {
        const rows = filtered[section.key] ?? []

        return (
          <div className="card" key={section.key}>
            <div className="px-4 py-3 border-bottom d-flex align-items-center justify-content-between gap-3">
              <div>
                <h5 className="card-title fw-semibold mb-1">
                  <i className={`${section.icon} me-2`}></i>
                  {t(section.title)}
                </h5>
                <div className="text-muted small">{t(section.hint)}</div>
              </div>
              <span className="badge bg-light-primary text-primary rounded-pill px-3 py-2">{rows.length}</span>
            </div>
            <div className="card-body p-4">
              {rows.length === 0 ? (
                <div className="text-muted">{t('Keine Einträge vorhanden.')}</div>
              ) : (
                <div className="table-responsive">
                  <table className="table align-middle mb-0">
                    <thead>
                      <tr>
                        <th>{t('Auftrag')}</th>
                        <th>{t('Liegenschaft')}</th>
                        {section.key === 'rejected_offers' ? <th>{t('Firma')}</th> : null}
                        {section.key === 'duplicates' ? <th>{t('Duplikat von')}</th> : null}
                        <th>{t('Bewirtschafter')}</th>
                        <th>{t('Begründung')}</th>
                        <th>{t('Datum')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, index) => (
                        <tr key={`${section.key}-${row.order_id ?? index}-${index}`}>
                          <td>
                            <div className="fw-semibold">{row.order_number || '-'}</div>
                            <div className="text-muted">{row.order_title || '-'}</div>
                          </td>
                          <td>{row.property || '-'}</td>
                          {section.key === 'rejected_offers' ? (
                            <td>
                              <div>{row.company_name || '-'}</div>
                              {row.amount ? (
                                <div className="text-muted">{formatSwissMoney(row.amount)} {row.currency || 'CHF'}</div>
                              ) : null}
                            </td>
                          ) : null}
                          {section.key === 'duplicates' ? (
                            <td>
                              <div>{row.duplicate_of_number || '-'}</div>
                              <div className="text-muted">{row.duplicate_of_title || ''}</div>
                            </td>
                          ) : null}
                          <td>
                            <div>{row.manager_name || '-'}</div>
                            <div className="text-muted">{row.manager_email || ''}</div>
                          </td>
                          <td style={{ whiteSpace: 'normal', minWidth: '220px' }}>{row.reason || '-'}</td>
                          <td>
                            {formatDateTimeDisplay(row.decided_at)}
                            {row.order_id ? (
                              <div>
                                <Link to={`/orders/${row.order_id}`} className="small">{t('Auftrag ansehen')}</Link>
                              </div>
                            ) : null}
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
      }) : null}
    </PageContent>
  )
}

export default OwnerDecisionsPage
