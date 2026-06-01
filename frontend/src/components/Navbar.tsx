import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ShoppingBag, UtensilsCrossed, LayoutDashboard, LogOut, User, Truck, Settings } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const Navbar = () => {
  const { user, isAdmin, isDeliverer, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isActive = (path: string) => location.pathname.startsWith(path)

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <UtensilsCrossed size={22} className="navbar-logo-icon" />
        <span className="navbar-title">RestauApp</span>
      </div>

      <div className="navbar-links">
        {/* Client : Menu & Commandes */}
        {!isDeliverer && (
          <>
            <Link to="/menu" id="nav-menu" className={`navbar-link ${isActive('/menu') ? 'active' : ''}`}>
              <UtensilsCrossed size={16} />
              Menu
            </Link>
            <Link to="/orders" id="nav-orders" className={`navbar-link ${isActive('/orders') ? 'active' : ''}`}>
              <ShoppingBag size={16} />
              Mes commandes
            </Link>
          </>
        )}

        {/* Livreur */}
        {(isDeliverer || isAdmin) && (
          <Link to="/deliveries" id="nav-deliveries" className={`navbar-link ${isActive('/deliveries') ? 'active' : ''}`}>
            <Truck size={16} />
            Livraisons
          </Link>
        )}

        {/* Admin */}
        {isAdmin && (
          <>
            <Link to="/dashboard" id="nav-dashboard" className={`navbar-link ${isActive('/dashboard') ? 'active' : ''}`}>
              <LayoutDashboard size={16} />
              Dashboard
            </Link>
            <Link to="/admin/menu" id="nav-admin-menu" className={`navbar-link ${isActive('/admin/menu') ? 'active' : ''}`}>
              <Settings size={16} />
              Gestion Menu
            </Link>
          </>
        )}
      </div>

      <div className="navbar-user">
        <Link to="/profile" id="nav-profile" className="navbar-user-info">
          <User size={15} />
          <span>{user?.name}</span>
          {isAdmin && <span className="badge-admin">Admin</span>}
          {isDeliverer && <span className="badge-deliverer">Livreur</span>}
        </Link>
        <button id="btn-logout" className="btn-icon btn-logout" onClick={handleLogout} title="Se déconnecter">
          <LogOut size={17} />
        </button>
      </div>
    </nav>
  )
}

export default Navbar
