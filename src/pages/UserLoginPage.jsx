import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import AuthShell from '../components/AuthShell'
import { USER_LOGIN_ACCESS_KEY } from '../constants/auth'
import { useAuth } from '../context/AuthContext'
import { immersiveAuthShellProps, useImmersiveAuthBackgroundStyle } from '../lib/immersiveAuth'

const initialForm = {
  email: '',
  password: '',
}

function UserLoginPage() {
  const navigate = useNavigate()
  const { isAuthenticated, login } = useAuth()
  const backgroundStyle = useImmersiveAuthBackgroundStyle()
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasAccess] = useState(() => sessionStorage.getItem(USER_LOGIN_ACCESS_KEY) === 'granted')

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  if (!hasAccess) {
    return <Navigate to="/login" replace />
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
      await login(form)
      sessionStorage.removeItem(USER_LOGIN_ACCESS_KEY)
      navigate('/dashboard', { replace: true })
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Benutzeranmeldung"
      subtitle="Melden Sie sich mit Ihrer E-Mail-Adresse und Ihrem Passwort an."
      logoHref="/user-login"
      backgroundStyle={backgroundStyle}
      {...immersiveAuthShellProps}
      footer={<Link className="text-primary fw-medium" to="/login">Zurück</Link>}
    >
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label">E-Mail</label>
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
          <label className="form-label">Passwort</label>
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
            <span className="vergo-type-continue-label">{isSubmitting ? 'Anmeldung läuft...' : 'Anmelden'}</span>
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
