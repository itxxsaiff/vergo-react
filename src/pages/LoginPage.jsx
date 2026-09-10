import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import AuthSplitShell from '../components/AuthSplitShell'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { api } from '../lib/api'

const LI_STORAGE_KEY = 'vergo_manager_li_number'

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
  const { t } = useLanguage()
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



  async function handleLiSubmit(event) {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      const response = await api.checkManagerLi({ li_number: liNumber })
      sessionStorage.setItem(LI_STORAGE_KEY, response.data.li_number)
      setPropertyTitle(response.data.property_title ?? '')
      setOtpSentMessage('')
      setStep('email')
    } catch (submitError) {
      setError(t(submitError.message))
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

      const sentSuffix = t('gesendet.')
      setOtpSentMessage(`${t('Wir haben einen Anmeldecode an')} ${response.data?.email ?? email.trim().toLowerCase()}${sentSuffix === '.' ? '.' : ` ${sentSuffix}`}`)
      setStep('otp')
    } catch (submitError) {
      setError(t(submitError.message))
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
      setError(t(submitError.message))
    } finally {
      setIsSubmitting(false)
    }
  }

  // The field accepts "LI-10001" and keeps the prefix and digits in step, so
  // the rest of the flow is unchanged.
  function handleLiNumberChange(event) {
    const raw = event.target.value
    const { prefix, number } = splitLiNumber(raw.includes('-') ? raw : `${raw.slice(0, 2)}-${raw.slice(2)}`)
    const nextPrefix = prefix.replace(/[^a-zA-Z]/g, '').slice(0, 2)
    const nextDigits = number.replace(/\D/g, '').slice(0, 5)

    setLiPrefix(nextPrefix)
    setLiDigits(nextDigits)
    setLiNumber(formatLiNumber(nextPrefix, nextDigits))
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
      index: 1,
      title: 'Liegenschaft erfassen',
      subtitle: 'Bitte geben Sie die Liegenschafts-Nummer (LI) ein, für die Sie einen Auftrag erfassen möchten.',
    },
    email: {
      index: 2,
      title: 'E-Mail-Adresse bestätigen',
      subtitle: 'Verwenden Sie eine E-Mail-Adresse mit einer für diese Immobilie zugelassenen Domain, um Ihren Anmeldecode zu erhalten.',
    },
    otp: {
      index: 3,
      title: 'Code eingeben',
      subtitle: 'Prüfen Sie Ihre E-Mails und geben Sie den 6-stelligen Code ein, um auf das Verwalterportal zuzugreifen.',
    },
  }

  // The message laid over the photo, same on every step of this flow.
  const mediaContent = {
    headline: t('Intelligente Bewirtschaftung für lebenswerte Immobilien.'),
    features: [
      { icon: 'ti ti-stack-2', label: t('Digital') },
      { icon: 'ti ti-bolt', label: t('Effizient') },
      { icon: 'ti ti-leaf', label: t('Nachhaltig') },
    ],
    caption: t('Gemeinsam für eine smartere Immobilienwelt.'),
  }

  return (
    <AuthSplitShell
      title={t(contentByStep[step].title)}
      subtitle={t(contentByStep[step].subtitle)}
      logoHref="/type"
      imageSrc="/assets/images/ui-images/property-number-page.png"
      backLink={{ to: '/type', label: t('Zurück zur Auswahl') }}
      step={{ index: contentByStep[step].index, label: `${t('Schritt')} ${contentByStep[step].index} ${t('von')} 3` }}
      stepCount={3}
      media={mediaContent}
    >
      {step === 'li' ? (
        <form onSubmit={handleLiSubmit}>
          <label className="vergo-auth-label" htmlFor="vergo-li-number">{t('LI-Nummer')}</label>
          {/* One field rather than two: the prefix and the digits are split
              behind the scenes, but a person just types LI-10001. */}
          <div className="vergo-auth-field">
            <i className="ti ti-building"></i>
            <input
              id="vergo-li-number"
              ref={secondInputRef}
              value={liNumber}
              onChange={handleLiNumberChange}
              placeholder={t('z. B. LI-10001')}
              autoComplete="off"
              required
            />
          </div>

          {error ? <div className="alert alert-danger py-2 mt-3 mb-0">{t(error)}</div> : null}

          <button
            className="vergo-auth-submit mt-4"
            type="submit"
            disabled={isSubmitting || liPrefix.length < 2 || liDigits.length < 1}
          >
            <span>{isSubmitting ? t('Wird geprüft...') : t('Weiter')}</span>
            <i className="ti ti-arrow-right"></i>
          </button>
        </form>
      ) : null}

      {step === 'email' ? (
        <form onSubmit={handleRequestOtp}>
          <div className="mb-3">
            <label className="form-label">{t('Li-Nummer')}</label>
            <div className="input-group">
              <input className="form-control" value={liNumber} readOnly />
              <button type="button" className="btn btn-light" onClick={resetLiFlow}>
                {t('Ändern')}
              </button>
            </div>
            {propertyTitle ? <small className="text-muted">{propertyTitle}</small> : null}
          </div>

          <div className="mb-3">
            <label className="form-label">{t('E-Mail')}</label>
            <input
              type="email"
              className="form-control"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          {error ? <div className="alert alert-danger py-2 mt-3 mb-0">{t(error)}</div> : null}

          <div className="mt-3 d-grid">
            <button className="btn vergo-type-continue mb-3 rounded-2" type="submit" disabled={isSubmitting}>
              <span className="vergo-type-continue-label">{isSubmitting ? t('OTP wird gesendet...') : t('OTP senden')}</span>
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
            <label className="form-label">{t('Li-Nummer')}</label>
            <input className="form-control" value={liNumber} readOnly />
          </div>

          <div className="mb-3">
            <label className="form-label">{t('E-Mail')}</label>
            <input className="form-control" value={email} readOnly />
          </div>

          <div className="mb-3">
            <label className="form-label">{t('OTP-Code')}</label>
            <input
              className="form-control"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength="6"
              required
            />
          </div>

          {otpSentMessage ? <div className="alert alert-success py-2">{otpSentMessage}</div> : null}

          {error ? <div className="alert alert-danger py-2 mt-3 mb-0">{t(error)}</div> : null}

          <div className="mt-3 d-grid">
            <button className="btn vergo-type-continue mb-3 rounded-2" type="submit" disabled={isSubmitting}>
              <span className="vergo-type-continue-label">{isSubmitting ? t('Wird geprüft...') : t('Code bestätigen')}</span>
              <span className="vergo-type-continue-icon" aria-hidden="true">
                <i className="ti ti-arrow-right"></i>
              </span>
            </button>
          </div>

          <div className="mt-3 text-center">
            <button type="button" className="btn btn-link p-0 text-primary" onClick={() => setStep('email')}>
              {t('Code erneut senden')}
            </button>
          </div>
        </form>
      ) : null}
    </AuthSplitShell>
  )
}

export default LoginPage
