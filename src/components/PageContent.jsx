import { Link } from 'react-router-dom'

function PageContent({ title, subtitle, children, breadcrumbs = [], variant = 'default' }) {
  return (
    <div className="mb-3">
            <div className="row align-items-center pb-3 px-3">
              <div className="col-12">
                  <ol className="breadcrumb justify-content-end mb-0">
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
              </div>
              <div className="col-12 pt-3">
                <h2>{title}</h2>
              </div>
            </div>
      {children}
    </div>
  )
}

export default PageContent
