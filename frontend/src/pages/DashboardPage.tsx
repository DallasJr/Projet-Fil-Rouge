import { useState, useEffect } from 'react'
import type { ReactElement } from 'react'
import { Clock, ChefHat, Package, CheckCircle, XCircle, Truck, AlertCircle, RefreshCw, MapPin, X } from 'lucide-react'
import { getAllOrders, updateOrderStatus } from '../api/orders.api'
import type { Order, OrderStatus } from '../api/orders.api'
import { getAllUsers, assignDeliverer } from '../api/admin.api'
import type { UserDetail } from '../api/admin.api'

const statusConfig: Record<OrderStatus, { label: string; icon: ReactElement; className: string }> = {
  PENDING:    { label: 'En attente',     icon: <Clock size={13} />,        className: 'status-pending' },
  ACCEPTED:   { label: 'Acceptée',       icon: <CheckCircle size={13} />,  className: 'status-accepted' },
  PREPARING:  { label: 'En préparation', icon: <ChefHat size={13} />,      className: 'status-preparing' },
  READY:      { label: 'Prête',          icon: <Package size={13} />,      className: 'status-ready' },
  DELIVERING: { label: 'En livraison',   icon: <Truck size={13} />,        className: 'status-delivering' },
  DELIVERED:  { label: 'Livrée',         icon: <CheckCircle size={13} />,  className: 'status-delivered' },
  CANCELLED:  { label: 'Annulée',        icon: <XCircle size={13} />,      className: 'status-cancelled' },
}

const STATUS_FLOW: OrderStatus[] = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'DELIVERING', 'DELIVERED']

