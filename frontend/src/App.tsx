import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
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
import LandingPage from './pages/LandingPage'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Routes publiques */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Routes protégées (connecté) */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>

              {/* Toutes les pages accessibles une fois connecté */}
              <Route path="/menu" element={<MenuPage />} />
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
              </Route>

            </Route>
          </Route>

          {/* Redirections */}
          <Route path="/" element={<LandingPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
