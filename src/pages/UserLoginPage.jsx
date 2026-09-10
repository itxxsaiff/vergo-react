import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import AuthSplitShell from '../components/AuthSplitShell'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'

const initialForm = {
  email: '',
  password: '',
}

function UserLoginPage() {
  const navigate = useNavigate()
  const { isAuthenticated, login } = useAuth()
  const { t } = useLanguage()
  const [form, setForm] = useState(initialForm)
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
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

  // The message laid over the photo, matching the other public screens.
  const mediaContent = {
    headline: `${t('Mehr Transparenz.')}\n${t('Mehr Effizienz.')}\n${t('Mehr Lebensqualität.')}`,
    features: [
      { icon: 'ti ti-stack-2', label: t('Digital') },
      { icon: 'ti ti-bolt', label: t('Effizient') },
      { icon: 'ti ti-leaf', label: t('Nachhaltig') },
    ],
    caption: t('Gemeinsam für eine smarte Immobilienwelt.'),
  }

  return (
    <AuthSplitShell
      title={t('Administrator-Anmeldung')}
      subtitle={t('Bitte melden Sie sich mit Ihrer E-Mail-Adresse und Ihrem Passwort an.')}
      logoHref="/admin-login"
      imageSrc="/assets/images/ui-images/otp-page.png"
      media={mediaContent}
    >
      <form onSubmit={handleSubmit}>
        <label className="vergo-auth-label" htmlFor="vergo-admin-email">{t('E-Mail-Adresse')}</label>
        <div className="vergo-auth-field">
          <i className="ti ti-mail"></i>
          <input
            id="vergo-admin-email"
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder={t('z. B. name@beispiel.ch')}
            autoComplete="email"
            required
          />
        </div>

        <label className="vergo-auth-label mt-4" htmlFor="vergo-admin-password">{t('Passwort')}</label>
        <div className="vergo-auth-field">
          <i className="ti ti-lock"></i>
          <input
            id="vergo-admin-password"
            type={isPasswordVisible ? 'text' : 'password'}
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder={t('Passwort eingeben')}
            autoComplete="current-password"
            required
          />
          {/* Typing a password blind is the usual cause of a failed sign-in. */}
          <button
            type="button"
            className="vergo-auth-field-toggle"
            onClick={() => setIsPasswordVisible((current) => !current)}
            aria-label={isPasswordVisible ? t('Passwort verbergen') : t('Passwort anzeigen')}
            title={isPasswordVisible ? t('Passwort verbergen') : t('Passwort anzeigen')}
          >
            <i className={isPasswordVisible ? 'ti ti-eye-off' : 'ti ti-eye'}></i>
          </button>
        </div>

        {error ? <div className="alert alert-danger py-2 mt-3 mb-0">{error}</div> : null}

        <button
          className="vergo-auth-submit mt-4"
          type="submit"
          disabled={isSubmitting || !form.email.trim() || !form.password}
        >
          <span>{isSubmitting ? t('Anmeldung läuft...') : t('Anmelden')}</span>
          <i className="ti ti-arrow-right"></i>
        </button>
      </form>
    </AuthSplitShell>
  )
}

export default UserLoginPage
