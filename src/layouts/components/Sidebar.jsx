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
                const isOpen = Boolean(openSections[item.title] || autoOpenSections[item.title])

                return (
                  <li key={item.title} className={`sidebar-item${isOpen ? ' selected' : ''}`}>
                    <a
                      href="#"
                      className={`sidebar-link has-arrow${isOpen ? ' active' : ''}`}
                      aria-expanded={isOpen}
                      onClick={(event) => {
                        event.preventDefault()
                        toggleSection(item.title)
                      }}
                    >
                      <span className="d-flex">
                        <i className={item.icon}></i>
                      </span>
                      <span className="hide-menu">{item.title}</span>
                    </a>

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
