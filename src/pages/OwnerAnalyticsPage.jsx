import { useEffect, useMemo, useState } from 'react'
import PageContent from '../components/PageContent'
import { useLanguage } from '../context/LanguageContext'
import { api } from '../lib/api'
import { formatCurrencyAmount, getOptionLabel, JOB_TYPE_OPTIONS } from '../lib/vergoOptions'
import { useAuth } from '../context/AuthContext'

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

// Every category the owner can open. `columns` describes the table on the right,
// `searchKeys` the fields the filter box looks at.
const CATEGORIES = [
  {
    key: 'spend_by_property',
    title: 'Ausgaben pro Liegenschaft',
    columns: [
      { key: 'label', heading: 'Liegenschaft' },
      { key: 'total_spend', heading: 'Ausgaben', money: true, align: 'end' },
    ],
  },
  {
    key: 'spend_by_object',
    title: 'Ausgaben pro Objekt',
    columns: [
      { key: 'label', heading: 'Objekt' },
      { key: 'total_spend', heading: 'Ausgaben', money: true, align: 'end' },
    ],
  },
  {
    key: 'spend_by_canton',
    title: 'Ausgaben pro Kanton',
    columns: [
      { key: 'label', heading: 'Kanton' },
      { key: 'total_spend', heading: 'Ausgaben', money: true, align: 'end' },
    ],
  },
  {
    key: 'orders_by_property',
    title: 'Aufträge pro Liegenschaft',
    columns: [
      { key: 'label', heading: 'Liegenschaft' },
      { key: 'order_count', heading: 'Aufträge', align: 'end' },
    ],
  },
  {
    key: 'orders_by_object',
    title: 'Aufträge pro Objekt',
    columns: [
      { key: 'label', heading: 'Objekt' },
      { key: 'order_count', heading: 'Aufträge', align: 'end' },
    ],
  },
  {
    key: 'orders_by_management',
    title: 'Aufträge pro Bewirtschaftung',
    columns: [
      { key: 'label', heading: 'Bewirtschaftung' },
      { key: 'order_count', heading: 'Aufträge', align: 'end' },
    ],
  },
  {
    key: 'orders_by_manager_email',
    title: 'Aufträge pro Bewirtschafter',
    columns: [
      { key: 'label', heading: 'E-Mail' },
      { key: 'order_count', heading: 'Aufträge', align: 'end' },
    ],
  },
  {
    key: 'cancellations_by_manager',
    title: 'Stornierungen pro Bewirtschafter',
    columns: [
      { key: 'manager_email', heading: 'E-Mail' },
      { key: 'manager_name', heading: 'Name' },
      { key: 'cancelled_count', heading: 'Abgesagt', align: 'end' },
    ],
    searchKeys: ['manager_email', 'manager_name'],
  },
  {
    key: 'duplicates_by_manager',
    title: 'Duplikate pro Bewirtschafter',
    columns: [
      { key: 'label', heading: 'E-Mail' },
      { key: 'manager_name', heading: 'Name' },
      { key: 'duplicate_count', heading: 'Duplikate', align: 'end' },
    ],
    searchKeys: ['label', 'manager_name'],
  },
  {
    key: 'providers',
    title: 'Dienstleister',
    columns: [
      { key: 'company_name', heading: 'Firma' },
      { key: 'awarded_count', heading: 'Beauftragt', align: 'end' },
      { key: 'completed_count', heading: 'Abgeschlossen', align: 'end' },
      { key: 'revenue', heading: 'Umsatz', money: true, align: 'end' },
    ],
    searchKeys: ['company_name'],
  },
  {
    key: 'providers_by_canton',
    title: 'Dienstleister pro Kanton',
    columns: [
      { key: 'label', heading: 'Firma - Kanton' },
      { key: 'order_count', heading: 'Aufträge', align: 'end' },
      { key: 'completed_count', heading: 'Abgeschlossen', align: 'end' },
    ],
  },
  {
    key: 'providers_by_property',
    title: 'Dienstleister pro Liegenschaft',
    columns: [
      { key: 'property', heading: 'Liegenschaft' },
      { key: 'company_name', heading: 'Firma' },
      { key: 'completed_count', heading: 'Abgeschlossen', align: 'end' },
    ],
    searchKeys: ['property', 'company_name'],
  },
  {
    key: 'top_services_by_property',
    title: 'Häufigste Leistungen pro Liegenschaft',
    columns: [
      { key: 'property', heading: 'Liegenschaft' },
      { key: 'top_service', heading: 'Häufigste Leistung', service: true },
    ],
    searchKeys: ['property', 'top_service'],
  },
]

