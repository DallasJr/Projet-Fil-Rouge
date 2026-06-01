import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const Spinner = () => (
  <div className="loading-screen">
    <div className="loading-spinner"></div>
  </div>
)

// Protège les routes qui nécessitent une connexion
export const ProtectedRoute = () => {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <Spinner />
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />
}

// Protège les routes ADMIN
export const AdminRoute = () => {
  const { isAuthenticated, isAdmin, isLoading } = useAuth()
  if (isLoading) return <Spinner />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/menu" replace />
  return <Outlet />
}

// Protège les routes LIVREUR
export const DelivererRoute = () => {
  const { isAuthenticated, isDeliverer, isAdmin, isLoading } = useAuth()
  if (isLoading) return <Spinner />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  // Admins peuvent aussi voir les livraisons
  if (!isDeliverer && !isAdmin) return <Navigate to="/menu" replace />
  return <Outlet />
}
