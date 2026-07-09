import { useState } from 'react'
import { api } from '../lib/api'
import { useLanguage } from '../context/LanguageContext'

const INITIAL_FORM = {
  category: 'general',
  priority: 'normal',
  subject: '',
  message: '',
}

function SupportTicketButton() {
  const { t } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  const [form, setForm] = useState(INITIAL_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  function openModal() {
    setIsOpen(true)
    setError('')
    setSuccess('')
  }

  function closeModal() {
    if (isSubmitting) {
      return
    }

    setIsOpen(false)
    setForm(INITIAL_FORM)
    setError('')
    setSuccess('')
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!form.subject.trim() || !form.message.trim()) {
      setError(t('Bitte füllen Sie Betreff und Nachricht aus.'))
      return
    }

    setIsSubmitting(true)

    try {
      await api.createSupportTicket({
        ...form,
        subject: form.subject.trim(),
        message: form.message.trim(),
      })
      setSuccess(t('Ihre Support-Anfrage wurde gesendet.'))
      setForm(INITIAL_FORM)
    } catch (requestError) {
      setError(t(requestError.message || 'Support-Anfrage konnte nicht gesendet werden.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <li className="nav-item">
        <button
          type="button"
          className="nav-link nav-icon-hover border-0 bg-transparent position-relative"
          onClick={openModal}
          aria-label={t('Support')}
          title={t('Support')}
        >
          <i className="ti ti-help-circle"></i>
        </button>
      </li>

      {isOpen ? (
        <div className="vergo-support-modal-backdrop" role="presentation" onMouseDown={closeModal}>
          <div className="vergo-support-modal" role="dialog" aria-modal="true" aria-labelledby="support-ticket-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="vergo-support-modal-header">
              <div>
                <h5 id="support-ticket-title" className="mb-1">{t('Support-Anfrage erstellen')}</h5>
                <p className="mb-0 text-muted">{t('Beschreiben Sie Ihr Anliegen. Das Vergo-Team sieht es als Ticket.')}</p>
              </div>
              <button type="button" className="btn-close" aria-label={t('Schließen')} onClick={closeModal}></button>
            </div>

            <form className="vergo-support-modal-body" onSubmit={handleSubmit}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label" htmlFor="support-category">{t('Kategorie')}</label>
                  <select
                    id="support-category"
                    className="form-select"
                    value={form.category}
                    onChange={(event) => updateField('category', event.target.value)}
                  >
                    <option value="general">{t('Allgemein')}</option>
                    <option value="technical">{t('Technisches Problem')}</option>
                    <option value="order">{t('Auftrag')}</option>
                    <option value="billing">{t('Rechnung')}</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="support-priority">{t('Priorität')}</label>
                  <select
                    id="support-priority"
                    className="form-select"
                    value={form.priority}
                    onChange={(event) => updateField('priority', event.target.value)}
                  >
                    <option value="normal">{t('Normal')}</option>
                    <option value="urgent">{t('Dringend')}</option>
                  </select>
                </div>
                <div className="col-12">
                  <label className="form-label" htmlFor="support-subject">{t('Betreff')}</label>
                  <input
                    id="support-subject"
                    className="form-control"
                    value={form.subject}
                    onChange={(event) => updateField('subject', event.target.value)}
                    placeholder={t('Kurzer Titel Ihrer Anfrage')}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label" htmlFor="support-message">{t('Nachricht')}</label>
                  <textarea
                    id="support-message"
                    className="form-control"
                    rows="5"
                    value={form.message}
                    onChange={(event) => updateField('message', event.target.value)}
                    placeholder={t('Was ist passiert? Was soll geprüft werden?')}
                  />
                </div>
              </div>

              {error ? <div className="alert alert-danger mt-3 mb-0">{error}</div> : null}
              {success ? <div className="alert alert-success mt-3 mb-0">{success}</div> : null}

              <div className="vergo-support-modal-actions">
                <button type="button" className="btn btn-light" onClick={closeModal} disabled={isSubmitting}>
                  {t('Abbrechen')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? t('Wird gesendet...') : t('Ticket senden')}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}

export default SupportTicketButton