function cellValue(row, column) {
  const raw = row?.[column.key]

  if (column.money) {
    return formatCurrencyAmount(Number(raw || 0))
  }

  if (column.service) {
    return getOptionLabel(JOB_TYPE_OPTIONS, raw) || raw || '-'
  }

  return raw ?? '-'
}

function OwnerAnalyticsPage() {
  const { language, t } = useLanguage()
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [owners, setOwners] = useState([])
  const [ownerId, setOwnerId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  // Nothing is shown on the right until a category is opened.
  const [openCategory, setOpenCategory] = useState('')
  const [categorySearch, setCategorySearch] = useState('')
  const [isReportOpen, setIsReportOpen] = useState(false)
  const [reportSections, setReportSections] = useState([])
  // One filter per chosen category: a canton for the provider list, a manager
  // for the order counts - each block narrowed on its own.
  const [reportFilters, setReportFilters] = useState({})
  const [isBuildingReport, setIsBuildingReport] = useState(false)
  // Superusers read the same report across every owner and can narrow it down;
  // an owner only ever sees their own portfolio.
  const canFilterByOwner = user?.role === 'admin'
    || (user?.role === 'employee' && user?.accessLevel === 'power_user')

  useEffect(() => {
    let cancelled = false

    api.getOwnerAnalytics(canFilterByOwner && ownerId ? ownerId : null)
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

  const totals = data?.totals ?? {}
  const selectedOwner = owners.find((owner) => String(owner.id) === String(ownerId))
  const activeCategory = CATEGORIES.find((category) => category.key === openCategory) ?? null

  const activeRows = useMemo(() => {
    if (!activeCategory || !data) {
      return []
    }

    const rows = data[activeCategory.key] ?? []
    const term = categorySearch.trim().toLowerCase()

    if (!term) {
      return rows
    }

    const keys = activeCategory.searchKeys ?? ['label']

    return rows.filter((row) => keys.some((key) => String(row?.[key] ?? '').toLowerCase().includes(term)))
  }, [activeCategory, categorySearch, data])

  function handleCategoryClick(key) {
    setCategorySearch('')
    setOpenCategory((current) => (current === key ? '' : key))
  }

  function toggleReportSection(key) {
    setReportSections((current) => {
      if (!current.includes(key)) {
        return [...current, key]
      }

      // Unticking a category drops its filter with it.
      setReportFilters((filters) => Object.fromEntries(
        Object.entries(filters).filter(([entryKey]) => entryKey !== key),
      ))

      return current.filter((entry) => entry !== key)
    })
  }

  async function handleCreateReport() {
    if (reportSections.length === 0) {
      return
    }

    setIsBuildingReport(true)

    try {
      await api.openOwnerAnalyticsReport({
        sections: reportSections,
        owner_id: canFilterByOwner && ownerId ? ownerId : null,
        search: categorySearch.trim(),
        filters: reportFilters,
        language,
      })
      setIsReportOpen(false)
    } catch (reportError) {
      setError(t(reportError.message))
    } finally {
      setIsBuildingReport(false)
    }
  }

  const detailPanel = activeCategory ? (
    <div className="card mb-0">
      <div className="px-4 py-3 border-bottom">
        <h5 className="card-title fw-semibold mb-2">{t(activeCategory.title)}</h5>
        {/* The filter sits where the description used to be. */}
        <input
          type="search"
          className="form-control"
          value={categorySearch}
          onChange={(event) => setCategorySearch(event.target.value)}
          placeholder={t('In dieser Kategorie filtern...')}
        />
      </div>
      <div className="card-body p-4">
        {activeRows.length === 0 ? (
          <div className="text-muted">{t('Keine Daten vorhanden.')}</div>
        ) : (
          <div className="table-responsive vergo-analytics-detail-scroll">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  {activeCategory.columns.map((column) => (
                    <th key={column.key} className={column.align === 'end' ? 'text-end' : ''}>
                      {t(column.heading)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeRows.map((row, index) => (
                  <tr key={`${activeCategory.key}-${index}`}>
                    {activeCategory.columns.map((column) => (
                      <td key={column.key} className={column.align === 'end' ? 'text-end fw-semibold' : ''}>
                        {cellValue(row, column)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  ) : null

  return (
    <PageContent
      title={t('Auswertungen')}
      subtitle={canFilterByOwner
        ? (selectedOwner
          ? `${t('Kennzahlen für')} ${selectedOwner.name || selectedOwner.email}`
          : t('Kennzahlen über alle Eigentümer.'))
        : t('Kennzahlen über alle Ihre Liegenschaften.')}
      breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: t('Auswertungen') }]}
    >
      <div className="card">
        <div className="card-body">
          <div className="row g-3 align-items-end">
            {canFilterByOwner ? (
              <div className="col-lg-5 col-md-8">
                <label className="form-label">{t('Eigentümer')}</label>
                <select
                  className="form-select"
                  value={ownerId}
                  onChange={(event) => setOwnerId(event.target.value)}
                >
                  <option value="">{t('Alle Eigentümer')}</option>
                  {owners.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.name || owner.email}
                    </option>
                  ))}
                </select>
                <div className="form-text">{t('Ohne Auswahl werden alle Eigentümer zusammen ausgewertet.')}</div>
              </div>
            ) : null}

            <div className={canFilterByOwner ? 'col-lg-7 text-lg-end' : 'col-12 text-lg-end'}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setIsReportOpen(true)}
              >
                <i className="ti ti-file-text me-1"></i>
                {t('Bericht erstellen')}
              </button>
            </div>
          </div>
        </div>
      </div>

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

          <div className="row g-4">
            {/* Categories stack down the left; the table only appears once one
                of them is opened. */}
            <div className="col-xl-4 col-lg-5">
              <div className="d-flex flex-column gap-2">
                {CATEGORIES.map((category) => {
                  const isOpen = category.key === openCategory
                  const count = (data[category.key] ?? []).length

                  return (
                    <div key={category.key} className="d-flex flex-column gap-2">
                      <button
                        type="button"
                        className={`card vergo-analytics-category${isOpen ? ' is-open' : ''}`}
                        onClick={() => handleCategoryClick(category.key)}
                      >
                        <span className="vergo-analytics-category-title">{t(category.title)}</span>
                        <span className="vergo-analytics-category-meta">
                          <span className="badge bg-light-primary text-primary rounded-pill">{count}</span>
                          <i className={`ti ${isOpen ? 'ti-chevron-down' : 'ti-chevron-right'}`}></i>
                        </span>
                      </button>

                      {/* On a phone the columns stack, so the report would land
                          below every category. Shown right here instead. */}
                      {isOpen ? <div className="d-lg-none">{detailPanel}</div> : null}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* On a phone the report is shown inline under the tapped
                category instead, so this column is desktop only. */}
            <div className="col-xl-8 col-lg-7 d-none d-lg-block">
              {/* The report follows the page: scrolling the category list on the
                  left keeps it in view, and a long table scrolls inside its own
                  box rather than stretching the page. */}
              <div className="vergo-analytics-detail-sticky">
                {activeCategory ? detailPanel : (
                  <div className="card mb-0">
                    <div className="card-body d-flex align-items-center justify-content-center text-muted py-5">
                      {t('Wählen Sie links eine Kategorie, um die Auswertung zu sehen.')}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : null}

      {isReportOpen ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
              <div className="modal-content rounded-1">
                <div className="modal-header border-bottom">
                  <div>
                    <h5 className="modal-title mb-1">{t('Bericht erstellen')}</h5>
                    <p className="text-muted mb-0">{t('Wählen Sie aus, was im PDF enthalten sein soll.')}</p>
                  </div>
                  <button type="button" className="btn-close" onClick={() => setIsReportOpen(false)}></button>
                </div>
                <div className="modal-body">
                  <div className="row g-2">
                    {CATEGORIES.map((category) => (
                      <div className="col-md-6" key={category.key}>
                        <div className="form-check border rounded-3 p-3 ps-5 h-100">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={`report-${category.key}`}
                            checked={reportSections.includes(category.key)}
                            onChange={() => toggleReportSection(category.key)}
                          />
                          <label className="form-check-label fw-semibold" htmlFor={`report-${category.key}`}>
                            {t(category.title)}
                          </label>
                          <div className="text-muted small">
                            {(data?.[category.key] ?? []).length} {t('Einträge')}
                          </div>

                          {/* Its own filter, so one report can show e.g. only
                              providers in Zürich and only one manager's orders. */}
                          {reportSections.includes(category.key) ? (
                            <input
                              type="search"
                              className="form-control form-control-sm mt-2"
                              value={reportFilters[category.key] ?? ''}
                              onChange={(event) => setReportFilters((current) => ({
                                ...current,
                                [category.key]: event.target.value,
                              }))}
                              placeholder={t('Diese Kategorie filtern (optional)')}
                            />
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>

                  {categorySearch.trim() ? (
                    <div className="alert alert-light border small mt-3 mb-0">
                      <i className="ti ti-filter me-1"></i>
                      {t('Der aktive Filter wird auf den Bericht angewendet:')} <strong>{categorySearch.trim()}</strong>
                    </div>
                  ) : null}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-light-danger text-danger" onClick={() => setIsReportOpen(false)}>
                    {t('Abbrechen')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={isBuildingReport || reportSections.length === 0}
                    onClick={handleCreateReport}
                  >
                    {isBuildingReport ? t('Wird erstellt...') : t('PDF erstellen')}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show"></div>
        </>
      ) : null}
    </PageContent>
  )
}

export default OwnerAnalyticsPage
