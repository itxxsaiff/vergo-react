import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import AuthShell from '../components/AuthShell'
import { useAuth } from '../context/AuthContext'
import { EMAIL_OTP_LOGIN_ACCESS_KEY, USER_LOGIN_ACCESS_KEY } from '../constants/auth'
import { api } from '../lib/api'
import { immersiveAuthShellProps, useImmersiveAuthBackgroundStyle } from '../lib/immersiveAuth'

const LI_STORAGE_KEY = 'vergo_manager_li_number'
const USER_LOGIN_OVERRIDE = {
  prefix: 'An',
  digits: '12345',
}

function splitLiNumber(value) {
  const [prefix = '', number = ''] = value.split('-')

  return { prefix, number }
}

function formatLiNumber(prefix, number) {
  const normalizedPrefix = prefix.replace(/[^a-zA-Z]/g, '').slice(0, 2)
  const normalizedNumber = number.replace(/\D/g, '').slice(0, 5)

  if (!normalizedPrefix && !normalizedNumber) {
    return ''
  }

  const formattedPrefix = normalizedPrefix
    ? normalizedPrefix.charAt(0).toUpperCase() + normalizedPrefix.slice(1).toLowerCase()
    : ''

  return `${formattedPrefix}${normalizedNumber ? `-${normalizedNumber}` : ''}`
}

