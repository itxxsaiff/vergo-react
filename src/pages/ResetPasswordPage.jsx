import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import AuthShell from '../components/AuthShell'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { api } from '../lib/api'
import { immersiveAuthShellProps, useImmersiveAuthBackgroundStyle } from '../lib/immersiveAuth'

function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isAuthenticated } = useAuth()
  const { t } = useLanguage()
  const backgroundStyle = useImmersiveAuthBackgroundStyle()
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const token = searchParams.get('token') || ''
  const email = searchParams.get('email') || ''

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')
    setSuccess('')

    try {
      await api.resetPassword({
        token,
        email,
        password,
        password_confirmation: passwordConfirmation,
      })
      setSuccess(t('Passwort erfolgreich zurückgesetzt.'))
      window.setTimeout(() => {
        navigate('/user-login', { replace: true })
      }, 1200)
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell
      title={t('Passwort zurücksetzen')}
      subtitle={t('Legen Sie ein neues Passwort für Ihr Vergo-Konto fest.')}
      logoHref="/reset-password"
      backgroundStyle={backgroundStyle}
      {...immersiveAuthShellProps}
      footer={<Link className="text-primary fw-medium" to="/type">{t('Zurück')}</Link>}
    >
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label">{t('E-Mail')}</label>
          <input type="email" className="form-control" value={email} readOnly />
        </div>

        <div className="mb-3">
          <label className="form-label">{t('Neues Passwort')}</label>
          <input type="password" className="form-control" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </div>

        <div className="mb-3">
          <label className="form-label">{t('Passwort bestätigen')}</label>
          <input type="password" className="form-control" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} required />
        </div>

        {error ? <div className="alert alert-danger py-2">{error}</div> : null}
        {success ? <div className="alert alert-success py-2">{success}</div> : null}

        <div className="mt-3 d-grid">
          <button className="btn vergo-type-continue mb-4 rounded-2" type="submit" disabled={isSubmitting || !token || !email}>
            <span className="vergo-type-continue-label">{isSubmitting ? t('Wird gespeichert...') : t('Passwort speichern')}</span>
            <span className="vergo-type-continue-icon" aria-hidden="true">
              <i className="ti ti-arrow-right"></i>
            </span>
          </button>
        </div>
      </form>
    </AuthShell>
  )
}

export default ResetPasswordPage
