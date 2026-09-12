import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'

/**
 * The top of every dashboard: a small "Dashboard" label, a large greeting and
 * the address the person signed in with. The property manager's dashboard set
 * the look; owners and service providers now open with the same block.
 */
function DashboardGreeting() {
  const { user } = useAuth()
  const { t } = useLanguage()

  // Several people can sign in for one owner or one provider company, so the
  // address they actually used is shown rather than the account's main one.
  const email = user?.owner_login_email || user?.provider_login_email || user?.email

  return (
    <div className="vergo-md-greeting vergo-dashboard-greeting">
      <span className="vergo-md-eyebrow">{t('Dashboard')}</span>
      <h1>{t('Guten Tag')}</h1>
      {email ? <p>{email}</p> : null}
    </div>
  )
}

export default DashboardGreeting
