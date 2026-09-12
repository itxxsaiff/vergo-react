import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import AuthSplitShell from '../components/AuthSplitShell'
import CodeInput from '../components/CodeInput'
import { EMAIL_OTP_LOGIN_ACCESS_KEY } from '../constants/auth'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'

const initialForm = {
  email: '',
  customer_number: '',
  code: '',
}

function EmailOtpLoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const customerNumberFromLink = searchParams.get('customer_number') ?? ''
  const shouldForceOtpLogin = searchParams.get('force_otp') === '1'
  const isCustomerEmailLink = ['DLS-', 'ETM-'].some((prefix) => customerNumberFromLink.trim().toUpperCase().startsWith(prefix))
  const { isAuthenticated, logout, requestUserOtp, verifyUserOtp } = useAuth()
  const { t } = useLanguage()
  const [form, setForm] = useState(() => ({
    ...initialForm,
    customer_number: customerNumberFromLink,
    email: searchParams.get('email') ?? '',
  }))
  const [step, setStep] = useState('email')
  const [otpSentMessage, setOtpSentMessage] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasAccess] = useState(() => sessionStorage.getItem(EMAIL_OTP_LOGIN_ACCESS_KEY) === 'granted')
  // A short wait before the code can be requested again.
  const [resendSeconds, setResendSeconds] = useState(0)

  useEffect(() => {
    if (resendSeconds <= 0) {
      return undefined
    }

    const timerId = window.setTimeout(() => setResendSeconds((current) => current - 1), 1000)

    return () => window.clearTimeout(timerId)
  }, [resendSeconds])

  useEffect(() => {
    if (shouldForceOtpLogin && isAuthenticated && step === 'email') {
      logout()
    }
  }, [isAuthenticated, logout, shouldForceOtpLogin, step])

  if (isAuthenticated && !shouldForceOtpLogin) {
    return <Navigate to="/dashboard" replace />
  }

  if (!hasAccess && !isCustomerEmailLink) {
    return <Navigate to="/type" replace />
  }

  function handleChange(event) {
    const { name, value } = event.target

    setForm((current) => ({
      ...current,
        [name]: name === 'code'
        ? value.replace(/\D/g, '').slice(0, 6)
        : name === 'customer_number'
          ? value.slice(0, 20)
          : value,
    }))
  }

  async function sendOtp() {
    setIsSubmitting(true)
    setError('')

    try {
      const normalizedEmail = form.email.trim().toLowerCase()
      const response = await requestUserOtp({
        email: normalizedEmail,
        customer_number: form.customer_number.trim() || undefined,
      })

      setForm((current) => ({
        ...current,
        email: response.data?.email ?? normalizedEmail,
        customer_number: response.data?.customer_number ?? current.customer_number,
        code: '',
      }))
      const sentSuffix = t('gesendet.')
      setOtpSentMessage(`${t('Wir haben einen Anmeldecode an')} ${response.data?.email ?? normalizedEmail}${sentSuffix === '.' ? '.' : ` ${sentSuffix}`}`)
      setStep('otp')
    } catch (submitError) {
      setError(t(submitError.message))
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
        customer_number: form.customer_number.trim() || undefined,
        code: form.code,
      })
      sessionStorage.removeItem(EMAIL_OTP_LOGIN_ACCESS_KEY)
      navigate(loggedInUser?.home_path ?? '/orders', { replace: true })
    } catch (submitError) {
      setError(t(submitError.message))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleResendCode() {
    if (resendSeconds > 0) {
      return
    }

    setError('')
    setIsSubmitting(true)

    try {
      await requestUserOtp({ email: form.email, customer_number: form.customer_number })
      setOtpSentMessage(t('Wir haben Ihnen einen neuen Code gesendet.'))
      setForm((current) => ({ ...current, code: '' }))
      setResendSeconds(60)
    } catch (resendError) {
      setError(t(resendError.message))
    } finally {
      setIsSubmitting(false)
    }
  }

  // Going back keeps the customer number and address so they are not retyped.
  function resetFlow() {
    setStep('email')
    setForm((current) => ({ ...current, code: '' }))
    setOtpSentMessage('')
    setError('')
  }

  const contentByStep = {
    email: {
      index: 1,
      title: 'Anmeldedaten eingeben',
      subtitle: 'Bitte geben Sie Ihre Kundennummer und E-Mail-Adresse ein. Wir verwenden diese, um Ihnen einen Bestätigungscode zu senden.',
    },
    otp: {
      index: 2,
      title: 'Bestätigungscode eingeben',
      subtitle: null,
    },
  }


  return (
    <AuthSplitShell
      title={t(contentByStep[step].title)}
      subtitle={step === 'otp'
        ? `${t('Wir haben Ihnen einen 6-stelligen Code an')} ${form.email} ${t('gesendet.')}\n${t('Bitte geben Sie den Code ein, um fortzufahren.')}`
        : t(contentByStep[step].subtitle)}
      logoHref="/type"
      imageSrc="/assets/images/ui-images/iStock-1395005842.jpg"
      backLink={step === 'email'
        ? { to: '/type', label: t('Zurück zur Auswahl') }
        : { onClick: resetFlow, label: t('Zurück') }}
      step={{ index: contentByStep[step].index, label: `${t('Schritt')} ${contentByStep[step].index} ${t('von')} 2` }}
      stepCount={2}
    >
      {step === 'email' ? (
        <form onSubmit={handleRequestOtp}>
          <label className="vergo-auth-label" htmlFor="vergo-customer-number">{t('Kundennummer')}</label>
          <div className="vergo-auth-field">
            <i className="ti ti-id-badge-2"></i>
            <input
              id="vergo-customer-number"
              name="customer_number"
              value={form.customer_number}
              onChange={handleChange}
              placeholder={t('z. B. ETM-00001 oder DLS-00001')}
              autoComplete="off"
              required
            />
          </div>
          <p className="vergo-auth-hint">
            {t('Eigentümer verwenden ETM-Nummern, Dienstleister verwenden DLS-Nummern.')}
          </p>

          <label className="vergo-auth-label mt-4" htmlFor="vergo-customer-email">{t('E-Mail-Adresse')}</label>
          <div className="vergo-auth-field">
            <i className="ti ti-mail"></i>
            <input
              id="vergo-customer-email"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder={t('z. B. name@beispiel.ch')}
              autoComplete="email"
              required
            />
          </div>

          {error ? <div className="alert alert-danger py-2 mt-3 mb-0">{t(error)}</div> : null}

          <button
            className="vergo-auth-submit mt-4"
            type="submit"
            disabled={isSubmitting || !form.email.trim() || !form.customer_number.trim()}
          >
            <span>{isSubmitting ? t('OTP wird gesendet...') : t('Weiter')}</span>
            <i className="ti ti-arrow-right"></i>
          </button>
        </form>
      ) : null}

      {step === 'otp' ? (
        <form onSubmit={handleVerifyOtp}>
          <CodeInput value={form.code} onChange={(next) => setForm((current) => ({ ...current, code: next }))} />

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

          <button
            className="vergo-auth-submit mt-4"
            type="submit"
            disabled={isSubmitting || form.code.length !== 6}
          >
            <span>{isSubmitting ? t('Wird geprüft...') : t('Weiter')}</span>
            <i className="ti ti-arrow-right"></i>
          </button>
        </form>
      ) : null}
    </AuthSplitShell>
  )
}

export default EmailOtpLoginPage
