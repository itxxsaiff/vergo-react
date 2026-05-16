import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { api } from '../../lib/api'
import { toggleSidebar } from '../../lib/sidebarLayout'

const HEADER_PLACEHOLDER_IMAGE = 'https://static.vecteezy.com/system/resources/thumbnails/009/292/244/small/default-avatar-icon-of-social-media-user-vector.jpg'

function Header({ user, showSidebarToggle = true }) {
  const { logout } = useAuth()
  const { language, changeLanguage, languages, t } = useLanguage()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    let intervalId = null

    async function loadNotifications() {
      try {
        const response = await api.getNotifications()
        setNotifications(response.data?.items ?? [])
        setUnreadCount(response.data?.unread_count ?? 0)
      } catch {
        setNotifications([])
        setUnreadCount(0)
      }
    }

    loadNotifications()
    intervalId = window.setInterval(loadNotifications, 30000)

    return () => {
      if (intervalId) {
        window.clearInterval(intervalId)
      }
    }
  }, [])

  function handleSidebarToggle() {
    toggleSidebar()
  }

  async function handleLogout() {
    await logout()
  }

  function handleLanguageChange(nextLanguage) {
    if (nextLanguage === language) {
      return
    }

    changeLanguage(nextLanguage)
    window.location.reload()
  }

  async function handleMarkAllRead() {
    try {
      await api.markAllNotificationsRead()
      setNotifications((current) => current.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })))
      setUnreadCount(0)
    } catch {
      // Ignore transient notification read issues in the header.
    }
  }

  function handleAvatarError(event) {
    event.currentTarget.onerror = null
    event.currentTarget.src = HEADER_PLACEHOLDER_IMAGE
  }

  return (
    <header className="app-header">
      <nav className="navbar navbar-expand-lg navbar-light">
        <ul className="navbar-nav">
          {showSidebarToggle ? (
            <li className="nav-item">
              <button
                type="button"
                className="nav-link nav-icon-hover ms-n3 border-0 bg-transparent"
                id="headerCollapse"
                onClick={handleSidebarToggle}
              >
                <i className="ti ti-menu-2"></i>
              </button>
            </li>
          ) : null}
        </ul>

        <div className="d-block d-lg-none">
          <span className="vergo-wordmark vergo-wordmark-mobile" aria-label="Vergo">
            <span className="vergo-wordmark-accent">V</span>ergo
          </span>
        </div>

        <button
          className="navbar-toggler p-0 border-0"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
          aria-controls="navbarNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="p-2">
            <i className="ti ti-dots fs-7"></i>
          </span>
        </button>

        <div className="collapse navbar-collapse justify-content-end" id="navbarNav">
          <ul className="navbar-nav flex-row ms-auto align-items-center justify-content-center">
            <li className="nav-item dropdown">
              <button
                type="button"
                className="nav-link nav-icon-hover border-0 bg-transparent position-relative"
                id="vergo-language-dropdown"
                data-bs-toggle="dropdown"
                aria-expanded="false"
                aria-label={t('Sprache')}
                title={t('Sprache')}
              >
                <i className="ti ti-language"></i>
              </button>
              <div
                className="dropdown-menu dropdown-menu-end dropdown-menu-animate-up"
                aria-labelledby="vergo-language-dropdown"
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
            </li>

            <li className="nav-item dropdown">
              <button
                type="button"
                className="nav-link nav-icon-hover border-0 bg-transparent position-relative"
                id="vergo-notifications-dropdown"
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                <i className="ti ti-bell-ringing"></i>
                {unreadCount > 0 ? <div className="notification bg-primary rounded-circle"></div> : null}
              </button>
              <div
                className="dropdown-menu content-dd dropdown-menu-end dropdown-menu-animate-up vergo-notification-dropdown"
                aria-labelledby="vergo-notifications-dropdown"
              >
                <div className="d-flex align-items-center justify-content-between py-3 px-4">
                  <h5 className="mb-0 fs-5 fw-semibold">{t('Benachrichtigungen')}</h5>
                  <div className="d-flex align-items-center gap-2">
                    <span className="badge bg-primary rounded-4 px-3 py-1 lh-sm">{unreadCount} {t('neu')}</span>
                    {unreadCount > 0 ? (
                      <button type="button" className="btn btn-link text-primary p-0 border-0" onClick={handleMarkAllRead}>
                        {t('Als gelesen markieren')}
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="message-body vergo-notification-list">
                  {notifications.length > 0 ? notifications.map((notification) => (
                    <Link
                      key={notification.id}
                      to={notification.action_url || '#'}
                      className={`py-3 px-4 d-flex align-items-start dropdown-item vergo-notification-item${notification.read_at ? '' : ' bg-light-primary'}`}
                    >
                      <span className="me-3 flex-shrink-0">
                        <img src="/assets/images/profile/user-1.jpg" alt="notification" className="rounded-circle" width="48" height="48" />
                      </span>
                      <div className="vergo-notification-content">
                        <h6 className="mb-1 fw-semibold">{notification.title}</h6>
                        <span className="d-block vergo-notification-message">{notification.message}</span>
                      </div>
                    </Link>
                  )) : (
                    <div className="py-4 px-4 text-muted">{t('Noch keine Benachrichtigungen.')}</div>
                  )}
                </div>
              </div>
            </li>

            <li className="nav-item dropdown">
              <button
                type="button"
                className="nav-link pe-0 border-0 bg-transparent"
                id="vergo-profile-dropdown"
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                  <div className="d-flex align-items-center">
                  <div className="user-profile-img">
                    <img src={user.avatar || HEADER_PLACEHOLDER_IMAGE} className="rounded-circle" width="35" height="35" alt={user.name} onError={handleAvatarError} />
                  </div>
                </div>
              </button>
              <div
                className="dropdown-menu content-dd dropdown-menu-end dropdown-menu-animate-up"
                aria-labelledby="vergo-profile-dropdown"
              >
                <div className="profile-dropdown position-relative">
                  <div className="py-3 px-4 pb-0">
                    <h5 className="mb-0 fs-5 fw-semibold">{t('Benutzerprofil')}</h5>
                  </div>
                  <div className="d-flex align-items-center py-4 mx-4 border-bottom">
                    <img src={user.avatar || HEADER_PLACEHOLDER_IMAGE} className="rounded-circle" width="80" height="80" alt={user.name} onError={handleAvatarError} />
                    <div className="ms-3">
                      <h5 className="mb-1 fs-3">{user.name}</h5>
                      <span className="mb-1 d-block text-dark text-capitalize">{user.roleLabel}</span>
                    </div>
                  </div>
                  <div className="message-body">
                    <Link to={user.homePath ?? '/dashboard'} className="py-3 px-4 mt-3 d-flex align-items-center">
                      <span className="d-flex align-items-center justify-content-center bg-light rounded-1 p-3">
                        <i className="ti ti-layout-dashboard fs-6"></i>
                      </span>
                      <div className="w-75 d-inline-block v-middle ps-3">
                        <h6 className="mb-1 fw-semibold">{user.homePath === '/orders' ? t('Aufträge') : t('Dashboard')}</h6>
                        <span className="d-block text-dark">{user.homePath === '/orders' ? t('Zu den Aufträgen') : t('Zum Dashboard')}</span>
                      </div>
                    </Link>
                  </div>
                  <div className="d-grid py-4 px-4 pt-3">
                    <button type="button" className="btn btn-outline-primary" onClick={handleLogout}>
                      {t('Abmelden')}
                    </button>
                  </div>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </nav>
    </header>
  )
}

export default Header
