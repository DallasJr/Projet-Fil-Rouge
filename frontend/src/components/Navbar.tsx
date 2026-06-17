import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ShoppingBag, UtensilsCrossed, LayoutDashboard, LogOut, User, Truck, Settings, Users, Bell, MailOpen } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useSocket } from '../contexts/SocketContext'
import { useToast } from '../contexts/ToastContext'
import { getMyNotifications, markAsRead, markAllAsRead } from '../api/notifications.api'
import type { NotificationDetail } from '../api/notifications.api'

const Navbar = () => {
  const { user, isAdmin, isDeliverer, isAuthenticated, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const [notifications, setNotifications] = useState<NotificationDetail[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showDropdown, setShowDropdown] = useState(false)
  const { socket } = useSocket()
  const { addToast } = useToast()
  const dropdownRef = useRef<HTMLDivElement>(null)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const fetchNotifications = async () => {
    if (!isAuthenticated) return
    try {
      const data = await getMyNotifications()
      setNotifications(data)
      setUnreadCount(data.filter((n) => !n.isRead).length)
    } catch {
      console.error('Erreur chargement notifications')
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications()
    }
  }, [isAuthenticated])

  // Écouter les nouvelles notifications via Socket.io
  useEffect(() => {
    if (socket && isAuthenticated) {
      socket.on('new_notification', (newNotif: NotificationDetail) => {
        setNotifications((prev) => [newNotif, ...prev])
        setUnreadCount((prev) => prev + 1)
        addToast(newNotif.message, 'info')
      })
    }
    return () => {
      if (socket) {
        socket.off('new_notification')
      }
    }
  }, [socket, isAuthenticated, addToast])

  // Fermer le dropdown en cliquant à l'extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await markAsRead(id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch {
      addToast('Erreur lors de la modification', 'error')
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      setUnreadCount(0)
      addToast('Toutes les notifications sont lues.', 'success')
    } catch {
      addToast('Erreur lors de la modification', 'error')
    }
  }

  const isActive = (path: string) => location.pathname.startsWith(path)

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand" style={{ textDecoration: 'none', color: 'inherit' }}>
        <UtensilsCrossed size={22} className="navbar-logo-icon" />
        <span className="navbar-title">RestauApp</span>
      </Link>

      <div className="navbar-links">
        {/* Menu (accessible à tous) */}
        <Link to="/menu" id="nav-menu" className={`navbar-link ${isActive('/menu') ? 'active' : ''}`}>
          <UtensilsCrossed size={16} />
          Menu
        </Link>

        {/* Client connecté : Commandes */}
        {isAuthenticated && !isDeliverer && (
          <Link to="/orders" id="nav-orders" className={`navbar-link ${isActive('/orders') ? 'active' : ''}`}>
            <ShoppingBag size={16} />
            Mes commandes
          </Link>
        )}

        {/* Livreur connecté */}
        {isAuthenticated && (isDeliverer || isAdmin) && (
          <Link to="/deliveries" id="nav-deliveries" className={`navbar-link ${isActive('/deliveries') ? 'active' : ''}`}>
            <Truck size={16} />
            Livraisons
          </Link>
        )}

        {/* Admin connecté */}
        {isAuthenticated && isAdmin && (
          <>
            <Link to="/dashboard" id="nav-dashboard" className={`navbar-link ${isActive('/dashboard') ? 'active' : ''}`}>
              <LayoutDashboard size={16} />
              Dashboard
            </Link>
            <Link to="/admin/users" id="nav-admin-users" className={`navbar-link ${isActive('/admin/users') ? 'active' : ''}`}>
              <Users size={16} />
              Utilisateurs
            </Link>
            <Link to="/admin/menu" id="nav-admin-menu" className={`navbar-link ${isActive('/admin/menu') ? 'active' : ''}`}>
              <Settings size={16} />
              Gestion Menu
            </Link>
          </>
        )}
      </div>

      <div className="navbar-user" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {isAuthenticated ? (
          <>
            {/* Cloche de notifications */}
            <div className="notifications-dropdown-container" ref={dropdownRef} style={{ position: 'relative' }}>
              <button
                id="btn-notifications"
                className="btn-icon"
                onClick={() => setShowDropdown(!showDropdown)}
                title="Notifications"
                style={{
                  position: 'relative',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#4b5563',
                  padding: '6px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span
                    id="notification-badge"
                    style={{
                      position: 'absolute',
                      top: '-2px',
                      right: '-2px',
                      backgroundColor: '#ef4444',
                      color: '#fff',
                      fontSize: '9px',
                      fontWeight: 'bold',
                      borderRadius: '50%',
                      minWidth: '15px',
                      height: '15px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '2px',
                      border: '2px solid #fff'
                    }}
                  >
                    {unreadCount}
                  </span>
                )}
              </button>

              {showDropdown && (
                <div
                  id="notifications-menu"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '8px',
                    width: '320px',
                    backgroundColor: '#fff',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                    zIndex: 1000,
                    overflow: 'hidden',
                    border: '1px solid #e5e7eb'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #f3f4f6', backgroundColor: '#f9fafb' }}>
                    <span style={{ fontWeight: '600', fontSize: '14px', color: '#111827' }}>Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllAsRead}
                        style={{ background: 'transparent', border: 'none', color: '#2563eb', fontSize: '12px', cursor: 'pointer', fontWeight: '500' }}
                      >
                        Tout lire
                      </button>
                    )}
                  </div>

                  <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
                        Aucune notification
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          style={{
                            padding: '12px 16px',
                            borderBottom: '1px solid #f3f4f6',
                            backgroundColor: n.isRead ? 'transparent' : '#eff6ff',
                            position: 'relative',
                            fontSize: '13px',
                            color: '#374151',
                            transition: 'background-color 0.2s',
                            cursor: 'default'
                          }}
                        >
                          <div style={{ paddingRight: '20px' }}>{n.message}</div>
                          <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '4px' }}>
                            {new Date(n.createdAt).toLocaleDateString('fr-FR', {
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </div>
                          {!n.isRead && (
                            <button
                              onClick={(e) => handleMarkAsRead(n.id, e)}
                              title="Marquer comme lu"
                              style={{
                                position: 'absolute',
                                top: '12px',
                                right: '12px',
                                border: 'none',
                                background: 'transparent',
                                color: '#9ca3af',
                                cursor: 'pointer',
                                padding: '2px'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.color = '#2563eb'}
                              onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
                            >
                              <MailOpen size={14} />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <Link to="/profile" id="nav-profile" className="navbar-user-info">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="Avatar" style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--color-border)' }} />
              ) : (
                <User size={15} />
              )}
              <span>{user?.name}</span>
              {isAdmin && <span className="badge-admin">Admin</span>}
              {isDeliverer && <span className="badge-deliverer">Livreur</span>}
            </Link>
            <button id="btn-logout" className="btn-icon btn-logout" onClick={handleLogout} title="Se déconnecter">
              <LogOut size={17} />
            </button>
          </>
        ) : (
          <>
            <Link to="/login" id="nav-login" className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
              Se connecter
            </Link>
            <Link to="/register" id="nav-register" className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>
              S'inscrire
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}

export default Navbar
