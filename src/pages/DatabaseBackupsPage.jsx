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
  const [selectedFile, setSelectedFile] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isWorking, setIsWorking] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

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
      setError(loadError.message)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCreateBackup() {
    setIsWorking(true)
    setError('')
    setSuccess('')

    try {
      await api.createDatabaseBackup()
      setSuccess(t('Datenbank-Backup wurde erstellt.'))
      await loadBackups()
    } catch (createError) {
      setError(createError.message)
    } finally {
      setIsWorking(false)
    }
  }

  async function handleUploadBackup(event) {
    event.preventDefault()

    if (!selectedFile) {
      setError(t('Bitte wählen Sie eine SQL-Datei aus.'))
      return
    }

    const shouldImport = window.confirm(t('Diese SQL-Datei ersetzt die aktuelle Datenbank. Fortfahren?'))

    if (!shouldImport) {
      return
    }

    setIsWorking(true)
    setError('')
    setSuccess('')

    try {
      const formData = new FormData()
      formData.append('backup', selectedFile)
      const response = await api.uploadDatabaseBackup(formData)
      const uploadedFileName = response.data?.name

      if (uploadedFileName) {
        await api.restoreDatabaseBackup(uploadedFileName)
      }

      setSelectedFile(null)
      event.target.reset()
      setSuccess(t('Backup-Datei wurde importiert und wiederhergestellt.'))
      await loadBackups()
    } catch (uploadError) {
      setError(uploadError.message)
    } finally {
      setIsWorking(false)
    }
  }

  async function handleDownloadBackup(fileName) {
    setError('')

    try {
      await api.downloadDatabaseBackup(fileName)
    } catch (downloadError) {
      setError(downloadError.message)
    }
  }

  async function handleRestoreBackup(fileName) {
    const shouldRestore = window.confirm(t('Dieses Backup ersetzt die aktuelle Datenbank. Fortfahren?'))

    if (!shouldRestore) {
      return
    }

    setIsWorking(true)
    setError('')
    setSuccess('')

    try {
      await api.restoreDatabaseBackup(fileName)
      setSuccess(t('Datenbank-Backup wurde wiederhergestellt.'))
      await loadBackups()
    } catch (restoreError) {
      setError(restoreError.message)
    } finally {
      setIsWorking(false)
    }
  }

  async function handleDeleteBackup(fileName) {
    const shouldDelete = window.confirm(t('Dieses Backup wirklich löschen?'))

    if (!shouldDelete) {
      return
    }

    setIsWorking(true)
    setError('')
    setSuccess('')

    try {
      await api.deleteDatabaseBackup(fileName)
      setSuccess(t('Backup-Datei wurde gelöscht.'))
      await loadBackups()
    } catch (deleteError) {
      setError(deleteError.message)
    } finally {
      setIsWorking(false)
    }
  }

  return (
    <PageContent
      title={t('Datenbank-Backups')}
      subtitle={t('Erstellen, herunterladen und wiederherstellen von SQL-Backups.')}
      breadcrumbs={[
        { label: t('Dashboard'), href: '/dashboard' },
        { label: t('Datenbank-Backups') },
      ]}
    >
      <div className="row g-4">
        <div className="col-lg-4">
          <div className="card h-100">
            <div className="card-body p-4">
              <h5 className="fw-semibold mb-3">{t('Backup erstellen')}</h5>
              <p className="text-muted small mb-4">
                {t('Erstellt eine SQL-Datei mit Tabellenstruktur und Daten.')}
              </p>
              <button type="button" className="btn btn-primary w-100" disabled={isWorking} onClick={handleCreateBackup}>
                <i className="ti ti-database-export me-1"></i>
                {isWorking ? t('Wird gespeichert...') : t('Backup jetzt erstellen')}
              </button>
            </div>
          </div>
        </div>

        <div className="col-lg-8">
          <div className="card h-100">
            <div className="card-body p-4">
              <h5 className="fw-semibold mb-3">{t('Backup importieren')}</h5>
              <p className="text-muted small mb-3">
                {t('Import ersetzt die aktuelle Datenbank sofort mit der ausgewählten SQL-Datei.')}
              </p>
              <form className="row g-3 align-items-end" onSubmit={handleUploadBackup}>
                <div className="col-md-8">
                  <label className="form-label">{t('SQL-Datei')}</label>
                  <input
                    type="file"
                    className="form-control"
                    accept=".sql,.txt"
                    onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                  />
                </div>
                <div className="col-md-4">
                  <button type="submit" className="btn btn-light-primary w-100" disabled={isWorking}>
                    <i className="ti ti-database-import me-1"></i>
                    {t('Backup importieren')}
                  </button>
                </div>
              </form>
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
              {success ? <div className="alert alert-success py-2">{success}</div> : null}
              {isLoading ? <p className="text-muted mb-0">{t('Backups werden geladen...')}</p> : null}

              {!isLoading ? (
                <div className="table-responsive rounded-2 mb-0 vergo-table-scroll">
                  <table className="table border-none text-nowrap customize-table mb-0 align-middle">
                    <thead className="text-dark fs-4">
                      <tr>
                        <th><h6 className="fs-4 fw-semibold mb-0">{t('Datei')}</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">{t('Größe')}</h6></th>
                        <th><h6 className="fs-4 fw-semibold mb-0">{t('Erstellt am')}</h6></th>
                        <th width="220"><h6 className="fs-4 fw-semibold mb-0">{t('Aktion')}</h6></th>
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
                              <button type="button" className="table-action-btn table-action-edit" disabled={isWorking} onClick={() => handleRestoreBackup(backup.name)} title={t('Backup wiederherstellen')}>
                                <i className="ti ti-database-import"></i>
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
