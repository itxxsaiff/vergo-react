import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PageContent from '../components/PageContent'
import { confirmDelete, showDeleteSuccess } from '../lib/alerts'
import { api } from '../lib/api'
import { formatStatusLabel, getStatusBadgeClass } from '../lib/tableStatus'
import {
  DOCUMENT_TYPE_OPTIONS,
  JOB_TYPE_OPTIONS,
  TRADE_ACTIVITY_OPTIONS_BY_GROUP,
  TRADE_OBJECT_OPTIONS_BY_GROUP,
  getOptionLabel,
} from '../lib/vergoOptions'

const initialForm = {
  document_kind: 'contract',
  service_type: '',
  trade_object: '',
  trade_activity: '',
  property_object_id: '',
  property_object_ids: [],
  title: '',
  file: null,
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function getDocumentObjectScope(document) {
  const relatedObjects = document?.property_objects ?? []

  if (relatedObjects.length > 0) {
    return relatedObjects
      .map((object) => object?.address || object?.name || `Objekt ${object?.id ?? ''}`.trim())
      .filter(Boolean)
      .join(', ')
  }

  return document?.property_object?.address || document?.property_object?.name || '-'
}

function EmployeePropertyDocumentsPage() {
  const { propertyId } = useParams()
  const [property, setProperty] = useState(null)
  const [latestPropertyAnalysis, setLatestPropertyAnalysis] = useState(null)
  const [form, setForm] = useState(initialForm)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [activeDocumentId, setActiveDocumentId] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [error, setError] = useState('')
  const [analysisNotice, setAnalysisNotice] = useState('')

  useEffect(() => {
    loadProperty()
  }, [propertyId])

  useEffect(() => {
    if (isModalOpen) {
      document.body.classList.add('modal-open')
      document.body.style.overflow = 'hidden'
    } else {
      document.body.classList.remove('modal-open')
      document.body.style.overflow = ''
    }

    return () => {
      document.body.classList.remove('modal-open')
      document.body.style.overflow = ''
    }
  }, [isModalOpen])

  async function loadProperty() {
    setIsLoading(true)
    setError('')

    try {
      const response = await api.getProperty(propertyId)
      setProperty(response.data ?? null)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setIsLoading(false)
    }
  }

  function openModal(documentKind = 'contract') {
    setForm({
      ...initialForm,
      document_kind: documentKind,
    })
    setError('')
    setAnalysisNotice('')
    setIsModalOpen(true)
  }

  function closeModal() {
    setForm(initialForm)
    setError('')
    setIsModalOpen(false)
  }

  function handleChange(event) {
    const { name, value, files } = event.target

    setForm((current) => ({
      ...current,
      [name]: files ? files[0] : value,
      ...(name === 'service_type'
        ? {
          trade_object: '',
          trade_activity: '',
        }
        : {}),
      ...(name === 'trade_object'
        ? {
          trade_activity: '',
        }
        : {}),
      ...(name === 'document_kind'
        ? {
          property_object_id: '',
          property_object_ids: [],
        }
        : {}),
    }))
  }

  function handleObjectToggle(objectId) {
    setForm((current) => {
      const objectKey = String(objectId)
      const nextIds = current.property_object_ids.includes(objectKey)
        ? current.property_object_ids.filter((id) => id !== objectKey)
        : [...current.property_object_ids, objectKey]

      return {
        ...current,
        property_object_ids: nextIds,
      }
    })
  }

  function buildDocumentTitle() {
    if (form.title.trim()) {
      return form.title.trim()
    }

    const serviceLabel = getOptionLabel(JOB_TYPE_OPTIONS, form.service_type)
    const kindLabel = form.document_kind === 'invoice' ? 'Rechnung' : 'Vertrag'
    const detailParts = [serviceLabel, form.trade_object, form.trade_activity].filter(Boolean)

    return detailParts.length > 0
      ? `${kindLabel} - ${detailParts.join(' / ')}`
      : kindLabel
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setIsSaving(true)
    setError('')
    setAnalysisNotice('')

    if (!form.service_type) {
      setError('Bitte wählen Sie aus, wofür das Dokument gilt.')
      setIsSaving(false)
      return
    }

    if (form.document_kind === 'contract' && form.property_object_ids.length === 0) {
      setError('Bitte wählen Sie mindestens ein betroffenes Objekt aus.')
      setIsSaving(false)
      return
    }

    if (form.document_kind === 'invoice' && !form.property_object_id) {
      setError('Bitte wählen Sie das betroffene Objekt für die Rechnung aus.')
      setIsSaving(false)
      return
    }

    if (!form.file) {
      setError('Bitte wählen Sie eine Dokumentdatei aus.')
      setIsSaving(false)
      return
    }

    try {
      const payload = new FormData()
      payload.append('property_id', String(propertyId))
      payload.append('type', form.document_kind === 'invoice' ? 'invoice' : 'contract')
      payload.append('title', buildDocumentTitle())
      payload.append('file', form.file)
      payload.append('service_type', form.service_type)
      if (form.trade_object) payload.append('trade_object', form.trade_object)
      if (form.trade_activity) payload.append('trade_activity', form.trade_activity)

      if (form.document_kind === 'invoice') {
        payload.append('property_object_id', form.property_object_id)
      } else {
        form.property_object_ids.forEach((id) => {
          payload.append('property_object_ids[]', id)
        })
      }

      await api.createDocument(payload)
      closeModal()
      await loadProperty()
      setAnalysisNotice('Dokument gespeichert. Sie können jetzt unten auf Analyse klicken.')
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(documentId) {
    const shouldDelete = await confirmDelete('document')

    if (!shouldDelete) {
      return
    }

    try {
      await api.deleteDocument(documentId)
      await loadProperty()
      showDeleteSuccess('document')
    } catch (deleteError) {
      setError(deleteError.message)
    }
  }

  async function handleAnalyzeDocument(documentId) {
    setActiveDocumentId(documentId)
    setError('')
    setAnalysisNotice('')

    try {
      await api.analyzeDocument(documentId)
      await loadProperty()
      setAnalysisNotice('Dokumentanalyse gestartet oder aktualisiert. Prüfen Sie Status und Analyseergebnis auf dieser Seite.')
    } catch (analysisError) {
      setError(analysisError.message)
    } finally {
      setActiveDocumentId(null)
    }
  }

  async function handleAnalyzeProperty() {
    const documentsToAnalyze = (property?.documents ?? []).filter((document) => (
      ['uploaded', 'failed'].includes(String(document.status || '').toLowerCase())
    ))

    setIsAnalyzing(true)
    setError('')
    setAnalysisNotice('')

    if ((property?.documents ?? []).length === 0) {
      setIsAnalyzing(false)
      setAnalysisNotice('Es gibt noch keine Dokumente für diese Liegenschaft.')
      return
    }

    try {
      for (const document of documentsToAnalyze) {
        await api.analyzeDocument(document.id)
      }

      const response = await api.comparePropertyPrice(propertyId)
      const analysis = response.data?.analysis ?? null
      setLatestPropertyAnalysis(analysis)
      await loadProperty()
      setAnalysisNotice(
        analysis
          ? 'Analyse abgeschlossen. Das Ergebnis sehen Sie unten auf dieser Seite im Bereich Analyseergebnis.'
          : 'Analyse wurde ausgelöst, aber es liegt noch kein sichtbares Vergleichsergebnis vor.',
      )
    } catch (analysisError) {
      setError(analysisError.message)
    } finally {
      setIsAnalyzing(false)
    }
  }

  function handleExportAnalysisPdf() {
    if (!propertyPriceRecommendation) {
      setAnalysisNotice('Bitte führen Sie zuerst eine Analyse durch, bevor Sie den PDF-Bericht exportieren.')
      return
    }

    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1120,height=900')

    if (!printWindow) {
      setError('Der PDF-Bericht konnte nicht geöffnet werden. Bitte erlauben Sie Pop-ups für diese Seite.')
      return
    }

    const signalLabel = formatStatusLabel(propertyPriceRecommendation.comparison_data?.pricing_signal)
    const signalTone = propertyPriceRecommendation.comparison_data?.pricing_signal === 'too_high'
      ? '#b42318'
      : propertyPriceRecommendation.comparison_data?.pricing_signal === 'too_low'
        ? '#b54708'
        : '#027a48'

    const contractRows = contractDocuments.map((document) => {
      const serviceLabel = getOptionLabel(
        JOB_TYPE_OPTIONS,
        document.service_type || document.analysis_results?.[0]?.comparison_data?.service_category,
      )

      return `
        <tr>
          <td>${escapeHtml(document.title || '-')}</td>
          <td>${escapeHtml(serviceLabel)}</td>
          <td>${escapeHtml(getDocumentObjectScope(document))}</td>
          <td>${escapeHtml(document.analysis_results?.[0]?.comparison_data?.estimated_amount ?? '-')}</td>
          <td>${escapeHtml(formatStatusLabel(document.status))}</td>
        </tr>
      `
    }).join('')

    const invoiceRows = invoiceDocuments.map((document) => {
      const serviceLabel = getOptionLabel(
        JOB_TYPE_OPTIONS,
        document.service_type || document.analysis_results?.[0]?.comparison_data?.service_category,
      )

      return `
        <tr>
          <td>${escapeHtml(document.title || '-')}</td>
          <td>${escapeHtml(serviceLabel)}</td>
          <td>${escapeHtml(getDocumentObjectScope(document))}</td>
          <td>${escapeHtml(document.analysis_results?.[0]?.comparison_data?.estimated_amount ?? '-')}</td>
          <td>${escapeHtml(formatStatusLabel(document.status))}</td>
        </tr>
      `
    }).join('')

    const reasons = (propertyPriceRecommendation.comparison_data?.reasons ?? [])
      .map((reason) => `<li>${escapeHtml(reason)}</li>`)
      .join('')

    const benchmarkSources = (propertyPriceRecommendation.comparison_data?.benchmark_sources ?? [])
      .slice(0, 12)
      .map((source) => `
        <tr>
          <td>${escapeHtml(source.document_title || '-')}</td>
          <td>${escapeHtml(source.amount ?? '-')} ${escapeHtml(source.currency || '')}</td>
          <td>${escapeHtml(source.document_type ? formatStatusLabel(source.document_type) : '-')}</td>
          <td>${escapeHtml(source.match_score ?? '-')}</td>
        </tr>
      `)
      .join('')

    const html = `
      <!doctype html>
      <html lang="de">
        <head>
          <meta charset="utf-8" />
          <title>Vergo Analysebericht</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              color: #1f2937;
              margin: 32px;
              line-height: 1.45;
            }
            h1, h2, h3 {
              margin: 0 0 12px;
              color: #111827;
            }
            .muted {
              color: #6b7280;
            }
            .section {
              margin-top: 28px;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(3, minmax(0, 1fr));
              gap: 12px;
              margin-top: 16px;
            }
            .stat {
              border: 1px solid #e5e7eb;
              border-radius: 10px;
              padding: 12px 14px;
              background: #f9fafb;
            }
            .stat-label {
              font-size: 12px;
              color: #6b7280;
              margin-bottom: 6px;
              text-transform: uppercase;
            }
            .stat-value {
              font-size: 18px;
              font-weight: 700;
              color: #111827;
            }
            .signal {
              color: ${signalTone};
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 12px;
            }
            th, td {
              border: 1px solid #e5e7eb;
              padding: 10px 12px;
              text-align: left;
              vertical-align: top;
              font-size: 13px;
            }
            th {
              background: #f3f4f6;
            }
            ul {
              margin: 10px 0 0 18px;
            }
            .summary {
              border: 1px solid #dbeafe;
              background: #eff6ff;
              padding: 14px 16px;
              border-radius: 10px;
            }
            @media print {
              body {
                margin: 18px;
              }
            }
          </style>
        </head>
        <body>
          <h1>Analysebericht</h1>
          <div class="muted">Liegenschaft: ${escapeHtml(property?.li_number || '-')} ${escapeHtml(property?.title || '')}</div>
          <div class="muted">Erstellt am: ${escapeHtml(new Date().toLocaleString('de-DE'))}</div>

          <div class="section">
            <div class="summary">
              <h2>Zusammenfassung</h2>
              <div>${escapeHtml(propertyPriceRecommendation.summary || '-')}</div>
            </div>
          </div>

          <div class="section">
            <h2>Bewertung</h2>
            <div class="grid">
              <div class="stat">
                <div class="stat-label">Preissignal</div>
                <div class="stat-value signal">${escapeHtml(signalLabel)}</div>
              </div>
              <div class="stat">
                <div class="stat-label">Benchmark</div>
                <div class="stat-value">${escapeHtml(propertyPriceRecommendation.comparison_data?.benchmark_amount ?? '-')}</div>
              </div>
              <div class="stat">
                <div class="stat-label">Varianz</div>
                <div class="stat-value">${escapeHtml(propertyPriceRecommendation.comparison_data?.variance_percentage ?? '-')}%</div>
              </div>
              <div class="stat">
                <div class="stat-label">Leistung</div>
                <div class="stat-value">${escapeHtml(getOptionLabel(JOB_TYPE_OPTIONS, propertyPriceRecommendation.comparison_data?.service_category))}</div>
              </div>
              <div class="stat">
                <div class="stat-label">Intervall</div>
                <div class="stat-value">${escapeHtml(propertyPriceRecommendation.comparison_data?.service_interval || '-')}</div>
              </div>
              <div class="stat">
                <div class="stat-label">Quellen</div>
                <div class="stat-value">${escapeHtml(propertyPriceRecommendation.comparison_data?.benchmark_source_count ?? 0)}</div>
              </div>
            </div>
            ${reasons ? `<div class="section"><h3>Begründung</h3><ul>${reasons}</ul></div>` : ''}
          </div>

          <div class="section">
            <h2>Wartungsverträge</h2>
            <table>
              <thead>
                <tr>
                  <th>Titel</th>
                  <th>Leistung</th>
                  <th>Betroffene Objekte</th>
                  <th>Preis</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${contractRows || '<tr><td colspan="5">Keine Verträge vorhanden.</td></tr>'}
              </tbody>
            </table>
          </div>

          <div class="section">
            <h2>Rechnungen</h2>
            <table>
              <thead>
                <tr>
                  <th>Titel</th>
                  <th>Leistung</th>
                  <th>Objekt</th>
                  <th>Preis</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${invoiceRows || '<tr><td colspan="5">Keine Rechnungen vorhanden.</td></tr>'}
              </tbody>
            </table>
          </div>

          ${benchmarkSources ? `
            <div class="section">
              <h2>Vergleichsquellen</h2>
              <table>
                <thead>
                  <tr>
                    <th>Quelle</th>
                    <th>Betrag</th>
                    <th>Typ</th>
                    <th>Übereinstimmung</th>
                  </tr>
                </thead>
                <tbody>${benchmarkSources}</tbody>
              </table>
            </div>
          ` : ''}
        </body>
      </html>
    `

    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  const propertyDocuments = property?.documents ?? []
  const propertyObjects = property?.objects ?? []
  const availableTradeObjects = TRADE_OBJECT_OPTIONS_BY_GROUP[form.service_type] ?? []
  const availableTradeActivities = TRADE_ACTIVITY_OPTIONS_BY_GROUP[form.service_type] ?? []
  const propertyPriceRecommendation = useMemo(() => {
    const propertyAnalyses = property?.analysis_results ?? []
    const persistedAnalysis = propertyAnalyses.find(
      (result) => result?.comparison_data?.analysis_type === 'property_price_recommendation',
    ) ?? null

    if (persistedAnalysis) {
      return persistedAnalysis
    }

    if (latestPropertyAnalysis?.comparison_data?.analysis_type === 'property_price_recommendation') {
      return latestPropertyAnalysis
    }

    return propertyDocuments
      .flatMap((document) => document.analysis_results ?? [])
      .find((result) => result?.comparison_data?.analysis_type === 'property_price_recommendation') ?? null
  }, [latestPropertyAnalysis, property, propertyDocuments])

  const contractDocuments = propertyDocuments.filter((document) => document.type !== 'invoice')
  const invoiceDocuments = propertyDocuments.filter((document) => document.type === 'invoice')

  return (
    <PageContent
      title="Dokumente & Analyse"
      subtitle="Verwalten Sie Verträge und Rechnungen für diese Liegenschaft und starten Sie anschließend die Analyse."
      breadcrumbs={[
        { label: 'Armaturenbrett', href: '/dashboard' },
        { label: 'Liegenschaften', href: '/properties' },
        { label: property?.title || 'Dokumente' },
      ]}
    >
      {error && !isModalOpen ? <div className="alert alert-danger py-2">{error}</div> : null}
      {analysisNotice && !error ? <div className="alert alert-info py-2">{analysisNotice}</div> : null}
      {isLoading ? <div className="card"><div className="card-body">Dokumente werden geladen...</div></div> : null}

      {!isLoading && property ? (
        <>
          <div className="card mb-4">
            <div className="card-body">
              <div className="row g-3 align-items-end">
                <div className="col-lg-3 col-sm-6">
                  <div className="vergo-stat-label">Liegenschaft</div>
                  <div className="vergo-stat-value">{property.li_number || '-'} {property.title || ''}</div>
                </div>
                <div className="col-lg-2 col-sm-6">
                  <div className="vergo-stat-label">Objekte</div>
                  <div className="vergo-stat-value">{property.objects_count ?? 0}</div>
                </div>
                <div className="col-lg-2 col-sm-6">
                  <div className="vergo-stat-label">Dokumente</div>
                  <div className="vergo-stat-value">{property.documents_count ?? propertyDocuments.length}</div>
                </div>
                <div className="col-lg-5 col-sm-6 d-flex justify-content-lg-end">
                  <div className="d-flex gap-2 flex-wrap">
                    <Link to={`/properties/${propertyId}`} className="btn btn-light-primary">
                      Objektansicht
                    </Link>
                  </div>
                </div>
              </div>
              <div className="text-muted small mt-3">
                Die Analyse nutzt die hochgeladenen Verträge und Rechnungen dieser Liegenschaft. Eine PDF-Ausgabe ist im aktuellen Frontend noch nicht angebunden.
              </div>
            </div>
          </div>

          <div className="row g-4 mb-4">
            <div className="col-lg-6">
              <div className="card h-100">
                <div className="card-body">
                  <div className="d-flex align-items-start justify-content-between gap-3">
                    <div>
                      <div className="text-muted small text-uppercase mb-2">Verträge</div>
                      <h5 className="mb-2">Vertrag hinzufügen</h5>
                      <p className="text-muted mb-0">
                        Wählen Sie im Formular aus, wofür der Vertrag gilt, markieren Sie die betroffenen Objekte und laden Sie den Vertrag hoch.
                      </p>
                    </div>
                    <div className="avatar-sm rounded-circle bg-light-primary text-primary d-flex align-items-center justify-content-center">
                      <i className="ti ti-file-description fs-6"></i>
                    </div>
                  </div>
                  <div className="mt-4">
                    <button type="button" className="btn btn-primary" onClick={() => openModal('contract')}>
                      <i className="ti ti-plus me-1"></i>
                      Vertrag hinzufügen
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-lg-6">
              <div className="card h-100">
                <div className="card-body">
                  <div className="d-flex align-items-start justify-content-between gap-3">
                    <div>
                      <div className="text-muted small text-uppercase mb-2">Rechnung</div>
                      <h5 className="mb-2">Rechnung hinzufügen</h5>
                      <p className="text-muted mb-0">
                        Wählen Sie aus, wofür die Rechnung ist, ordnen Sie sie einem Objekt zu und laden Sie die Datei hoch.
                      </p>
                    </div>
                    <div className="avatar-sm rounded-circle bg-light-success text-success d-flex align-items-center justify-content-center">
                      <i className="ti ti-file-invoice fs-6"></i>
                    </div>
                  </div>
                  <div className="mt-4">
                    <button type="button" className="btn btn-success" onClick={() => openModal('invoice')}>
                      <i className="ti ti-plus me-1"></i>
                      Rechnung hinzufügen
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col-12">
              <div className="card mb-4">
                <div className="px-4 py-3 border-bottom">
                  <h5 className="card-title fw-semibold mb-0">Verträge</h5>
                </div>
                <div className="card-body p-4">
                  {contractDocuments.length > 0 ? (
                    <div className="table-responsive rounded-2 mb-0 vergo-table-scroll">
                      <table className="table border-none text-nowrap customize-table mb-0 align-middle">
                        <thead className="text-dark fs-4">
                          <tr>
                            <th><h6 className="fs-4 fw-semibold mb-0">Titel</h6></th>
                            <th><h6 className="fs-4 fw-semibold mb-0">Leistung</h6></th>
                            <th><h6 className="fs-4 fw-semibold mb-0">Status</h6></th>
                            <th><h6 className="fs-4 fw-semibold mb-0">Preis</h6></th>
                            <th><h6 className="fs-4 fw-semibold mb-0">Aktion</h6></th>
                          </tr>
                        </thead>
                        <tbody>
                          {contractDocuments.map((document) => (
                            <tr key={document.id}>
                              <td>
                                <div className="fw-semibold">{document.title}</div>
                                <div className="text-muted small">{document.file_name || '-'}</div>
                              </td>
                              <td>{getOptionLabel(JOB_TYPE_OPTIONS, document.service_type || document.analysis_results?.[0]?.comparison_data?.service_category)}</td>
                              <td><span className={getStatusBadgeClass(document.status)}>{formatStatusLabel(document.status)}</span></td>
                              <td>{document.analysis_results?.[0]?.comparison_data?.estimated_amount ?? '-'}</td>
                              <td>
                                <div className="table-action-group">
                                  <button
                                    type="button"
                                    className="table-action-btn table-action-view"
                                    title="Dokument herunterladen"
                                    onClick={() => api.downloadDocument(document.id, document.file_name)}
                                  >
                                    <i className="ti ti-download"></i>
                                  </button>
                                  <button
                                    type="button"
                                    className="table-action-btn table-action-edit"
                                    title="Dokument analysieren"
                                    onClick={() => handleAnalyzeDocument(document.id)}
                                    disabled={activeDocumentId === document.id}
                                  >
                                    <i className="ti ti-brain"></i>
                                  </button>
                                  <button
                                    type="button"
                                    className="table-action-btn table-action-delete"
                                    title="Dokument löschen"
                                    onClick={() => handleDelete(document.id)}
                                  >
                                    <i className="ti ti-trash"></i>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-muted">Noch keine Verträge vorhanden.</div>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="px-4 py-3 border-bottom">
                  <h5 className="card-title fw-semibold mb-0">Rechnungen</h5>
                </div>
                <div className="card-body p-4">
                  {invoiceDocuments.length > 0 ? (
                    <div className="table-responsive rounded-2 mb-0 vergo-table-scroll">
                      <table className="table border-none text-nowrap customize-table mb-0 align-middle">
                        <thead className="text-dark fs-4">
                          <tr>
                            <th><h6 className="fs-4 fw-semibold mb-0">Titel</h6></th>
                            <th><h6 className="fs-4 fw-semibold mb-0">Leistung</h6></th>
                            <th><h6 className="fs-4 fw-semibold mb-0">Status</h6></th>
                            <th><h6 className="fs-4 fw-semibold mb-0">Preis</h6></th>
                            <th><h6 className="fs-4 fw-semibold mb-0">Aktion</h6></th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoiceDocuments.map((document) => (
                            <tr key={document.id}>
                              <td>
                                <div className="fw-semibold">{document.title}</div>
                                <div className="text-muted small">{document.file_name || '-'}</div>
                              </td>
                              <td>{getOptionLabel(JOB_TYPE_OPTIONS, document.service_type || document.analysis_results?.[0]?.comparison_data?.service_category)}</td>
                              <td><span className={getStatusBadgeClass(document.status)}>{formatStatusLabel(document.status)}</span></td>
                              <td>{document.analysis_results?.[0]?.comparison_data?.estimated_amount ?? '-'}</td>
                              <td>
                                <div className="table-action-group">
                                  <button
                                    type="button"
                                    className="table-action-btn table-action-view"
                                    title="Dokument herunterladen"
                                    onClick={() => api.downloadDocument(document.id, document.file_name)}
                                  >
                                    <i className="ti ti-download"></i>
                                  </button>
                                  <button
                                    type="button"
                                    className="table-action-btn table-action-edit"
                                    title="Dokument analysieren"
                                    onClick={() => handleAnalyzeDocument(document.id)}
                                    disabled={activeDocumentId === document.id}
                                  >
                                    <i className="ti ti-brain"></i>
                                  </button>
                                  <button
                                    type="button"
                                    className="table-action-btn table-action-delete"
                                    title="Dokument löschen"
                                    onClick={() => handleDelete(document.id)}
                                  >
                                    <i className="ti ti-trash"></i>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-muted">Noch keine Rechnungen vorhanden.</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="card mt-4">
            <div className="card-body d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3">
              <div>
                <h5 className="mb-1">Analyse</h5>
                <div className="text-muted">
                  Startet die KI-Auswertung der Dokumente dieser Liegenschaft und zeigt das Ergebnis direkt unten auf dieser Seite.
                </div>
              </div>
              <div className="d-flex gap-2 flex-wrap">
                <button type="button" className="btn btn-light-primary" onClick={handleExportAnalysisPdf} disabled={!propertyPriceRecommendation}>
                  <i className="ti ti-file-export me-1"></i>
                  PDF exportieren
                </button>
                <button type="button" className="btn btn-success" onClick={handleAnalyzeProperty} disabled={isAnalyzing}>
                  <i className="ti ti-sparkles me-1"></i>
                  {isAnalyzing ? 'Analyse läuft...' : 'Analyse'}
                </button>
              </div>
            </div>
          </div>

          <div className="card mt-4">
            <div className="px-4 py-3 border-bottom">
              <h5 className="card-title fw-semibold mb-0">Analyseergebnis</h5>
            </div>
            <div className="card-body p-4">
              {propertyPriceRecommendation ? (
                <>
                  <div className={`alert ${propertyPriceRecommendation.comparison_data?.pricing_signal === 'too_high'
                    ? 'alert-light-danger'
                    : propertyPriceRecommendation.comparison_data?.pricing_signal === 'too_low'
                      ? 'alert-light-warning'
                      : 'alert-light-success'
                  } border mb-4`}>
                    <div className="fw-semibold mb-1">Zusammenfassung</div>
                    <div>{propertyPriceRecommendation.summary || '-'}</div>
                  </div>

                  <div className="row g-3">
                    <div className="col-md-4">
                      <div className="vergo-stat-label">Signal</div>
                      <div className="vergo-stat-value">
                        <span className={getStatusBadgeClass(propertyPriceRecommendation.comparison_data?.pricing_signal)}>
                          {formatStatusLabel(propertyPriceRecommendation.comparison_data?.pricing_signal)}
                        </span>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="vergo-stat-label">Benchmark</div>
                      <div className="vergo-stat-value">{propertyPriceRecommendation.comparison_data?.benchmark_amount ?? '-'}</div>
                    </div>
                    <div className="col-md-4">
                      <div className="vergo-stat-label">Varianz</div>
                      <div className="vergo-stat-value">{propertyPriceRecommendation.comparison_data?.variance_percentage ?? '-'}%</div>
                    </div>
                    <div className="col-md-4">
                      <div className="vergo-stat-label">Leistung</div>
                      <div className="vergo-stat-value">
                        {getOptionLabel(JOB_TYPE_OPTIONS, propertyPriceRecommendation.comparison_data?.service_category)}
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="vergo-stat-label">Intervall</div>
                      <div className="vergo-stat-value">{propertyPriceRecommendation.comparison_data?.service_interval || '-'}</div>
                    </div>
                    <div className="col-md-4">
                      <div className="vergo-stat-label">Quellen</div>
                      <div className="vergo-stat-value">{propertyPriceRecommendation.comparison_data?.benchmark_source_count ?? 0}</div>
                    </div>
                  </div>

                  {(propertyPriceRecommendation.comparison_data?.reasons ?? []).length > 0 ? (
                    <div className="mt-4">
                      <h6 className="fw-semibold">Begründung</h6>
                      <ul className="mb-0 ps-3">
                        {propertyPriceRecommendation.comparison_data.reasons.map((reason, index) => (
                          <li key={`${reason}-${index}`}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="text-muted">
                  Noch kein Analyseergebnis vorhanden. Laden Sie Dokumente hoch und klicken Sie dann auf <strong>Analyse</strong>.
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}

      {isModalOpen ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1" aria-hidden="false">
            <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
              <div className="modal-content rounded-1">
                <div className="modal-header border-bottom">
                  <div>
                    <h5 className="modal-title mb-1">
                      {form.document_kind === 'invoice' ? 'Rechnung hinzufügen' : 'Vertrag hinzufügen'}
                    </h5>
                    <p className="text-muted mb-0">
                      {form.document_kind === 'invoice'
                        ? 'Ordnen Sie die Rechnung einem Objekt zu und laden Sie die Datei hoch.'
                        : 'Wählen Sie die betroffenen Objekte aus und laden Sie den Vertrag hoch.'}
                    </p>
                  </div>
                  <button type="button" className="btn-close" aria-label="Schließen" onClick={closeModal}></button>
                </div>

                <form onSubmit={handleSubmit}>
                  <div className="modal-body">
                    <div className="row">
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Dokumentart</label>
                          <select className="form-select" name="document_kind" value={form.document_kind} onChange={handleChange}>
                            <option value="contract">Vertrag</option>
                            <option value="invoice">Rechnung</option>
                          </select>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">
                            {form.document_kind === 'invoice'
                              ? 'Wofür ist die Rechnung?'
                              : 'Wofür ist der Vertrag?'}
                          </label>
                          <select className="form-select" name="service_type" value={form.service_type} onChange={handleChange}>
                            <option value="">Leistung auswählen</option>
                            {JOB_TYPE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Objekt / Bauteil</label>
                          <select className="form-select" name="trade_object" value={form.trade_object} onChange={handleChange} disabled={!form.service_type}>
                            <option value="">Objekt / Bauteil auswählen</option>
                            {availableTradeObjects.map((option) => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Tätigkeit</label>
                          <select className="form-select" name="trade_activity" value={form.trade_activity} onChange={handleChange} disabled={!form.service_type}>
                            <option value="">Tätigkeit auswählen</option>
                            {availableTradeActivities.map((option) => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {form.document_kind === 'contract' ? (
                        <div className="col-12">
                          <div className="mb-3">
                            <label className="form-label">Welche Objekte sind vom Vertrag betroffen?</label>
                            <div className="border rounded-2 p-3">
                              {propertyObjects.length > 0 ? propertyObjects.map((object) => {
                                const checked = form.property_object_ids.includes(String(object.id))

                                return (
                                  <div className="form-check mb-2" key={object.id}>
                                    <input
                                      className="form-check-input"
                                      type="checkbox"
                                      id={`property-document-object-${object.id}`}
                                      checked={checked}
                                      onChange={() => handleObjectToggle(object.id)}
                                    />
                                    <label className="form-check-label" htmlFor={`property-document-object-${object.id}`}>
                                      {object.address || object.name || `Objekt ${object.id}`}
                                    </label>
                                  </div>
                                )
                              }) : (
                                <div className="text-muted">Für diese Liegenschaft sind noch keine Objekte vorhanden.</div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="col-12">
                          <div className="mb-3">
                            <label className="form-label">Für welches Objekt gilt die Rechnung?</label>
                            <select className="form-select" name="property_object_id" value={form.property_object_id} onChange={handleChange}>
                              <option value="">Objekt auswählen</option>
                              {propertyObjects.map((object) => (
                                <option key={object.id} value={object.id}>
                                  {object.address || object.name || `Objekt ${object.id}`}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}

                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Titel</label>
                          <input
                            className="form-control"
                            name="title"
                            value={form.title}
                            onChange={handleChange}
                            placeholder="Optional, wird sonst automatisch gesetzt"
                          />
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Backend-Typ</label>
                          <input
                            className="form-control"
                            value={getOptionLabel(DOCUMENT_TYPE_OPTIONS, form.document_kind === 'invoice' ? 'invoice' : 'contract')}
                            disabled
                            readOnly
                          />
                        </div>
                      </div>
                      <div className="col-12">
                        <div className="mb-0">
                          <label className="form-label">Datei</label>
                          <input type="file" className="form-control" name="file" onChange={handleChange} />
                        </div>
                      </div>
                    </div>

                    {error ? <div className="alert alert-danger py-2 mt-3 mb-0">{error}</div> : null}
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-light-danger text-danger" onClick={closeModal}>Stornieren</button>
                    <button type="submit" className="btn btn-primary" disabled={isSaving}>
                      {isSaving ? 'Speichern...' : form.document_kind === 'invoice' ? 'Rechnung speichern' : 'Vertrag speichern'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show"></div>
        </>
      ) : null}
    </PageContent>
  )
}

export default EmployeePropertyDocumentsPage
