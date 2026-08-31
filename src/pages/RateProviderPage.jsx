import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import AuthShell from '../components/AuthShell'
import { useLanguage } from '../context/LanguageContext'
import { api } from '../lib/api'
import { immersiveAuthShellProps, useImmersiveAuthBackgroundStyle } from '../lib/immersiveAuth'

const REASON_REQUIRED_AT_OR_BELOW = 2

function RateProviderPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const { t } = useLanguage()
  const backgroundStyle = useImmersiveAuthBackgroundStyle()

  const [details, setDetails] = useState(null)
  const [rating, setRating] = useState(0)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDone, setIsDone] = useState(false)

  useEffect(() => {
    if (!token) {
      setError(t('Dieser Bewertungslink ist ungültig.'))
      setIsLoading(false)
      return
    }

    api.getProviderRating(token)
      .then((response) => {
        setDetails(response.data ?? null)
        setIsDone(Boolean(response.data?.already_rated))
      })
      .catch((loadError) => setError(t(loadError.message)))
      .finally(() => setIsLoading(false))
  }, [token, t])

  const reasonRequired = rating > 0 && rating <= REASON_REQUIRED_AT_OR_BELOW

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (!rating) {
      setError(t('Bitte wählen Sie eine Bewertung von 1 bis 5 Sternen.'))
      return
    }

    if (reasonRequired && !reason.trim()) {
      setError(t('Bei 1 oder 2 Sternen ist eine Begründung erforderlich.'))
      return
    }

    setIsSubmitting(true)

    try {
      await api.submitProviderRating({ token, rating, reason: reason.trim() || null })
      setIsDone(true)
    } catch (submitError) {
      setError(t(submitError.message))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell
      title={t('Dienstleister bewerten')}
      subtitle={details?.order_number ? `${details.order_number} - ${details.title ?? ''}` : ''}
      logoHref="/type"
      backgroundStyle={backgroundStyle}
      {...immersiveAuthShellProps}
    >
      {isLoading ? <div className="text-muted">{t('Wird geladen...')}</div> : null}

      {!isLoading && isDone ? (
        <div className="alert alert-success mb-0">
          {t('Vielen Dank für Ihre Bewertung.')}
        </div>
      ) : null}

      {!isLoading && !isDone ? (
        <form onSubmit={handleSubmit}>
          {details?.provider_name ? (
            <p className="text-muted">
              {t('Wie zufrieden waren Sie mit')} <strong>{details.provider_name}</strong>?
            </p>
          ) : null}

          <div className="d-flex gap-2 mb-3" role="radiogroup" aria-label={t('Bewertung')}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className={`btn ${star <= rating ? 'btn-primary' : 'btn-light border'}`}
                aria-pressed={star === rating}
                onClick={() => setRating(star)}
              >
                <i className="ti ti-star-filled"></i> {star}
              </button>
            ))}
          </div>

          <div className="mb-3">
            <label className="form-label">
              {t('Begründung')}{reasonRequired ? ' *' : ` (${t('optional')})`}
            </label>
            <textarea
              className="form-control"
              rows="4"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required={reasonRequired}
            ></textarea>
            {reasonRequired ? (
              <div className="form-text text-danger">
                {t('Bei 1 oder 2 Sternen ist eine Begründung erforderlich.')}
              </div>
            ) : null}
          </div>

          {error ? <div className="alert alert-danger py-2">{error}</div> : null}

          <div className="d-grid">
            <button className="btn vergo-type-continue rounded-2" type="submit" disabled={isSubmitting}>
              <span className="vergo-type-continue-label">
                {isSubmitting ? t('Wird gesendet...') : t('Bewertung senden')}
              </span>
              <span className="vergo-type-continue-icon" aria-hidden="true"><i className="ti ti-arrow-right"></i></span>
            </button>
          </div>

          <p className="text-muted small mt-3 mb-0">
            {t('Ihre Bewertung ist vertraulich. Weder der Dienstleister noch andere Auftraggeber sehen sie.')}
          </p>
        </form>
      ) : null}

      {!isLoading && error && !details ? <div className="alert alert-danger mb-0">{error}</div> : null}
    </AuthShell>
  )
}

export default RateProviderPage
