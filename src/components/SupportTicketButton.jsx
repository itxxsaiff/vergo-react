import { useState } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'

function splitDisplayName(user) {
  const displayName = user?.name ?? user?.display_name ?? ''
  const parts = displayName.trim().split(/\s+/).filter(Boolean)

  return {
    firstName: user?.first_name ?? parts[0] ?? '',
    lastName: user?.last_name ?? parts.slice(1).join(' '),
  }
}

function createInitialForm(user) {
  const { firstName, lastName } = splitDisplayName(user)

  return {
    priority: 'normal',
    first_name: firstName,
    last_name: lastName,
    phone: user?.phone ?? '',
    requester_email: user?.email ?? '',
    subject: '',
    message: '',
  }
}

function SupportTicketButton({
  publicMode = false,
  asNavItem = true,
  wrapperClassName = 'nav-item',
  buttonClassName = 'nav-link nav-icon-hover border-0 bg-transparent position-relative',
  buttonStyle,
}) {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  const [form, setForm] = useState(() => createInitialForm(user))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  function openModal() {
    setForm(createInitialForm(user))
    setIsOpen(true)
    setError('')
    setSuccess('')
  }

  function closeModal() {
    if (isSubmitting) {
      return
    }

    setIsOpen(false)
    setForm(createInitialForm(user))
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

    if (!form.requester_email.trim()) {
      setError(t('Bitte geben Sie eine E-Mail-Adresse ein.'))
      return
    }

    if (!form.subject.trim() || !form.message.trim()) {
      setError(t('Bitte füllen Sie Betreff und Nachricht aus.'))
      return
    }

    setIsSubmitting(true)

    try {
      const payload = {
        priority: form.priority,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim(),
        requester_email: form.requester_email.trim(),
        subject: form.subject.trim(),
        message: form.message.trim(),
      }

      if (publicMode) {
        await api.createPublicSupportTicket(payload)
      } else {
        await api.createSupportTicket(payload)
      }

      setSuccess(t('Ihre Support-Anfrage wurde gesendet.'))
      setForm(createInitialForm(user))
    } catch (requestError) {
      setError(t(requestError.message || 'Support-Anfrage konnte nicht gesendet werden.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const triggerButton = (
    <button
      type="button"
      className={buttonClassName}
      style={buttonStyle}
      onClick={openModal}
      aria-label={t('Support')}
      title={t('Support')}
    >
      <svg
        className="vergo-support-icon"
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        {/* Service icon: a cog offered on an open hand, matching the Vergo support mark. */}
        <circle cx="12" cy="6.4" r="1.9" />
        <path d="M12 1.6l.72 1.32 1.5-.17.34 1.47 1.4.57-.62 1.37.98 1.15-1.16.96.35 1.47-1.5.17-.73 1.31-1.28-.8-1.28.8-.73-1.31-1.5-.17.35-1.47-1.16-.96.98-1.15-.62-1.37 1.4-.57.34-1.47 1.5.17z" />
        <path d="M2.5 15.1c1.2-.85 2.5-.6 3.5.1l2.4 1.7h3.1c.83 0 1.5.6 1.5 1.35s-.67 1.35-1.5 1.35H9.1" />
        <path d="M8.4 16.9l6.9-1.9c1.9-.53 3.6-.6 4.9.05.9.45 1 1.5.2 2.1l-5.2 3.7c-.9.64-2 .95-3.1.85l-5.2-.5c-.7-.07-1.4.1-2 .48" />
      </svg>
    </button>
  )

  const modal = isOpen ? (
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
              <label className="form-label" htmlFor="support-first-name">{t('Vorname')}</label>
              <input
                id="support-first-name"
                className="form-control"
                value={form.first_name}
                onChange={(event) => updateField('first_name', event.target.value)}
                autoComplete="given-name"
              />
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="support-last-name">{t('Nachname')}</label>
              <input
                id="support-last-name"
                className="form-control"
                value={form.last_name}
                onChange={(event) => updateField('last_name', event.target.value)}
                autoComplete="family-name"
              />
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="support-email">{t('E-Mail-Adresse')}</label>
              <input
                id="support-email"
                className="form-control"
                type="email"
                value={form.requester_email}
                onChange={(event) => updateField('requester_email', event.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="support-phone">{t('Telefonnummer')}</label>
              <input
                id="support-phone"
                className="form-control"
                value={form.phone}
                onChange={(event) => updateField('phone', event.target.value)}
                autoComplete="tel"
              />
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
  ) : null

  return (
    <>
      {asNavItem ? <li className={wrapperClassName}>{triggerButton}</li> : triggerButton}
      {modal ? createPortal(modal, document.body) : null}
    </>
  )
}

export default SupportTicketButton