function LoginPage() {
  const navigate = useNavigate()
  const secondInputRef = useRef(null)
  const { isAuthenticated, requestManagerOtp, verifyManagerOtp } = useAuth()
  const backgroundStyle = useImmersiveAuthBackgroundStyle()
  const [step, setStep] = useState('li')
  const [liPrefix, setLiPrefix] = useState('')
  const [liDigits, setLiDigits] = useState('')
  const [liNumber, setLiNumber] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [propertyTitle, setPropertyTitle] = useState('')
  const [otpSentMessage, setOtpSentMessage] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const storedLiNumber = sessionStorage.getItem(LI_STORAGE_KEY)

    if (storedLiNumber) {
      const { prefix, number } = splitLiNumber(storedLiNumber)
      setLiPrefix(prefix)
      setLiDigits(number)
      setLiNumber(storedLiNumber)
      setStep('email')
    }
  }, [])

  useEffect(() => {
    setLiNumber(formatLiNumber(liPrefix, liDigits))
  }, [liPrefix, liDigits])

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  function handlePrefixChange(event) {
    const value = event.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 2)
    setLiPrefix(value)

    if (value.length === 2) {
      secondInputRef.current?.focus()
    }
  }

  function handleDigitsChange(event) {
    setLiDigits(event.target.value.replace(/\D/g, '').slice(0, 5))
  }

  async function handleLiSubmit(event) {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      if (
        liPrefix.toLowerCase() === USER_LOGIN_OVERRIDE.prefix.toLowerCase()
        && liDigits === USER_LOGIN_OVERRIDE.digits
      ) {
        sessionStorage.removeItem(EMAIL_OTP_LOGIN_ACCESS_KEY)
        sessionStorage.setItem(USER_LOGIN_ACCESS_KEY, 'granted')
        navigate('/user-login', { replace: true })
        return
      }

      const response = await api.checkManagerLi({ li_number: liNumber })
      sessionStorage.setItem(LI_STORAGE_KEY, response.data.li_number)
      setPropertyTitle(response.data.property_title ?? '')
      setOtpSentMessage('')
      setStep('email')
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleRequestOtp(event) {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      const response = await requestManagerOtp({
        li_number: liNumber,
        email: email.trim().toLowerCase(),
      })

      setOtpSentMessage(`Wir haben einen Anmeldecode an ${response.data?.email ?? email.trim().toLowerCase()} gesendet.`)
      setStep('otp')
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleVerifyOtp(event) {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      const loggedInUser = await verifyManagerOtp({
        li_number: liNumber,
        email: email.trim().toLowerCase(),
        code,
      })
      sessionStorage.removeItem(LI_STORAGE_KEY)
      navigate(loggedInUser?.home_path ?? '/dashboard', { replace: true })
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  function resetLiFlow() {
    sessionStorage.removeItem(LI_STORAGE_KEY)
    setStep('li')
    setLiPrefix('')
    setLiDigits('')
    setLiNumber('')
    setEmail('')
    setCode('')
    setPropertyTitle('')
    setOtpSentMessage('')
    setError('')
  }

  const contentByStep = {
    li: {
      title: 'Anmeldung',
      subtitle: 'Geben Sie die Li-Nummer der Immobilie ein, um fortzufahren.',
    },
    email: {
      title: 'E-Mail-Adresse bestätigen',
      subtitle: 'Verwenden Sie eine E-Mail-Adresse mit einer für diese Immobilie zugelassenen Domain, um Ihren Anmeldecode zu erhalten.',
    },
    otp: {
      title: 'Code eingeben',
      subtitle: 'Prüfen Sie Ihre E-Mails und geben Sie den 6-stelligen Code ein, um auf das Verwalterportal zuzugreifen.',
    },
  }

  return (
    <AuthShell

      title={contentByStep[step].title}
      // subtitle={contentByStep[step].subtitle}
      logoHref="/login"
      backgroundStyle={backgroundStyle}
      {...immersiveAuthShellProps}
      footer={<Link className="text-primary fw-medium" to="/type">Zurück</Link>}
    >
      {step === 'li' ? (
        <form onSubmit={handleLiSubmit}>
          <div className="row">
            <div className="col-4">
              <div className="mb-3">
                <label className="form-label">Zeichen</label>
                <input
                  className="form-control text-uppercase"
                  value={liPrefix}
                  onChange={handlePrefixChange}
                  maxLength="2"
                  required
                />
              </div>
            </div>

            <div className="col-8">
              <div className="mb-3">
                <label className="form-label">ID</label>
                <input
                  ref={secondInputRef}
                  className="form-control"
                  value={liDigits}
                  onChange={handleDigitsChange}
                  maxLength="5"
                  required
                />
              </div>
            </div>
          </div>

          {error ? <div className="alert alert-danger py-2 mt-3 mb-0">{error}</div> : null}

          <div className="mt-3 d-grid">
            <button
              className="btn vergo-type-continue mb-3 rounded-2"
              type="submit"
              disabled={isSubmitting || liPrefix.length < 2 || liDigits.length < 1}
            >
              <span className="vergo-type-continue-label">{isSubmitting ? 'Wird geprüft...' : 'Anmelden'}</span>
              <span className="vergo-type-continue-icon" aria-hidden="true">
                <i className="ti ti-arrow-right"></i>
              </span>
            </button>
          </div>
        </form>
      ) : null}

      {step === 'email' ? (
        <form onSubmit={handleRequestOtp}>
          <div className="mb-3">
            <label className="form-label">Li-Nummer</label>
            <div className="input-group">
              <input className="form-control" value={liNumber} readOnly />
              <button type="button" className="btn btn-light" onClick={resetLiFlow}>
                Ändern
              </button>
            </div>
            {propertyTitle ? <small className="text-muted">{propertyTitle}</small> : null}
          </div>

          <div className="mb-3">
            <label className="form-label">E-Mail</label>
            <input
              type="email"
              className="form-control"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          {error ? <div className="alert alert-danger py-2 mt-3 mb-0">{error}</div> : null}

          <div className="mt-3 d-grid">
            <button className="btn vergo-type-continue mb-3 rounded-2" type="submit" disabled={isSubmitting}>
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
            <label className="form-label">Li-Nummer</label>
            <input className="form-control" value={liNumber} readOnly />
          </div>

          <div className="mb-3">
            <label className="form-label">E-Mail</label>
            <input className="form-control" value={email} readOnly />
          </div>

          <div className="mb-3">
            <label className="form-label">OTP-Code</label>
            <input
              className="form-control"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength="6"
              required
            />
          </div>

          {otpSentMessage ? <div className="alert alert-success py-2">{otpSentMessage}</div> : null}

          {error ? <div className="alert alert-danger py-2 mt-3 mb-0">{error}</div> : null}

          <div className="mt-3 d-grid">
            <button className="btn vergo-type-continue mb-3 rounded-2" type="submit" disabled={isSubmitting}>
              <span className="vergo-type-continue-label">{isSubmitting ? 'Wird geprüft...' : 'Code bestätigen'}</span>
              <span className="vergo-type-continue-icon" aria-hidden="true">
                <i className="ti ti-arrow-right"></i>
              </span>
            </button>
          </div>

          <div className="mt-3 text-center">
            <button type="button" className="btn btn-link p-0 text-primary" onClick={() => setStep('email')}>
              Code erneut senden
            </button>
          </div>
        </form>
      ) : null}
    </AuthShell>
  )
}

export default LoginPage
