import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import AuthShell from '../components/AuthShell'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { immersiveAuthShellProps, useImmersiveAuthBackgroundStyle } from '../lib/immersiveAuth'

const initialForm = {
  email: '',
  password: '',
}

function UserLoginPage() {
  const navigate = useNavigate()
  const { isAuthenticated, login } = useAuth()
  const { t } = useLanguage()
  const backgroundStyle = useImmersiveAuthBackgroundStyle()
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  function handleChange(event) {
    const { name, value } = event.target

    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      const loggedInUser = await login(form)
      navigate(loggedInUser?.home_path ?? '/dashboard', { replace: true })
    } catch (submitError) {
      setError(t(submitError.message))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell
      title={t('Administrator-Anmeldung')}
      subtitle={t('Melden Sie sich mit Ihrer E-Mail-Adresse und Ihrem Passwort an.')}
      logoHref="/admin-login"
      backgroundStyle={backgroundStyle}
      {...immersiveAuthShellProps}
      footer={<Link className="text-primary fw-medium" to="/type">{t('Zurück')}</Link>}
    >
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label">{t('E-Mail')}</label>
          <input
            type="email"
            className="form-control"
            name="email"
            value={form.email}
            onChange={handleChange}
            required
          />
        </div>

        <div className="mb-3">
          <label className="form-label">{t('Passwort')}</label>
          <input
            type="password"
            className="form-control"
            name="password"
            value={form.password}
            onChange={handleChange}
            required
          />
        </div>

        {error ? <div className="alert alert-danger py-2">{error}</div> : null}

        <div className="mt-3 d-grid">
          <button className="btn vergo-type-continue mb-4 rounded-2" type="submit" disabled={isSubmitting}>
            <span className="vergo-type-continue-label">{isSubmitting ? t('Anmeldung läuft...') : t('Anmelden')}</span>
            <span className="vergo-type-continue-icon" aria-hidden="true">
              <i className="ti ti-arrow-right"></i>
            </span>
          </button>
        </div>
      </form>
    </AuthShell>
  )
}

export default UserLoginPage
