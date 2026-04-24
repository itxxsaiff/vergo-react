import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import AuthShell from '../components/AuthShell'
import { EMAIL_OTP_LOGIN_ACCESS_KEY, USER_LOGIN_ACCESS_KEY } from '../constants/auth'
import { useAuth } from '../context/AuthContext'
import { immersiveAuthShellProps, useImmersiveAuthBackgroundStyle } from '../lib/immersiveAuth'

const TYPE_OPTIONS = [
  {
    value: 'email',
    icon: 'ti ti-user',
    title: 'E-Mail-Anmeldung',
    description: 'Mit E-Mail und OTP direkt zu Ihren Aufträgen anmelden.',
  },
  {
    value: 'property',
    icon: 'ti ti-building-estate',
    title: 'Immobilienanmeldung',
    description: 'Mit LI-Nummer, E-Mail und OTP den kompletten Bereich öffnen.',
  },
]

function TypePage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [selectedOption, setSelectedOption] = useState('email')
  const backgroundStyle = useImmersiveAuthBackgroundStyle()

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  function handleContinue() {
    if (!selectedOption) {
      return
    }

    if (selectedOption === 'email') {
      sessionStorage.removeItem(USER_LOGIN_ACCESS_KEY)
      sessionStorage.setItem(EMAIL_OTP_LOGIN_ACCESS_KEY, 'granted')
      navigate('/email-otp-login', { replace: true })
      return
    }

    sessionStorage.removeItem(EMAIL_OTP_LOGIN_ACCESS_KEY)
    sessionStorage.removeItem(USER_LOGIN_ACCESS_KEY)
    navigate('/login', { replace: true })
  }

  return (
    <AuthShell
      title="Anmeldung wählen"
      subtitle="Wählen Sie den passenden Zugang und starten Sie sicher in Ihren Vergo-Bereich."
      logoHref="/type"
      backgroundStyle={backgroundStyle}
      {...immersiveAuthShellProps}
    >
      <div className="row justify-content-center g-3 mb-4">
        {TYPE_OPTIONS.map((option) => {
          const isActive = selectedOption === option.value

          return (
            <div className="col-md-6" key={option.value}>
              <button
                type="button"
                className={`card w-100 h-100 mb-0 p-0 text-center text-reset overflow-hidden vergo-type-choice-card ${isActive ? 'is-active' : ''}`}
                onClick={() => setSelectedOption(option.value)}
                aria-pressed={isActive}
                style={{
                  appearance: 'none',
                  transition: 'all 0.2s ease',
                  boxShadow: isActive
                    ? '0 18px 40px rgba(10, 16, 34, 0.24), 0 8px 22px rgba(93, 135, 255, 0.18)'
                    : '0 12px 28px rgba(10, 16, 34, 0.16)',
                }}
              >
                <div className="card-body px-4 py-4">
                  <div
                    className="rounded-circle bg-primary bg-gradient d-inline-flex align-items-center justify-content-center shadow-sm mb-3"
                    style={{ width: '74px', height: '74px' }}
                  >
                    <i className={`${option.icon} fs-9 text-white`}></i>
                  </div>
                  <h4 className="fw-semibold mb-2 vergo-type-choice-title" style={{ fontSize: '1.15rem' }}>
                    {option.title}
                  </h4>
                  <p className="mb-0 vergo-type-choice-description" style={{ fontSize: '0.92rem' }}>
                    {option.description}
                  </p>
                </div>
              </button>
            </div>
          )
        })}
      </div>

      <div className="d-grid mt-2">
        <button
          type="button"
          className="btn vergo-type-continue rounded-2 fs-5"
          onClick={handleContinue}
          disabled={!selectedOption}
        >
          <span className="vergo-type-continue-label">Anmelden</span>
          <span className="vergo-type-continue-icon" aria-hidden="true">
            <i className="ti ti-arrow-right"></i>
          </span>
        </button>
      </div>

      <p className="vergo-type-note mb-0">
        Der Hintergrund wechselt automatisch je nach Tageszeit.
      </p>
    </AuthShell>
  )
}

export default TypePage
