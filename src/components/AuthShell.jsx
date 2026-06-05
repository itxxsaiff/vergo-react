import { Link } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import VergoLogo from '../../public/VERGO.png';

function AuthShell({
  title,
  subtitle,
  children,
  footer,
  logoHref = '/login',
  backgroundStyle,
  shellClassName = '',
  cardClassName = '',
  bodyClassName = '',
  headerClassName = '',
  columnClassName = 'col-md-8 col-lg-6 col-xxl-4',
}) {
  const { language, changeLanguage, languages, t } = useLanguage()
  const shellClasses = [
    'position-relative overflow-hidden radial-gradient min-vh-100 d-flex align-items-center justify-content-center',
    shellClassName,
  ].filter(Boolean).join(' ')

  const resolvedCardClassName = ['card mb-0 vergo-auth-card', cardClassName].filter(Boolean).join(' ')
  const resolvedBodyClassName = ['card-body vergo-auth-body', bodyClassName].filter(Boolean).join(' ')
  const resolvedHeaderClassName = ['mb-4 vergo-auth-header', headerClassName].filter(Boolean).join(' ')

  function handleLanguageChange(nextLanguage) {
    if (nextLanguage === language) {
      return
    }

    changeLanguage(nextLanguage)
    window.location.reload()
  }

  return (
    <div
      className="page-wrapper"
      id="main-wrapper"
      data-layout="vertical"
      data-sidebartype="full"
      data-sidebar-position="fixed"
      data-header-position="fixed"
    >
      <div
        className={shellClasses}
        style={backgroundStyle}
      >
        <div className="position-absolute top-0 end-0 p-3 p-md-4">
          <div className="dropdown">
            <button
              type="button"
              className="btn btn-light border-0 shadow-sm rounded-circle d-inline-flex align-items-center justify-content-center"
              id="vergo-public-language-dropdown"
              data-bs-toggle="dropdown"
              aria-expanded="false"
              aria-label={t('Sprache')}
              title={t('Sprache')}
              style={{ width: '48px', height: '48px' }}
            >
              <i className="ti ti-language fs-5"></i>
            </button>
            <div
              className="dropdown-menu dropdown-menu-end dropdown-menu-animate-up"
              aria-labelledby="vergo-public-language-dropdown"
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
            </div>
          </div>
        </div>
        <div className="d-flex align-items-center justify-content-center w-100">
          <div className="row justify-content-center w-100">
            <div className={columnClassName}>
              <div className={resolvedCardClassName}>
                <div className={resolvedBodyClassName}>
                  <Link to={logoHref} className="text-nowrap logo-img text-center d-block mb-5 w-100">
                    <span className="vergo-wordmark" aria-label="Vergo">
                      <img src={VergoLogo} alt="" />
                    </span>
                  </Link>
               
                  <div className={resolvedHeaderClassName}>
                    <h2 className="mb-2 fw-bolder vergo-auth-title">{title}</h2>
                    {subtitle ? <p className="mb-0 vergo-auth-subtitle">{subtitle}</p> : null}
                  </div>

                  {children}

                  {footer ? <div className="d-flex align-items-center justify-content-center mt-4">{footer}</div> : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AuthShell
