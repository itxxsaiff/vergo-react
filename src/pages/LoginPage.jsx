import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import AuthSplitShell from '../components/AuthSplitShell'
import CodeInput from '../components/CodeInput'
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
  // A short wait before the code can be sent again, so a slow mail server is
  // not hammered by repeated clicks.
  const [resendSeconds, setResendSeconds] = useState(0)
  const [propertyTitle, setPropertyTitle] = useState('')
  const [otpSentMessage, setOtpSentMessage] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Countdown for the resend link.
  useEffect(() => {
    if (resendSeconds <= 0) {
      return undefined
    }

    const timerId = window.setTimeout(() => setResendSeconds((current) => current - 1), 1000)

    return () => window.clearTimeout(timerId)
  }, [resendSeconds])

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





  async function handleResendCode() {
    if (resendSeconds > 0) {
      return
    }

    setError('')
    setIsSubmitting(true)

    try {
      await requestManagerOtp({ li_number: liNumber, email })
      setOtpSentMessage(t('Wir haben Ihnen einen neuen Code gesendet.'))
      setCode('')
      setResendSeconds(60)
    } catch (resendError) {
      setError(resendError.message)
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
      index: 1,
      title: 'Liegenschaft erfassen',
      subtitle: 'Bitte geben Sie die Liegenschafts-Nummer (LI) ein, für die Sie einen Auftrag erfassen möchten.',
    },
    email: {
      index: 2,
      title: 'E-Mail-Adresse eingeben',
      subtitle: 'Bitte geben Sie Ihre E-Mail-Adresse ein. Wir verwenden diese, um Ihnen einen Bestätigungscode zu senden.',
    },
    otp: {
      index: 3,
      title: 'Bestätigungscode eingeben',
      // The address is filled in below so the person can see where to look.
      subtitle: null,
    },
  }

  // The message laid over the photo, with its own headline per step.
  const mediaFeatures = [
    { icon: 'ti ti-stack-2', label: t('Digital') },
    { icon: 'ti ti-bolt', label: t('Effizient') },
    { icon: 'ti ti-leaf', label: t('Nachhaltig') },
  ]
  const mediaByStep = {
    li: {
      headline: t('Intelligente Bewirtschaftung für lebenswerte Immobilien.'),
      features: mediaFeatures,
      caption: t('Gemeinsam für eine smartere Immobilienwelt.'),
    },
    email: {
      headline: `${t('Mehr Transparenz.')}\n${t('Mehr Effizienz.')}\n${t('Mehr Lebensqualität.')}`,
      features: mediaFeatures,
      caption: t('Gemeinsam für eine smarte Immobilienwelt.'),
    },
    otp: {
      headline: t('Intelligente Bewirtschaftung für lebenswerte Immobilien.'),
      features: mediaFeatures,
      caption: t('Gemeinsam für eine smarte Immobilienwelt.'),
    },
  }

  return (
    <AuthSplitShell
      title={t(contentByStep[step].title)}
      subtitle={step === 'otp'
        ? `${t('Wir haben Ihnen einen 6-stelligen Code an')} ${email} ${t('gesendet.')}\n${t('Bitte geben Sie den Code ein, um fortzufahren.')}`
        : t(contentByStep[step].subtitle)}
      logoHref="/type"
      imageSrc={step === 'otp'
        ? '/assets/images/ui-images/otp-page.png'
        : '/assets/images/ui-images/property-number-page.png'}
      backLink={step === 'li'
        ? { to: '/type', label: t('Zurück zur Auswahl') }
        : { onClick: resetLiFlow, label: t('Zurück') }}
      step={{ index: contentByStep[step].index, label: `${t('Schritt')} ${contentByStep[step].index} ${t('von')} 3` }}
      stepCount={3}
      media={mediaByStep[step]}
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
          <label className="vergo-auth-label" htmlFor="vergo-login-email">{t('E-Mail-Adresse')}</label>
          <div className="vergo-auth-field">
            <i className="ti ti-mail"></i>
            <input
              id="vergo-login-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t('z. B. name@beispiel.ch')}
              autoComplete="email"
              required
            />
          </div>

          {/* Which property they are signing in for - the back link changes it. */}
          {propertyTitle ? (
            <p className="vergo-auth-hint">{liNumber} · {propertyTitle}</p>
          ) : null}

          {error ? <div className="alert alert-danger py-2 mt-3 mb-0">{t(error)}</div> : null}

          <button className="vergo-auth-submit mt-4" type="submit" disabled={isSubmitting}>
            <span>{isSubmitting ? t('OTP wird gesendet...') : t('Weiter')}</span>
            <i className="ti ti-arrow-right"></i>
          </button>
        </form>
      ) : null}

      {step === 'otp' ? (
        <form onSubmit={handleVerifyOtp}>
          <CodeInput value={code} onChange={setCode} />

          <button
            type="button"
            className="vergo-auth-resend"
            onClick={handleResendCode}
            disabled={resendSeconds > 0 || isSubmitting}
          >
            <i className="ti ti-mail"></i>
            <span className="vergo-auth-resend-question">{t('Keinen Code erhalten?')}</span>
            <span className="vergo-auth-resend-action">
              {resendSeconds > 0
                ? `${t('Code erneut senden')} (${t('in')} ${resendSeconds}s)`
                : t('Code erneut senden')}
            </span>
          </button>

          {otpSentMessage ? <div className="alert alert-success py-2 mt-3">{otpSentMessage}</div> : null}

          {error ? <div className="alert alert-danger py-2 mt-3 mb-0">{t(error)}</div> : null}

          <button className="vergo-auth-submit mt-4" type="submit" disabled={isSubmitting || code.length < 6}>
            <span>{isSubmitting ? t('Wird geprüft...') : t('Weiter')}</span>
            <i className="ti ti-arrow-right"></i>
          </button>
        </form>
      ) : null}
    </AuthSplitShell>
  )
}

export default LoginPage
