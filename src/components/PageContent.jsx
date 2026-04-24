import { Link } from 'react-router-dom'

function PageContent({ title, subtitle, children, breadcrumbs = [], actions = null, variant = 'default' }) {
  return (
    <div className="mb-3">
        <div className="card bg-light-info shadow-none position-relative overflow-hidden mb-3">
          <div className="card-body px-3 py-2">
            <div className="row align-items-center">
              <div className="col-lg-8 col-md-7">
                <h4 className="fw-semibold mb-2">{title}</h4>
                {subtitle ? <p className="text-muted mb-2">{subtitle}</p> : null}
                <nav aria-label="breadcrumb">
                  <ol className="breadcrumb mb-0">
                    {breadcrumbs.map((crumb, index) => {
                      const isLast = index === breadcrumbs.length - 1
                      const crumbLabel = typeof crumb === 'string' ? crumb : crumb.label
                      const crumbHref = typeof crumb === 'string' ? null : crumb.href

                      return (
                        <li key={`${crumbLabel}-${index}`} className={`breadcrumb-item${isLast ? ' active' : ''}`}>
                          {!isLast && crumbHref ? (
                            <Link className="text-muted" to={crumbHref}>
                              {crumbLabel}
                            </Link>
                          ) : (
                            crumbLabel
                          )}
                        </li>
                      )
                    })}
                  </ol>
                </nav>
              </div>
              <div className="col-lg-4 col-md-5">
                <div className="d-flex flex-column align-items-md-end align-items-start gap-3">
                  <div className="text-center mb-n5 w-100 d-none d-md-block">
                    <img src="/assets/images/breadcrumb/ChatBc.png" alt={title} className="img-fluid mb-n4" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      {children}
    </div>
  )
}

export default PageContent
