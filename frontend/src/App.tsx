import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { SocketProvider } from './contexts/SocketContext'
import { ToastProvider } from './contexts/ToastContext'
import { ProtectedRoute, AdminRoute, DelivererRoute } from './components/ProtectedRoute'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import MenuPage from './pages/MenuPage'
import OrdersPage from './pages/OrdersPage'
import DashboardPage from './pages/DashboardPage'
import ProfilePage from './pages/ProfilePage'
import DeliveriesPage from './pages/DeliveriesPage'
import AdminMenuPage from './pages/AdminMenuPage'
import AdminUsersPage from './pages/AdminUsersPage'
import LandingPage from './pages/LandingPage'

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              {/* Routes publiques */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              {/* Routes publiques utilisant le Layout */}
              <Route element={<Layout />}>
                <Route path="/menu" element={<MenuPage />} />
              </Route>

              {/* Routes protégées (connecté) */}
              <Route element={<ProtectedRoute />}>
                <Route element={<Layout />}>

                  {/* Pages accessibles uniquement connecté */}
                  <Route path="/orders" element={<OrdersPage />} />
                  <Route path="/profile" element={<ProfilePage />} />

                  {/* Livreurs & Admins */}
                  <Route element={<DelivererRoute />}>
                    <Route path="/deliveries" element={<DeliveriesPage />} />
                  </Route>

                  {/* Admin uniquement */}
                  <Route element={<AdminRoute />}>
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/admin/menu" element={<AdminMenuPage />} />
                    <Route path="/admin/users" element={<AdminUsersPage />} />
                  </Route>

                </Route>
              </Route>

              {/* Redirections */}
              <Route path="/" element={<LandingPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </SocketProvider>
    </AuthProvider>
  )
}

export default App