const DashboardPage = () => {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'ALL'>('ALL')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // Modale d'assignation
  const [deliverers, setDeliverers] = useState<UserDetail[]>([])
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null)
  const [isLoadingDeliverers, setIsLoadingDeliverers] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)

  const fetchOrders = async () => {
    setIsLoading(true)
    try {
      const data = await getAllOrders()
      setOrders(data)
    } catch {
      setError('Impossible de charger les commandes.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchOrders() }, [])

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingId(orderId)
    try {
      const updated = await updateOrderStatus(orderId, newStatus)
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, ...updated } : o))
    } catch {
      setError('Impossible de mettre à jour le statut.')
    } finally {
      setUpdatingId(null)
    }
  }

  const openAssignModal = async (deliveryId: string) => {
    setSelectedDeliveryId(deliveryId)
    setIsAssignModalOpen(true)
    setIsLoadingDeliverers(true)
    try {
      const data = await getAllUsers('DELIVERER')
      setDeliverers(data)
    } catch {
      setError('Impossible de charger les livreurs.')
    } finally {
      setIsLoadingDeliverers(false)
    }
  }

  const handleAssign = async (delivererId: string) => {
    if (!selectedDeliveryId) return
    setIsAssigning(true)
    try {
      await assignDeliverer(selectedDeliveryId, delivererId)
      setIsAssignModalOpen(false)
      setSelectedDeliveryId(null)
      fetchOrders()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Impossible d\'assigner le livreur.')
    } finally {
      setIsAssigning(false)
    }
  }

  const filteredOrders = filterStatus === 'ALL' ? orders : orders.filter((o) => o.status === filterStatus)

  const stats = {
    total: orders.length,
    pending: orders.filter((o) => o.status === 'PENDING').length,
    preparing: orders.filter((o) => ['ACCEPTED', 'PREPARING'].includes(o.status)).length,
    ready: orders.filter((o) => o.status === 'READY').length,
    revenue: orders.filter((o) => o.status !== 'CANCELLED').reduce((s, o) => s + o.totalAmount, 0),
  }

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard Admin</h1>
          <p className="page-subtitle">Gérez toutes les commandes en temps réel</p>
        </div>
        <button id="btn-refresh" className="btn btn-secondary" onClick={fetchOrders} disabled={isLoading}>
          <RefreshCw size={15} className={isLoading ? 'spin' : ''} /> Actualiser
        </button>
      </div>

      {error && <div className="alert alert-error"><AlertCircle size={16} /><span>{error}</span></div>}

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card stat-card-total">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total commandes</div>
        </div>
        <div className="stat-card stat-card-pending">
          <div className="stat-value">{stats.pending}</div>
          <div className="stat-label">En attente</div>
        </div>
        <div className="stat-card stat-card-preparing">
          <div className="stat-value">{stats.preparing}</div>
          <div className="stat-label">En préparation</div>
        </div>
        <div className="stat-card stat-card-ready">
          <div className="stat-value">{stats.ready}</div>
          <div className="stat-label">Prêtes</div>
        </div>
        <div className="stat-card stat-card-revenue">
          <div className="stat-value">{stats.revenue.toFixed(2)} €</div>
          <div className="stat-label">Chiffre d'affaires</div>
        </div>
      </div>

      {/* Filtres */}
      <div className="dashboard-filters">
        {(['ALL', ...STATUS_FLOW, 'CANCELLED'] as const).map((s) => (
          <button
            key={s}
            id={`filter-${s.toLowerCase()}`}
            className={`filter-chip ${filterStatus === s ? 'active' : ''}`}
            onClick={() => setFilterStatus(s as OrderStatus | 'ALL')}
          >
            {s === 'ALL' ? 'Toutes' : statusConfig[s as OrderStatus].label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="loading-screen"><div className="loading-spinner"></div></div>
      ) : filteredOrders.length === 0 ? (
        <div className="empty-state"><p>Aucune commande dans cette catégorie.</p></div>
      ) : (
        <div className="orders-table-wrapper">
          <table className="orders-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Client</th>
                <th>Articles</th>
                <th>Livraison</th>
                <th>Livreur</th>
                <th>Total</th>
                <th>Date</th>
                <th>Statut</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => {
                const status = statusConfig[order.status]
                const currentIndex = STATUS_FLOW.indexOf(order.status)
                const nextStatus = currentIndex >= 0 && currentIndex < STATUS_FLOW.length - 1
                  ? STATUS_FLOW[currentIndex + 1]
                  : null

                return (
                  <tr key={order.id} id={`row-${order.id}`}>
                    <td><span className="order-id-badge">#{order.id.slice(-6).toUpperCase()}</span></td>
                    <td>
                      <div>{order.customer?.name || '—'}</div>
                      {order.customer?.phone && <div className="text-muted text-sm">{order.customer.phone}</div>}
                    </td>
                    <td>
                      <div className="order-items-summary">
                        {order.items.map((item) => (
                          <span key={item.id} className="item-tag">{item.quantity}× {item.item.name}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      {order.delivery ? (
                        <div className="delivery-cell">
                          <MapPin size={12} />
                          <span className="text-sm">{order.delivery.deliveryAddress.slice(0, 25)}…</span>
                        </div>
                      ) : (
                        <span className="text-muted text-sm">Sur place</span>
                      )}
                    </td>
                    <td>
                      {order.delivery ? (
                        order.delivery.deliverer ? (
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: '500', fontSize: '13px' }}>{order.delivery.deliverer.name}</span>
                            {order.delivery.status === 'CANCELLED' && <span style={{ color: '#ef4444', fontSize: '10px' }}>(Annulée)</span>}
                          </div>
                        ) : (
                          <button
                            onClick={() => openAssignModal(order.delivery!.id)}
                            style={{
                              padding: '4px 8px',
                              fontSize: '11px',
                              backgroundColor: '#0284c7',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontWeight: '600'
                            }}
                          >
                            Assigner
                          </button>
                        )
                      ) : (
                        <span className="text-muted text-sm">—</span>
                      )}
                    </td>
                    <td><strong>{order.totalAmount.toFixed(2)} €</strong></td>
                    <td>
                      {new Date(order.createdAt).toLocaleDateString('fr-FR', {
                        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td>
                      <span className={`status-badge ${status.className}`}>{status.icon} {status.label}</span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        {nextStatus && (
                          <button
                            id={`advance-${order.id}`}
                            className="btn btn-primary btn-sm"
                            onClick={() => handleStatusChange(order.id, nextStatus)}
                            disabled={updatingId === order.id}
                          >
                            {updatingId === order.id ? <span className="btn-spinner"></span> : `→ ${statusConfig[nextStatus].label}`}
                          </button>
                        )}
                        {order.status !== 'CANCELLED' && order.status !== 'DELIVERED' && (
                          <button id={`cancel-${order.id}`} className="btn btn-danger btn-sm" onClick={() => handleStatusChange(order.id, 'CANCELLED')} disabled={updatingId === order.id}>
                            Annuler
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modale d'assignation de livreur */}
      {isAssignModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#fff',
            padding: '24px',
            borderRadius: '12px',
            width: '400px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>Assigner un livreur</h3>
              <button
                onClick={() => setIsAssignModalOpen(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {isLoadingDeliverers ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#666' }}>Chargement des livreurs...</div>
            ) : deliverers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#666' }}>Aucun livreur disponible. Veuillez en créer un dans l'onglet Utilisateurs.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
                {deliverers.map((deliverer) => (
                  <button
                    key={deliverer.id}
                    disabled={isAssigning}
                    onClick={() => handleAssign(deliverer.id)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #eee',
                      backgroundColor: '#f9f9f9',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                  >
                    <div>
                      <div style={{ fontWeight: '500' }}>{deliverer.name}</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>{deliverer.email}</div>
                    </div>
                    <span style={{ fontSize: '12px', color: '#0284c7', fontWeight: '600' }}>Sélectionner</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default DashboardPage

