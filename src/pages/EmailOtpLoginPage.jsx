import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import AuthShell from '../components/AuthShell'
import { EMAIL_OTP_LOGIN_ACCESS_KEY } from '../constants/auth'
import { useAuth } from '../context/AuthContext'
import { immersiveAuthShellProps, useImmersiveAuthBackgroundStyle } from '../lib/immersiveAuth'

const initialForm = {
  email: '',
  code: '',
}

function EmailOtpLoginPage() {
  const navigate = useNavigate()
  const { isAuthenticated, requestUserOtp, verifyUserOtp } = useAuth()
  const backgroundStyle = useImmersiveAuthBackgroundStyle()
  const [form, setForm] = useState(initialForm)
  const [step, setStep] = useState('email')
  const [otpSentMessage, setOtpSentMessage] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasAccess] = useState(() => sessionStorage.getItem(EMAIL_OTP_LOGIN_ACCESS_KEY) === 'granted')

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  if (!hasAccess) {
    return <Navigate to="/type" replace />
  }

  function handleChange(event) {
    const { name, value } = event.target

    setForm((current) => ({
      ...current,
      [name]: name === 'code' ? value.replace(/\D/g, '').slice(0, 6) : value,
    }))
  }

  async function sendOtp() {
    setIsSubmitting(true)
    setError('')

    try {
      const normalizedEmail = form.email.trim().toLowerCase()
      const response = await requestUserOtp({ email: normalizedEmail })

      setForm((current) => ({
        ...current,
        email: response.data?.email ?? normalizedEmail,
        code: '',
      }))
      setOtpSentMessage(`Wir haben einen Anmeldecode an ${response.data?.email ?? normalizedEmail} gesendet.`)
      setStep('otp')
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleRequestOtp(event) {
    event.preventDefault()
    await sendOtp()
  }

  async function handleVerifyOtp(event) {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      const loggedInUser = await verifyUserOtp({
        email: form.email.trim().toLowerCase(),
        code: form.code,
      })
      sessionStorage.removeItem(EMAIL_OTP_LOGIN_ACCESS_KEY)
      navigate(loggedInUser?.home_path ?? '/orders', { replace: true })
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  function resetEmailStep() {
    setStep('email')
    setForm((current) => ({
      ...current,
      code: '',
    }))
    setOtpSentMessage('')
    setError('')
  }

  const contentByStep = {
    email: {
      title: 'Benutzeranmeldung',
      subtitle: 'Geben Sie Ihre E-Mail-Adresse ein, um einen Login-Code zu erhalten.',
    },
    otp: {
      title: 'Code eingeben',
      subtitle: 'Prüfen Sie Ihre E-Mails und geben Sie den 6-stelligen Code ein.',
    },
  }

  return (
    <AuthShell
      title={contentByStep[step].title}
      subtitle={contentByStep[step].subtitle}
      logoHref="/email-otp-login"
      backgroundStyle={backgroundStyle}
      {...immersiveAuthShellProps}
      footer={<Link className="text-primary fw-medium" to="/type">Zurück</Link>}
    >
      {step === 'email' ? (
        <form onSubmit={handleRequestOtp}>
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

          {error ? <div className="alert alert-danger py-2">{error}</div> : null}

          <div className="mt-3 d-grid">
            <button
              className="btn vergo-type-continue mb-4 rounded-2"
              type="submit"
              disabled={isSubmitting || !form.email.trim()}
            >
              <span className="vergo-type-continue-label">{isSubmitting ? 'OTP wird gesendet...' : 'OTP senden'}</span>
              <span className="vergo-type-continue-icon" aria-hidden="true">
                <i className="ti ti-arrow-right"></i>
              </span>
            </button>
          </div>
        </form>
      ) : null}

      {step === 'otp' ? (
        <form onSubmit={handleVerifyOtp}>
          <div className="mb-3">
            <label className="form-label">E-Mail</label>
            <div className="input-group">
              <input
                type="email"
                className="form-control"
                name="email"
                value={form.email}
                readOnly
              />
              <button type="button" className="btn btn-light" onClick={resetEmailStep}>
                Ändern
              </button>
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label">OTP-Code</label>
            <input
              className="form-control"
              name="code"
              value={form.code}
              onChange={handleChange}
              maxLength="6"
              required
            />
          </div>

          {otpSentMessage ? <div className="alert alert-success py-2">{otpSentMessage}</div> : null}
          {error ? <div className="alert alert-danger py-2">{error}</div> : null}

          <div className="mt-3 d-grid">
            <button
              className="btn vergo-type-continue mb-3 rounded-2"
              type="submit"
              disabled={isSubmitting || form.code.length !== 6}
            >
              <span className="vergo-type-continue-label">{isSubmitting ? 'Wird geprüft...' : 'Code bestätigen'}</span>
              <span className="vergo-type-continue-icon" aria-hidden="true">
                <i className="ti ti-arrow-right"></i>
              </span>
            </button>
          </div>

          <div className="mt-3 text-center">
            <button
              type="button"
              className="btn btn-link p-0 text-primary"
              onClick={sendOtp}
              disabled={isSubmitting || !form.email.trim()}
            >
              Code erneut senden
            </button>
          </div>
        </form>
      ) : null}
    </AuthShell>
  )
}

export default EmailOtpLoginPage
