import { useCallback, useEffect, useMemo, useState } from 'react'
import PageContent from '../components/PageContent'
import { api } from '../lib/api'
import { useLanguage } from '../context/LanguageContext'

const STATUS_OPTIONS = ['open', 'in_progress', 'resolved', 'closed']

const statusClassName = {
  open: 'bg-light-primary text-primary',
  in_progress: 'bg-light-warning text-warning',
  resolved: 'bg-light-success text-success',
  closed: 'bg-light-secondary text-secondary',
}

function formatDateTime(value) {
  if (!value) {
    return '-'
  }

  const date = new Date(value.replace(' ', 'T'))

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function statusLabel(status, t) {
  const labels = {
    open: 'Offen',
    in_progress: 'In Bearbeitung',
    resolved: 'Gelöst',
    closed: 'Geschlossen',
  }

  return t(labels[status] ?? status)
}

function requesterDisplayName(ticket) {
  const contactName = [ticket.first_name, ticket.last_name].filter(Boolean).join(' ').trim()

  return contactName || ticket.requester_name || '-'
}

function SupportTicketsPage() {
  const { t } = useLanguage()
  const [tickets, setTickets] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [savingTicketId, setSavingTicketId] = useState(null)
  const [expandedTicketId, setExpandedTicketId] = useState(null)

  const loadTickets = useCallback(async function loadTickets() {
    setIsLoading(true)
    setError('')

    try {
      const response = await api.getSupportTickets()
      setTickets(response.data ?? [])
    } catch (requestError) {
      setError(t(requestError.message || 'Support-Tickets konnten nicht geladen werden.'))
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadTickets()
  }, [loadTickets])

  const filteredTickets = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return tickets.filter((ticket) => {
      const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter

      if (!matchesStatus) {
        return false
      }

      if (!normalizedSearch) {
        return true
      }

      return [
        ticket.ticket_number,
        ticket.subject,
        ticket.message,
        ticket.requester_name,
        ticket.first_name,
        ticket.last_name,
        ticket.requester_email,
        ticket.phone,
        ticket.admin_comment,
      ].filter(Boolean).some((value) => String(value).toLowerCase().includes(normalizedSearch))
    })
  }, [searchTerm, statusFilter, tickets])

  const summaryStats = useMemo(() => {
    return STATUS_OPTIONS.reduce((stats, status) => ({
      ...stats,
      [status]: tickets.filter((ticket) => ticket.status === status).length,
    }), { total: tickets.length })
  }, [tickets])

  function updateLocalTicket(ticketId, field, value) {
    setTickets((current) => current.map((ticket) => (
      ticket.id === ticketId ? { ...ticket, [field]: value } : ticket
    )))
  }

  async function saveTicket(ticket) {
    setSavingTicketId(ticket.id)
    setMessage('')
    setError('')

    try {
      const response = await api.updateSupportTicket(ticket.id, {
        status: ticket.status,
        admin_notes: ticket.admin_notes || '',
        admin_comment: ticket.admin_comment || '',
      })

      setTickets((current) => current.map((item) => (
        item.id === ticket.id ? response.data : item
      )))
      setMessage(t('Support-Ticket wurde aktualisiert.'))
    } catch (requestError) {
      setError(t(requestError.message || 'Support-Ticket konnte nicht aktualisiert werden.'))
    } finally {
      setSavingTicketId(null)
    }
  }

  return (
    <PageContent
      title={t('Support-Tickets')}
      subtitle={t('Anfragen aus der Work-Plattform bearbeiten.')}
      breadcrumbs={[
        { label: t('Dashboard'), href: '/dashboard' },
        t('Support-Tickets'),
      ]}
    >
      <div className="vergo-support-shell">
        <div className="vergo-support-toolbar">
          <div className="vergo-support-stats">
            <div className="vergo-support-stat-card">
              <span>{t('Alle Tickets')}</span>
              <strong>{summaryStats.total}</strong>
            </div>
            <div className="vergo-support-stat-card">
              <span>{t('Offen')}</span>
              <strong>{summaryStats.open}</strong>
            </div>
            <div className="vergo-support-stat-card">
              <span>{t('In Bearbeitung')}</span>
              <strong>{summaryStats.in_progress}</strong>
            </div>
          </div>

          <div className="vergo-support-filters">
            <div className="vergo-support-search">
              <input
                id="support-ticket-search"
                className="form-control"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t('Nach Ticket, Betreff, Nachricht oder Absender suchen')}
              />
            </div>
            <div className="vergo-support-status-filter">
              <select
                id="support-ticket-status"
                className="form-select"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">{t('Alle Status')}</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>{statusLabel(status, t)}</option>
                ))}
              </select>
            </div>
            <div className="vergo-support-refresh">
              <button type="button" className="btn btn-light" onClick={loadTickets}>
                <i className="ti ti-refresh me-1"></i>
                {t('Aktualisieren')}
              </button>
            </div>
          </div>
        </div>

          {message ? <div className="alert alert-success">{message}</div> : null}
          {error ? <div className="alert alert-danger">{error}</div> : null}

          {isLoading ? (
            <div className="py-5 text-center text-muted">{t('Support-Tickets werden geladen...')}</div>
          ) : filteredTickets.length > 0 ? (
            <div className="vergo-support-ticket-list">
              {filteredTickets.map((ticket) => {
                const isExpanded = expandedTicketId === ticket.id

                return (
                  <div key={ticket.id} className={`vergo-support-ticket-card${isExpanded ? ' is-expanded' : ''}`}>
                    <button
                      type="button"
                      className="vergo-support-ticket-summary"
                      onClick={() => setExpandedTicketId(isExpanded ? null : ticket.id)}
                    >
                      <span className="vergo-support-ticket-id">{ticket.ticket_number}</span>
                      <span className="vergo-support-ticket-main">
                        <strong>{ticket.subject}</strong>
                        <small>{requesterDisplayName(ticket)} · {ticket.requester_email || '-'}</small>
                      </span>
                      <span className="vergo-support-ticket-badges">
                        <span className={`badge rounded-pill px-3 py-2 ${statusClassName[ticket.status] ?? 'bg-light-secondary text-secondary'}`}>
                          {statusLabel(ticket.status, t)}
                        </span>
                        {ticket.priority === 'urgent' ? (
                          <span className="badge rounded-pill bg-light-danger text-danger px-3 py-2">{t('Dringend')}</span>
                        ) : null}
                      </span>
                      <span className="vergo-support-ticket-date">{formatDateTime(ticket.created_at)}</span>
                      <span className="vergo-support-ticket-toggle">
                        {isExpanded ? t('Ausblenden') : t('Anzeigen')}
                        <i className={`ti ${isExpanded ? 'ti-chevron-up' : 'ti-chevron-down'}`}></i>
                      </span>
                    </button>

                    {isExpanded ? (
                      <div className="vergo-support-ticket-details">
                        <div className="vergo-support-ticket-thread">
                          <div className="vergo-support-ticket-contact">
                            <span>{t('Kontaktdaten')}</span>
                            <dl>
                              <div>
                                <dt>{t('Vorname')}</dt>
                                <dd>{ticket.first_name || '-'}</dd>
                              </div>
                              <div>
                                <dt>{t('Nachname')}</dt>
                                <dd>{ticket.last_name || '-'}</dd>
                              </div>
                              <div>
                                <dt>{t('E-Mail-Adresse')}</dt>
                                <dd>{ticket.requester_email || '-'}</dd>
                              </div>
                              <div>
                                <dt>{t('Telefonnummer')}</dt>
                                <dd>{ticket.phone || '-'}</dd>
                              </div>
                            </dl>
                          </div>

                          <div className="vergo-support-ticket-message">
                            <span>{t('Anfrage')}</span>
                            <p>{ticket.message}</p>
                          </div>
                        </div>

                        <div className="vergo-support-ticket-edit">
                          <div>
                            <label className="form-label" htmlFor={`ticket-status-${ticket.id}`}>{t('Status')}</label>
                            <select
                              id={`ticket-status-${ticket.id}`}
                              className="form-select"
                              value={ticket.status}
                              onChange={(event) => updateLocalTicket(ticket.id, 'status', event.target.value)}
                            >
                              {STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>{statusLabel(status, t)}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="form-label" htmlFor={`ticket-notes-${ticket.id}`}>{t('Interne Notizen')}</label>
                            <textarea
                              id={`ticket-notes-${ticket.id}`}
                              className="form-control"
                              rows="2"
                              value={ticket.admin_notes || ''}
                              onChange={(event) => updateLocalTicket(ticket.id, 'admin_notes', event.target.value)}
                              placeholder={t('Notiz für das Vergo-Team')}
                            />
                          </div>
                          <div className="vergo-support-ticket-comment">
                            <label className="form-label" htmlFor={`ticket-comment-${ticket.id}`}>{t('Kommentar an Anfragenden')}</label>
                            <textarea
                              id={`ticket-comment-${ticket.id}`}
                              className="form-control"
                              rows="3"
                              value={ticket.admin_comment || ''}
                              onChange={(event) => updateLocalTicket(ticket.id, 'admin_comment', event.target.value)}
                              placeholder={t('Nachricht an den Ticket-Ersteller')}
                            />
                            <div className="form-text">{t('Wird per E-Mail an den Ersteller gesendet.')}</div>
                          </div>
                          <div className="vergo-support-ticket-save">
                            <button
                              type="button"
                              className="btn btn-primary"
                              disabled={savingTicketId === ticket.id}
                              onClick={() => saveTicket(ticket)}
                            >
                              {savingTicketId === ticket.id ? t('Wird gespeichert...') : t('Speichern')}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="py-5 text-center text-muted">{t('Keine Support-Tickets gefunden.')}</div>
          )}
      </div>
    </PageContent>
  )
}

export default SupportTicketsPage
