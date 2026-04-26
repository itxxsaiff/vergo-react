import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function ProtectedRoute({ allowRoles, allowManagerAccessModes, children }) {
  const location = useLocation()
  const { isAuthenticated, isBooting, user } = useAuth()

  function getFallbackPath() {
    return '/dashboard'
  }

  if (isBooting) {
    return <div className="auth-loading">Sitzung wird geprüft...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/type" replace state={{ from: location }} />
  }

  if (allowRoles && !allowRoles.includes(user.role)) {
    return <Navigate to={getFallbackPath()} replace />
  }

  return children
}

export default ProtectedRoute
