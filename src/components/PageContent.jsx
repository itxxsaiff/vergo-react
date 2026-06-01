import { Link } from 'react-router-dom'

function PageContent({ title, subtitle, actions = null, children, breadcrumbs = [], variant = 'default' }) {
  const shouldRenderHeader = Boolean(title) || breadcrumbs.length > 0

  return (
    <div className="mb-3">
      {shouldRenderHeader ? (
        <div className="row align-items-center pb-2 px-2 px-lg-3">
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
          {title || actions ? (
            <>
              <div className={actions ? 'col-lg-8 col-md-7 col-12 pt-2' : 'col-12 pt-2'}>
                {title ? <h2 className="mb-1">{title}</h2> : null}
                {subtitle ? <p className="text-muted mb-0">{subtitle}</p> : null}
              </div>
              {actions ? (
                <div className="col-lg-4 col-md-5 col-12 pt-2 d-flex justify-content-md-end">
                  {actions}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  )
}

export default PageContent
