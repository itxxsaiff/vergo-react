import { useEffect, useState } from 'react'
import PageContent from '../components/PageContent'
import { api } from '../lib/api'
import { useLanguage } from '../context/LanguageContext'

function formatFileSize(bytes) {
  const size = Number(bytes || 0)

  if (size < 1024) {
    return `${size} B`
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function DatabaseBackupsPage() {
  const { t } = useLanguage()
  const [backups, setBackups] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isWorking, setIsWorking] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadBackups()
  }, [])

  async function loadBackups() {
    setIsLoading(true)
    setError('')

    try {
      const response = await api.getDatabaseBackups()
      setBackups(response.data ?? [])
    } catch (loadError) {
      setError(t(loadError.message))
    } finally {
      setIsLoading(false)
    }
  }

  async function handleDownloadBackup(fileName) {
    setError('')

    try {
      await api.downloadDatabaseBackup(fileName)
    } catch (downloadError) {
      setError(t(downloadError.message))
    }
  }

  async function handleDeleteBackup(fileName) {
    const shouldDelete = window.confirm(t('Dieses Backup wirklich löschen?'))

    if (!shouldDelete) {
      return
    }

    setIsWorking(true)
    setError('')

    try {
      await api.deleteDatabaseBackup(fileName)
      await loadBackups()
    } catch (deleteError) {
      setError(t(deleteError.message))
    } finally {
      setIsWorking(false)
    }
  }

  return (
    <PageContent
      title={t('Datenbank-Backups')}
      subtitle={t('Backups laufen automatisch im Hintergrund. Die Oberfläche ist nur für Kontrolle und Download gedacht.')}
      breadcrumbs={[
        { label: t('Dashboard'), href: '/dashboard' },
        { label: t('Datenbank-Backups') },
      ]}
    >
      <div className="row g-4">
        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-body p-4">
              <h5 className="fw-semibold mb-3">{t('Automatische Sicherung')}</h5>
              <p className="text-muted small mb-4">
                {t('Jeden Tag um 02:00 Uhr wird automatisch ein SQL-Backup erstellt und gespeichert.')}
              </p>
              <div className="d-flex align-items-center gap-2">
                <span className="badge bg-light-success text-success rounded-pill px-3 py-2">{t('Aktiv')}</span>
                <span className="text-muted small">{t('Laravel Scheduler: täglich 02:00')}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-body p-4">
              <h5 className="fw-semibold mb-3">{t('Wiederherstellung')}</h5>
              <p className="text-muted small mb-0">
                {t('Ein vollständiger Restore über die Oberfläche ist deaktiviert, damit neuere Aufträge nicht überschrieben werden. Gelöschte Aufträge werden direkt in der Auftragsliste wiederhergestellt.')}
              </p>
            </div>
          </div>
        </div>

        <div className="col-12">
          <div className="card">
            <div className="card-body p-4">
              <div className="d-flex align-items-center justify-content-between gap-3 mb-3">
                <h5 className="fw-semibold mb-0">{t('Vorhandene Backups')}</h5>
                <button type="button" className="btn btn-light-primary btn-sm" onClick={loadBackups} disabled={isLoading || isWorking}>
                  <i className="ti ti-refresh me-1"></i>
                  {t('Aktualisieren')}
                </button>
              </div>

              {error ? <div className="alert alert-danger py-2">{error}</div> : null}
              {isLoading ? <p className="text-muted mb-0">{t('Backups werden geladen...')}</p> : null}

              {!isLoading ? (
                <div className="table-responsive rounded-2 mb-0 vergo-table-scroll">
                  <table className="table border-none text-nowrap customize-table mb-0 align-middle">
                    <thead className="text-dark fs-4">
                      <tr>
                        <th><h6 className="fs-4 fw-semibold mb-0">{t('Datei')}</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">{t('Größe')}</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">{t('Erstellt am')}</h6></th>
                        <th width="140"><h6 className="fs-4 fw-semibold mb-0">{t('Aktion')}</h6></th>
                      </tr>
                    </thead>
                    <tbody>
                      {backups.map((backup) => (
                        <tr key={backup.name}>
                          <td className="fw-semibold">{backup.name}</td>
                          <td>{formatFileSize(backup.size)}</td>
                          <td>{backup.created_at || '-'}</td>
                          <td>
                            <div className="table-action-group">
                              <button type="button" className="table-action-btn table-action-view" onClick={() => handleDownloadBackup(backup.name)} title={t('Backup herunterladen')}>
                                <i className="ti ti-download"></i>
                              </button>
                              <button type="button" className="table-action-btn table-action-delete" disabled={isWorking} onClick={() => handleDeleteBackup(backup.name)} title={t('Backup löschen')}>
                                <i className="ti ti-trash"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {backups.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="text-center text-muted py-4">
                            {t('Noch keine Backups vorhanden.')}
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
      </div>
    </PageContent>
  )
}

export default DatabaseBackupsPage
