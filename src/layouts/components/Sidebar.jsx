import { useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { closeSidebar } from '../../lib/sidebarLayout'

function Sidebar({ navigation, user }) {
  const location = useLocation()
  const [openSections, setOpenSections] = useState({})

  const autoOpenSections = useMemo(() => {
    const nextOpenSections = {}


    navigation.forEach((item) => {
      if (item.children?.some((child) => child.href === location.pathname)) {
        nextOpenSections[item.title] = true
      }
    })

    return nextOpenSections
  }, [location.pathname, navigation])

  function toggleSection(title) {
    setOpenSections((current) => ({
      ...current,
      [title]: !current[title],
    }))
  }

  return (
    <aside className="left-sidebar">
      <div>
        <div className="brand-logo d-flex align-items-center justify-content-between">
          <NavLink to={user?.homePath ?? '/dashboard'} className="text-nowrap logo-img">
            <span className="vergo-wordmark vergo-wordmark-sidebar" aria-label="Vergo">
              <span className="vergo-wordmark-accent">V</span>ergo
            </span>
          </NavLink>
          <button
            type="button"
            className="close-btn d-lg-none d-block cursor-pointer border-0 bg-transparent"
            id="sidebarCollapse"
            onClick={() => closeSidebar({ persistState: true })}
          >
            <i className="ti ti-x fs-8 text-muted"></i>
          </button>
        </div>

        <nav className="sidebar-nav scroll-sidebar" data-simplebar>
          <ul id="sidebarnav">
            <li className="nav-small-cap">
              <i className="ti ti-dots nav-small-cap-icon fs-4"></i>
              <span className="hide-menu">Arbeitsplatz</span>
            </li>

            {navigation.map((item) => {
              if (item.children) {
                const isParentActive = item.href === location.pathname
                const isChildActive = item.children.some((child) => child.href === location.pathname)
                const isOpen = Boolean(openSections[item.title] || autoOpenSections[item.title] || isParentActive)
                const isSelected = isOpen || isParentActive || isChildActive

                return (
                  <li key={item.title} className={`sidebar-item${isSelected ? ' selected' : ''}`}>
                    <div className={`sidebar-link has-arrow vergo-sidebar-group${isParentActive ? ' active' : ''}`}>
                      {item.href ? (
                        <NavLink
                          to={item.href}
                          onClick={closeSidebar}
                          className={({ isActive }) => `vergo-sidebar-parent-link${isActive ? ' active' : ''}`}
                        >
                          <span className="d-flex">
                            <i className={item.icon}></i>
                          </span>
                          <span className="hide-menu">{item.title}</span>
                        </NavLink>
                      ) : (
                        <span className="vergo-sidebar-parent-link">
                          <span className="d-flex">
                            <i className={item.icon}></i>
                          </span>
                          <span className="hide-menu">{item.title}</span>
                        </span>
                      )}

                      <button
                        type="button"
                        className="vergo-sidebar-toggle"
                        aria-expanded={isOpen}
                        aria-label={`${item.title} Untermenü umschalten`}
                        onClick={() => toggleSection(item.title)}
                      />
                    </div>

                    <ul
                      aria-expanded={isOpen}
                      className={`collapse first-level${isOpen ? ' in' : ''}`}
                      style={{ display: isOpen ? 'block' : 'none' }}
                    >
                      {item.children.map((child) => (
                        <li key={child.title} className="sidebar-item">
                          <NavLink
                            to={child.href}
                            onClick={closeSidebar}
                            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                          >
                            <div className="round-16 d-flex align-items-center justify-content-center">
                              <i className="ti ti-circle"></i>
                            </div>
                            <span className="hide-menu">{child.title}</span>
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  </li>
                )
              }

              return (
                <li key={item.title} className="sidebar-item">
                  <NavLink
                    to={item.href}
                    onClick={closeSidebar}
                    className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                  >
                    <span>
                      <i className={item.icon}></i>
                    </span>
                    <span className="hide-menu">{item.title}</span>
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>
    </aside>
  )
}

export default Sidebar
