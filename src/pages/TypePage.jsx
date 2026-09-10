import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import AuthSplitShell from '../components/AuthSplitShell'
import { EMAIL_OTP_LOGIN_ACCESS_KEY } from '../constants/auth'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'

const TYPE_OPTIONS = [
  {
    value: 'email',
    icon: 'ti ti-users',
    title: 'Eigentümer-/ Dienstleisteranmeldung',
  },
  {
    value: 'property',
    icon: 'ti ti-building-community',
    title: 'Immobilienanmeldung',
  },
]

function TypePage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const { t } = useLanguage()
  const [selectedOption, setSelectedOption] = useState('email')

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  function handleContinue() {
    if (!selectedOption) {
      return
    }

    if (selectedOption === 'email') {
      sessionStorage.setItem(EMAIL_OTP_LOGIN_ACCESS_KEY, 'granted')
      navigate('/email-otp-login', { replace: true })
      return
    }

    sessionStorage.removeItem(EMAIL_OTP_LOGIN_ACCESS_KEY)
    navigate('/login', { replace: true })
  }

  return (
    <AuthSplitShell
      eyebrow={t('Herzlich Willkommen')}
      title={t('Anmeldung wählen')}
      subtitle={t('Bitte wählen Sie mit welchem Zugang Sie sich anmelden möchten.')}
    >
      <div className="vergo-auth-options">
        {TYPE_OPTIONS.map((option) => {
          const isActive = selectedOption === option.value

          return (
            <button
              key={option.value}
              type="button"
              className={`vergo-auth-option${isActive ? ' is-active' : ''}`}
              onClick={() => setSelectedOption(option.value)}
              aria-pressed={isActive}
            >
              <span className="vergo-auth-option-icon">
                <i className={option.icon}></i>
              </span>
              <span className="vergo-auth-option-label">{t(option.title)}</span>
              <i className="ti ti-chevron-right vergo-auth-option-chevron"></i>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        className="vergo-auth-submit"
        onClick={handleContinue}
        disabled={!selectedOption}
      >
        <span>{t('Weiter')}</span>
        <i className="ti ti-arrow-right"></i>
      </button>
    </AuthSplitShell>
  )
}

export default TypePage
