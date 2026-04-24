import { Link } from 'react-router-dom'

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
  const shellClasses = [
    'position-relative overflow-hidden radial-gradient min-vh-100 d-flex align-items-center justify-content-center',
    shellClassName,
  ].filter(Boolean).join(' ')

  const resolvedCardClassName = ['card mb-0 vergo-auth-card', cardClassName].filter(Boolean).join(' ')
  const resolvedBodyClassName = ['card-body vergo-auth-body', bodyClassName].filter(Boolean).join(' ')
  const resolvedHeaderClassName = ['mb-4 vergo-auth-header', headerClassName].filter(Boolean).join(' ')

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
        <div className="d-flex align-items-center justify-content-center w-100">
          <div className="row justify-content-center w-100">
            <div className={columnClassName}>
              <div className={resolvedCardClassName}>
                <div className={resolvedBodyClassName}>
                  <Link to={logoHref} className="text-nowrap logo-img text-center d-block mb-5 w-100">
                    <span className="vergo-wordmark" aria-label="Vergo">
                      <span className="vergo-wordmark-accent">V</span>ergo
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
