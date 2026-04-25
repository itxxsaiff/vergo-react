import './App.css'
import AvailableJobsPage from './pages/AvailableJobsPage'
import { Navigate, Route, Routes } from 'react-router-dom'
import AllowedDomainsPage from './pages/AllowedDomainsPage'
import AiAnalysisPage from './pages/AiAnalysisPage'
import BidsPage from './pages/BidsPage'
import BackgroundJobsPage from './pages/BackgroundJobsPage'
import DocumentsPage from './pages/DocumentsPage'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuth } from './context/AuthContext'
import { navigationByRole } from './data/navigation'
import { useSkoteLayout } from './hooks/useSkoteLayout'
import AdminLayout from './layouts/AdminLayout'
import DashboardPage from './pages/DashboardPage'
import EmailOtpLoginPage from './pages/EmailOtpLoginPage'
import LoginPage from './pages/LoginPage'
import TypePage from './pages/TypePage'
import OrdersPage from './pages/OrdersPage'
import EmployeeOrdersPage from './pages/EmployeeOrdersPage'
import OrderDetailsPage from './pages/OrderDetailsPage'
import OwnersPage from './pages/OwnersPage'
import PriceComparisonPage from './pages/PriceComparisonPage'
import PropertyDetailsPage from './pages/PropertyDetailsPage'
import PropertyManagersPage from './pages/PropertyManagersPage'
import PropertyObjectsPage from './pages/PropertyObjectsPage'
import PropertiesPage from './pages/PropertiesPage'
import EmployeePropertiesPage from './pages/EmployeePropertiesPage'
import EmployeePropertyDetailsPage from './pages/EmployeePropertyDetailsPage'
import EmployeePropertyDocumentsPage from './pages/EmployeePropertyDocumentsPage'
import EmployeeUsersPage from './pages/EmployeeUsersPage'
import ServiceProvidersPage from './pages/ServiceProvidersPage'
import EmployeesPage from './pages/EmployeesPage'
import UserLoginPage from './pages/UserLoginPage'

const HEADER_PLACEHOLDER_IMAGE = 'https://static.vecteezy.com/system/resources/thumbnails/009/292/244/small/default-avatar-icon-of-social-media-user-vector.jpg'

function AuthenticatedLayout() {
  const { user } = useAuth()

  const currentRole = user?.navigation_role ?? user?.role ?? 'admin'
  const currentUser = {
    name: user?.name ?? 'Vergo User',
    roleLabel: user?.role_label ?? user?.role ?? currentRole,
    avatar: user?.image ?? HEADER_PLACEHOLDER_IMAGE,
    homePath: user?.home_path ?? '/dashboard',
  }

  return (
    <ProtectedRoute>
      <AdminLayout
        navigation={navigationByRole[currentRole] ?? navigationByRole.admin}
        user={currentUser}
      />
    </ProtectedRoute>
  )
}

function DashboardRoute() {
  const { user } = useAuth()

  return <DashboardPage role={user?.role ?? 'admin'} />
}

function PropertiesRoute() {
  const { user } = useAuth()

  if (user?.role === 'employee') {
    return <EmployeePropertiesPage />
  }

  return <PropertiesPage />
}

function OrdersRoute() {
  const { user } = useAuth()

  if (user?.role === 'employee') {
    return <EmployeeOrdersPage />
  }

  return <OrdersPage />
}

function PropertyDetailsRoute() {
  const { user } = useAuth()

  if (user?.role === 'employee') {
    return <EmployeePropertyDetailsPage />
  }

  return <PropertyDetailsPage />
}

function EmployeeUsersRoute() {
  return <EmployeeUsersPage />
}

function App() {
  useSkoteLayout()

  return (
    <Routes>
      <Route path="/type" element={<TypePage />} />
      <Route path="/email-otp-login" element={<EmailOtpLoginPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/user-login" element={<UserLoginPage />} />

      <Route path="/" element={<AuthenticatedLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route
          path="dashboard"
          element={
            <ProtectedRoute allowRoles={['admin', 'owner', 'provider', 'manager', 'employee']} allowManagerAccessModes={['full']}>
              <DashboardRoute />
            </ProtectedRoute>
          }
        />
        <Route
          path="properties"
          element={
            <ProtectedRoute allowRoles={['admin', 'owner', 'manager', 'employee']} allowManagerAccessModes={['full']}>
              <PropertiesRoute />
            </ProtectedRoute>
          }
        />
        <Route
          path="properties/:propertyId"
          element={
            <ProtectedRoute allowRoles={['admin', 'owner', 'manager', 'employee']} allowManagerAccessModes={['full']}>
              <PropertyDetailsRoute />
            </ProtectedRoute>
          }
        />
        <Route
          path="properties/:propertyId/documents"
          element={
            <ProtectedRoute allowRoles={['employee']}>
              <EmployeePropertyDocumentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="owners"
          element={
            <ProtectedRoute allowRoles={['admin']}>
              <OwnersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="property-objects"
          element={
            <ProtectedRoute allowRoles={['admin', 'owner', 'manager', 'employee']} allowManagerAccessModes={['full']}>
              <PropertyObjectsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="orders"
          element={
            <ProtectedRoute allowRoles={['admin', 'owner', 'manager', 'employee']} allowManagerAccessModes={['full', 'orders_only']}>
              <OrdersRoute />
            </ProtectedRoute>
          }
        />
        <Route
          path="orders/:orderId"
          element={
            <ProtectedRoute allowRoles={['admin', 'owner', 'manager']} allowManagerAccessModes={['full', 'orders_only']}>
              <OrderDetailsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="price-comparison"
          element={
            <ProtectedRoute allowRoles={['admin', 'owner', 'manager']} allowManagerAccessModes={['full']}>
              <PriceComparisonPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="ai-analysis"
          element={
            <ProtectedRoute allowRoles={['admin', 'owner', 'manager']} allowManagerAccessModes={['full']}>
              <AiAnalysisPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="background-jobs"
          element={
            <ProtectedRoute allowRoles={['admin', 'owner', 'manager']} allowManagerAccessModes={['full']}>
              <BackgroundJobsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="bids"
          element={
            <ProtectedRoute allowRoles={['admin', 'owner', 'manager', 'provider']} allowManagerAccessModes={['full']}>
              <BidsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="available-jobs"
          element={
            <ProtectedRoute allowRoles={['provider']}>
              <AvailableJobsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="submitted-bids"
          element={
            <ProtectedRoute allowRoles={['provider']}>
              <BidsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="service-providers"
          element={
            <ProtectedRoute allowRoles={['admin']}>
              <ServiceProvidersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="employees"
          element={
            <ProtectedRoute allowRoles={['admin']}>
              <EmployeesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="property-managers"
          element={
            <ProtectedRoute allowRoles={['admin']}>
              <PropertyManagersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="allowed-domains"
          element={
            <ProtectedRoute allowRoles={['admin']}>
              <AllowedDomainsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="documents"
          element={
            <ProtectedRoute allowRoles={['admin', 'owner', 'manager']} allowManagerAccessModes={['full']}>
              <DocumentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="users"
          element={
            <ProtectedRoute allowRoles={['employee']}>
              <Navigate to="/users/owners" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="users/:category"
          element={
            <ProtectedRoute allowRoles={['employee']}>
              <EmployeeUsersRoute />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}

export default App
