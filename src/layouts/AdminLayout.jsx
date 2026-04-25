import { Outlet } from 'react-router-dom'
import TopProgressBar from '../components/TopProgressBar'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import { closeSidebar, getInitialSidebarState } from '../lib/sidebarLayout'

function AdminLayout({ navigation, user }) {
  const { sidebarType, wrapperClassName } = getInitialSidebarState()

  return (
    <div
      className={wrapperClassName}
      id="main-wrapper"
      data-theme="orange_theme"
      data-layout="vertical"
      data-sidebartype={sidebarType}
      data-sidebar-position="fixed"
      data-header-position="fixed"
    >
      <TopProgressBar />
      <Sidebar navigation={navigation} user={user} />
      <div className="body-wrapper">
        <Header user={user} />
        <div className="container-fluid px-3" style={{"maxWidth": "100%"}}>
          <Outlet />
        </div>
      </div>
      <div className="dark-transparent" onClick={closeSidebar}></div>
    </div>
  )
}

export default AdminLayout
