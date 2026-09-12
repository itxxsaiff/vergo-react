import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import SupportTicketButton from './SupportTicketButton'
import VergoLogo from '../../public/assets/images/logo/VERGO_01.png'

const AUTH_IMAGE = '/assets/images/ui-images/iStock-2224095230.jpg'
const PRIVACY_URL = 'https://www.vergo.ch/privacy-policy'
const IMPRINT_URL = 'https://www.vergo.ch/legal-notice'

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
  footerNote,
  backLink,
  step,
  stepCount,
  logoHref = '/type',
  imageSrc = AUTH_IMAGE,
}) {
  const { language, changeLanguage, languages, t } = useLanguage()
  const activeLanguage = languages.find((entry) => entry.value === language)
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
        <div className="vergo-auth-split-top">
          <Link to={logoHref} className="vergo-auth-split-logo" aria-label="Vergo">
            <img src={VergoLogo} alt="Vergo" />
          </Link>

          {/* Support and language sit with the form as plain words rather than
              as round icons over the photo. */}
          <div className="vergo-auth-split-links">
            <SupportTicketButton
              publicMode
              asNavItem={false}
              showIcon={false}
              label={t('Support')}
              buttonClassName="vergo-auth-split-link"
            />
            <span className="vergo-auth-split-links-divider" aria-hidden="true">|</span>
            <button
              ref={languageButtonRef}
              type="button"
              className="vergo-auth-split-link"
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
              <span data-no-translate="true">{activeLanguage?.shortLabel ?? language.toUpperCase()}</span>
            </button>
          </div>
        </div>

        <div className="vergo-auth-split-content">
          {/* Going back is a link between pages but an action within a
              multi-step form, so both are supported. */}
          {backLink ? (backLink.onClick ? (
            <button type="button" className="vergo-auth-split-back" onClick={backLink.onClick}>
              <i className="ti ti-arrow-left"></i>
              <span>{backLink.label}</span>
            </button>
          ) : (
            <Link to={backLink.to} className="vergo-auth-split-back">
              <i className="ti ti-arrow-left"></i>
              <span>{backLink.label}</span>
            </Link>
          )) : null}

          {/* How far through a multi-step login the user is. */}
          {step && stepCount ? (
            <div className="vergo-auth-split-steps">
              <span className="vergo-auth-split-step-label">{step.label}</span>
              <div className="vergo-auth-split-step-bar">
                {Array.from({ length: stepCount }, (_, index) => (
                  <span key={index} className={index < step.index ? 'is-done' : ''}></span>
                ))}
              </div>
            </div>
          ) : null}

          {eyebrow ? <p className="vergo-auth-split-eyebrow">{eyebrow}</p> : null}
          {title ? <h1 className="vergo-auth-split-title">{title}</h1> : null}
          {subtitle ? <p className="vergo-auth-split-subtitle">{subtitle}</p> : null}

          {children}
        </div>

        {/* The two legal pages are required on every public screen, so they
            live here rather than in each page. */}
        <div className="vergo-auth-split-footer">
          <div className="vergo-auth-split-legal">
            <a href={PRIVACY_URL} target="_blank" rel="noreferrer">{t('Datenschutz')}</a>
            <span className="vergo-auth-split-legal-dot" aria-hidden="true"></span>
            <a href={IMPRINT_URL} target="_blank" rel="noreferrer">{t('Impressum')}</a>
          </div>

          {footerNote ? (
            <span className="vergo-auth-split-footer-note">
              <span className="vergo-auth-split-rule" aria-hidden="true"></span>
              {footerNote}
            </span>
          ) : null}
          {footer}
        </div>
      </div>

      <div className="vergo-auth-split-media" style={{ backgroundImage: `url("${imageSrc}")` }}>
        {/* Three words, top left of the photo - the only text on it. */}
        <ul className="vergo-auth-split-tagline">
          <li>{t('Digital.')}</li>
          <li>{t('Effizient.')}</li>
          <li>{t('Kostengünstig.')}</li>
        </ul>
      </div>

      {languageMenu}
    </div>
  )
}

export default AuthSplitShell
