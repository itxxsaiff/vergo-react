import { useEffect, useMemo, useState } from 'react'
import PageContent from '../components/PageContent'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { formatStatusLabel, getStatusBadgeClass } from '../lib/tableStatus'
import { DOCUMENT_TYPE_OPTIONS, getOptionLabel } from '../lib/vergoOptions'

function AiAnalysisPage() {
  const { user } = useAuth()
  const [analyses, setAnalyses] = useState([])
  const [documents, setDocuments] = useState([])
  const [filters, setFilters] = useState({ search: '', status: '', type: '' })
  const [selectedAnalysisId, setSelectedAnalysisId] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [runningDocumentId, setRunningDocumentId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setIsLoading(true)
    setError('')

    try {
      const [analysisResponse, documentResponse] = await Promise.all([
        api.getAiAnalysis(),
        api.getDocuments(),
      ])

      const nextAnalyses = analysisResponse.data ?? []
      setAnalyses(nextAnalyses)
      setDocuments(documentResponse.data ?? [])

      if (!selectedAnalysisId && nextAnalyses.length > 0) {
        setSelectedAnalysisId(nextAnalyses[0].id)
      }
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleAnalyzeDocument(documentId) {
    setRunningDocumentId(documentId)
    setError('')

    try {
      const response = await api.analyzeDocument(documentId)
      const result = response.data

      setAnalyses((current) => [result, ...current])
      setDocuments((current) => current.map((document) => (
        document.id === documentId
          ? {
            ...document,
            status: result.status === 'failed' ? 'failed' : 'processing',
            analysis_results: [result, ...(document.analysis_results ?? [])],
          }
          : document
      )))
      setSelectedAnalysisId(result.id)
    } catch (analysisError) {
      setError(analysisError.message)
    } finally {
      setRunningDocumentId(null)
    }
  }

  function handleFilterChange(event) {
    const { name, value } = event.target
    setFilters((current) => ({ ...current, [name]: value }))
  }

  const filteredDocuments = useMemo(() => documents.filter((document) => {
    const searchValue = [
      document.title,
      document.file_name,
      document.type,
      document.property?.li_number,
      document.property?.title,
      document.order?.title,
    ].filter(Boolean).join(' ').toLowerCase()

    const searchMatch = !filters.search || searchValue.includes(filters.search.toLowerCase())
    const statusMatch = !filters.status || String(document.status || '').toLowerCase() === filters.status.toLowerCase()
    const typeMatch = !filters.type || String(document.type || '').toLowerCase() === filters.type.toLowerCase()

    return searchMatch && statusMatch && typeMatch
  }), [documents, filters.search, filters.status, filters.type])

  const selectedAnalysis = analyses.find((analysis) => analysis.id === selectedAnalysisId) ?? analyses[0] ?? null
  const extractedData = selectedAnalysis?.comparison_data ?? {}
  const keyPoints = Array.isArray(extractedData.key_points) ? extractedData.key_points : []

  function handleViewDocumentAnalysis(document) {
    const latestDocumentAnalysis = analyses.find((analysis) => analysis.document?.id === document.id)
      ?? document.analysis_results?.[0]

    if (latestDocumentAnalysis?.id) {
      setSelectedAnalysisId(latestDocumentAnalysis.id)
    }
  }

  return (
    <PageContent
      title="KI-Analyse"
      subtitle={user?.role === 'owner'
        ? 'Prüfen Sie Vertrags- und Rechnungsanalysen, die dabei helfen zu erklären, ob die Preisgestaltung fair, niedrig oder zu hoch erscheint.'
        : 'Führen Sie dokumentbasierte Analysen mit Gemini durch und prüfen Sie extrahierte Preis- und Vertragssignale.'}
      breadcrumbs={[{ label: 'Armaturenbrett', href: '/dashboard' }, { label: 'KI-Analyse' }]}
    >
      {error ? <div className="alert alert-danger py-2">{error}</div> : null}

      <div className="row">
        <div className="col-xl-5">
          <div className="card">
            <div className="px-4 py-3 border-bottom">
              <h5 className="card-title fw-semibold mb-0">Dokumente bereit für KI</h5>
            </div>
            <div className="card-body p-4">
              <div className="row g-3 mb-4 vergo-filter-bar">
                <div className="col-md-8">
                  <label className="form-label">Suche</label>
                  <div className="vergo-search-input-wrap">
                    <i className="ti ti-search vergo-search-input-icon" aria-hidden="true"></i>
                    <input
                      aria-label="Suche"
                      className="form-control"
                      name="search"
                      value={filters.search}
                      onChange={handleFilterChange}
                      placeholder="Nach Titel, Datei, Immobilie oder Auftrag suchen"
                    />
                  </div>
                </div>
                <div className="col-md-2">
                  <label className="form-label">Typ</label>
                  <div className="vergo-select-input-wrap">
                    <i className="ti ti-adjustments vergo-select-input-icon" aria-hidden="true"></i>
                    <select aria-label="Typ" className="form-select" name="type" value={filters.type} onChange={handleFilterChange}>
                      <option value="">All Status</option>
                      {DOCUMENT_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="col-md-2">
                  <label className="form-label">Status</label>
                  <div className="vergo-select-input-wrap">
                    <i className="ti ti-adjustments vergo-select-input-icon" aria-hidden="true"></i>
                    <select aria-label="Status" className="form-select" name="status" value={filters.status} onChange={handleFilterChange}>
                      <option value="">All Status</option>
                      <option value="uploaded">Hochgeladen</option>
                      <option value="processing">In Bearbeitung</option>
                      <option value="analyzed">Analysiert</option>
                      <option value="failed">Fehlgeschlagen</option>
                    </select>
                  </div>
                </div>
              </div>

              {isLoading ? <div className="text-muted">Dokumente und Analyseergebnisse werden geladen...</div> : null}

              {!isLoading ? (
                <div className="table-responsive rounded-2 mb-0 vergo-table-scroll">
                  <table className="table border-none text-nowrap customize-table mb-0 align-middle">
                    <thead>
                      <tr>
                        <th>Dokument</th>
                        <th>Status</th>
                        <th>Aktion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDocuments.map((document) => (
                        <tr key={document.id}>
                          <td>
                            <div className="fw-semibold">{document.title}</div>
                            <div className="text-muted">{document.property?.li_number ?? '-'} {document.order?.title ? `• ${document.order.title}` : ''}</div>
                            <div className="text-muted small">{getOptionLabel(DOCUMENT_TYPE_OPTIONS, document.type)}</div>
                          </td>
                          <td>
                            <span className={getStatusBadgeClass(document.status)}>{formatStatusLabel(document.status)}</span>
                          </td>
                          <td>
                            <div className="d-flex gap-2">
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => handleAnalyzeDocument(document.id)}
                                disabled={runningDocumentId === document.id}
                              >
                                {runningDocumentId === document.id ? 'Läuft...' : 'Analysieren'}
                              </button>
                              <button
                                type="button"
                                className="btn btn-light-primary btn-sm"
                                onClick={() => handleViewDocumentAnalysis(document)}
                                disabled={!analyses.some((analysis) => analysis.document?.id === document.id) && !(document.analysis_results?.length > 0)}
                              >
                                Anzeigen
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredDocuments.length === 0 ? (
                        <tr>
                          <td colSpan="3" className="text-center text-muted py-4">
                            Keine Dokumente zur Analyse gefunden.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="col-xl-7">
          <div className="card">
            <div className="px-4 py-3 border-bottom">
              <h5 className="card-title fw-semibold mb-0">Letztes KI-Ergebnis</h5>
            </div>
            <div className="card-body p-4">
              {!selectedAnalysis ? (
                <div className="text-muted">Führen Sie links eine Dokumentanalyse durch, um hier Ergebnisse zu sehen.</div>
              ) : (
                <>
                  <h5>{selectedAnalysis.document?.title ?? 'Analyseergebnis'}</h5>

                  <div className="row g-3 mb-4 vergo-filter-bar">
                    <div className="col-md-4">
                      <div>Konfidenzwert: {selectedAnalysis.score ?? '-'}</div>
                    </div>
                    <div className="col-md-4">
                      <div>Preissignal: {formatStatusLabel(extractedData.pricing_signal)}</div>
                    </div>
                    <div className="col-md-4">
                      <div>Dokumenttyp: {getOptionLabel(DOCUMENT_TYPE_OPTIONS, selectedAnalysis.document?.type)}</div>
                    </div>
                  </div>

                  <div className="alert alert-light-primary border mb-4">
                    <strong>Zusammenfassung</strong>
                    <div>{selectedAnalysis.summary}</div>
                  </div>

                  <div>
                    <h6>Extrahierte Daten</h6>
                    <div>Lieferant: {extractedData.entities?.vendor_name || '-'}</div>
                    <div>Standort: {extractedData.location || '-'}</div>
                    <div>Leistung: {getOptionLabel(DOCUMENT_TYPE_OPTIONS, selectedAnalysis.document?.type)}</div>
                  </div>

                  {keyPoints.length > 0 ? (
                    <div className="mt-3">
                      <h6>Kernpunkte</h6>
                      <ul className="mb-0 ps-3">
                        {keyPoints.map((point, index) => (
                          <li key={`${point}-${index}`}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageContent>
  )
}

export default AiAnalysisPage
