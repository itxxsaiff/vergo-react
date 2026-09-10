import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import SupportTicketButton from './SupportTicketButton'
import VergoLogo from '../../public/Vergo-dark.png'

const AUTH_IMAGE = '/assets/images/ui-images/type-page.png'

/**
 * The public login screens: content on the left, a full-height photo on the
 * right. The language switcher and the support button float over the photo so
 * they stay reachable without crowding the form.
 */
function AuthSplitShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  logoHref = '/type',
  imageSrc = AUTH_IMAGE,
}) {
  const { language, changeLanguage, languages, t } = useLanguage()
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false)
  const [languageMenuPosition, setLanguageMenuPosition] = useState({ top: 0, right: 0 })
  const languageButtonRef = useRef(null)
  const languageMenuRef = useRef(null)

  useEffect(() => {
    function handlePointerDown(event) {
      if (
        languageMenuRef.current?.contains(event.target)
        || languageButtonRef.current?.contains(event.target)
      ) {
        return
      }

      setIsLanguageMenuOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)

    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  function updateLanguageMenuPosition() {
    const rect = languageButtonRef.current?.getBoundingClientRect()

    if (!rect) {
      return
    }

    setLanguageMenuPosition({
      top: rect.bottom + 8,
      right: Math.max(12, window.innerWidth - rect.right),
    })
  }

  useEffect(() => {
    if (!isLanguageMenuOpen) {
      return undefined
    }

    window.addEventListener('resize', updateLanguageMenuPosition)
    window.addEventListener('scroll', updateLanguageMenuPosition, true)

    return () => {
      window.removeEventListener('resize', updateLanguageMenuPosition)
      window.removeEventListener('scroll', updateLanguageMenuPosition, true)
    }
  }, [isLanguageMenuOpen])

  function handleLanguageChange(nextLanguage) {
    if (nextLanguage === language) {
      setIsLanguageMenuOpen(false)
      return
    }

    changeLanguage(nextLanguage)
    window.location.reload()
  }

  const languageMenu = isLanguageMenuOpen ? createPortal(
    <div
      ref={languageMenuRef}
      className="dropdown-menu dropdown-menu-end vergo-public-language-menu show"
      style={{
        position: 'fixed',
        top: `${languageMenuPosition.top}px`,
        right: `${languageMenuPosition.right}px`,
      }}
    >
      <div className="py-3 px-4 pb-2">
        <h5 className="mb-0 fs-5 fw-semibold">{t('Sprache')}</h5>
      </div>
      <div className="px-2 pb-2" data-no-translate="true">
        {languages.map((entry) => (
          <button
            key={entry.value}
            type="button"
            className={`dropdown-item d-flex align-items-center justify-content-between rounded-2${language === entry.value ? ' bg-light-primary text-primary' : ''}`}
            onClick={() => handleLanguageChange(entry.value)}
          >
            <span>{entry.label}</span>
            <span className="small fw-semibold">{entry.shortLabel}</span>
          </button>
        ))}
      </div>
    </div>,
    document.body,
  ) : null

  return (
    <div className="vergo-auth-split">
      <div className="vergo-auth-split-panel">
        <Link to={logoHref} className="vergo-auth-split-logo" aria-label="Vergo">
          <img src={VergoLogo} alt="Vergo" />
        </Link>

        <div className="vergo-auth-split-content">
          {eyebrow ? <p className="vergo-auth-split-eyebrow">{eyebrow}</p> : null}
          {title ? <h1 className="vergo-auth-split-title">{title}</h1> : null}
          {subtitle ? <p className="vergo-auth-split-subtitle">{subtitle}</p> : null}

          {children}
        </div>

      
      </div>

      <div className="vergo-auth-split-media" style={{ backgroundImage: `url("${imageSrc}")` }}>
        <div className="vergo-auth-split-actions">
          <SupportTicketButton
            publicMode
            asNavItem={false}
            buttonClassName="vergo-auth-split-action"
          />
          <button
            ref={languageButtonRef}
            type="button"
            className="vergo-auth-split-action"
            aria-expanded={isLanguageMenuOpen}
            aria-label={t('Sprache')}
            title={t('Sprache')}
            onClick={() => {
              if (!isLanguageMenuOpen) {
                updateLanguageMenuPosition()
              }

              setIsLanguageMenuOpen((current) => !current)
            }}
          >
            <i className="ti ti-language"></i>
          </button>
        </div>
      </div>

      {languageMenu}
    </div>
  )
}

export default AuthSplitShell
