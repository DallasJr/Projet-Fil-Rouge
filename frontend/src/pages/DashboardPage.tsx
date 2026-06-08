import { useState, useEffect } from 'react'
import type { ReactElement } from 'react'
import { Clock, ChefHat, Package, CheckCircle, XCircle, Truck, AlertCircle, RefreshCw, MapPin, X, ClipboardList } from 'lucide-react'
import { getAllOrders, updateOrderStatus, getOrderAuditLogs } from '../api/orders.api'
import type { Order, OrderStatus, AuditLog } from '../api/orders.api'
import { getAllUsers, assignDeliverer } from '../api/admin.api'
import type { UserDetail } from '../api/admin.api'
import { useSocket } from '../contexts/SocketContext'
import { DeliveryMap } from '../components/DeliveryMap'

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
  const { socket } = useSocket()

  // Modale d'assignation
  const [deliverers, setDeliverers] = useState<UserDetail[]>([])
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null)
  const [isLoadingDeliverers, setIsLoadingDeliverers] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)
  
  // supervision state
  const [trackingOrder, setTrackingOrder] = useState<Order | null>(null)
  // audit log state
  const [auditOrder, setAuditOrder] = useState<Order | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [isLoadingAudit, setIsLoadingAudit] = useState(false)

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

  useEffect(() => {
    if (!socket) return

    const onOrderCreated = () => fetchOrders()
    const onStatusUpdate = () => fetchOrders()
    const onDeliveryAssigned = () => fetchOrders()
    const onLocationUpdate = (data: { orderId: string; deliveryId: string; lat: number; lng: number; estimatedTime?: number }) => {
      console.log('📍 Admin: Reçu position livreur:', data)
      setOrders(prevOrders => prevOrders.map(order => {
        if (order.id === data.orderId && order.delivery) {
          const updatedOrder = {
            ...order,
            delivery: {
              ...order.delivery,
              delivererLat: data.lat,
              delivererLng: data.lng,
              estimatedTime: data.estimatedTime !== undefined ? data.estimatedTime : order.delivery.estimatedTime
            }
          }
          setTrackingOrder(current => current?.id === data.orderId ? updatedOrder : current)
          return updatedOrder
        }
        return order
      }))
    }

    socket.on('order_created', onOrderCreated)
    socket.on('order_status_updated', onStatusUpdate)
    socket.on('delivery_assigned', onDeliveryAssigned)
    socket.on('deliverer_location', onLocationUpdate)

    return () => {
      socket.off('order_created', onOrderCreated)
      socket.off('order_status_updated', onStatusUpdate)
      socket.off('delivery_assigned', onDeliveryAssigned)
      socket.off('deliverer_location', onLocationUpdate)
    }
  }, [socket])

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingId(orderId)
    try {
      const updated = await updateOrderStatus(orderId, newStatus)
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, ...updated } : o))
    } catch (err: any) {
      setError(err.response?.data?.error || 'Impossible de mettre à jour le statut.')
    } finally {
      setUpdatingId(null)
    }
  }

  const loadAuditLogs = async (order: Order) => {
    setAuditOrder(order)
    setAuditLogs([])
    setIsLoadingAudit(true)
    try {
      const logs = await getOrderAuditLogs(order.id)
      setAuditLogs(logs)
    } catch {
      setError('Impossible de charger le journal d\'audit.')
    } finally {
      setIsLoadingAudit(false)
    }
  }

  const openAssignModal = async (deliveryId: string) => {
    setSelectedDeliveryId(deliveryId)
    setIsAssignModalOpen(true)
    setIsLoadingDeliverers(true)
    try {
      const [deliverersData, adminsData] = await Promise.all([
        getAllUsers('DELIVERER', true),
        getAllUsers('ADMIN', true)
      ])
      setDeliverers([...deliverersData, ...adminsData])
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
                const prevStatus = currentIndex > 0 && currentIndex <= STATUS_FLOW.length - 1
                  ? STATUS_FLOW[currentIndex - 1]
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
                        {order.delivery && (
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            onClick={() => setTrackingOrder(order)}
                          >
                            <MapPin size={11} /> Carte
                          </button>
                        )}
                        <button
                          id={`audit-${order.id}`}
                          className="btn btn-secondary btn-sm"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => loadAuditLogs(order)}
                        >
                          <ClipboardList size={11} /> Historique
                        </button>
                        {prevStatus && (
                          <button
                            id={`rollback-${order.id}`}
                            className="btn btn-secondary btn-sm"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#64748b', color: '#fff' }}
                            onClick={() => handleStatusChange(order.id, prevStatus)}
                            disabled={updatingId === order.id}
                          >
                            {updatingId === order.id ? <span className="btn-spinner"></span> : `← ${statusConfig[prevStatus].label}`}
                          </button>
                        )}
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

      {/* Modal Journal d'Audit */}
      {auditOrder && (
        <div className="modal-backdrop" onClick={() => setAuditOrder(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px', width: '95%', padding: '24px', borderRadius: '16px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontWeight: 'bold', fontSize: '17px' }}>📋 Journal d'audit</h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>Commande #{auditOrder.id.slice(-6).toUpperCase()}</p>
              </div>
              <button onClick={() => setAuditOrder(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#666' }}>&times;</button>
            </div>

            {isLoadingAudit ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>Chargement…</div>
            ) : auditLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                <ClipboardList size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                <p style={{ margin: 0 }}>Aucun événement enregistré pour cette commande.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {auditLogs.map((log, i) => {
                  const actionLabels: Record<string, { label: string; color: string; icon: string }> = {
                    STATUS_CHANGE:       { label: 'Changement de statut', color: '#3b82f6', icon: '🔄' },
                    DELIVERER_ASSIGNED:  { label: 'Livreur assigné',       color: '#10b981', icon: '🚴' },
                    DELIVERER_REPLACED:  { label: 'Livreur remplacé',      color: '#f59e0b', icon: '🔁' },
                    DELIVERY_CANCELLED:  { label: 'Livraison annulée',     color: '#ef4444', icon: '❌' },
                  }
                  const cfg = actionLabels[log.action] ?? { label: log.action, color: '#64748b', icon: '📝' }
                  const roleColors: Record<string, string> = { ADMIN: '#7c3aed', DELIVERER: '#0284c7', CLIENT: '#059669' }
                  const roleColor = roleColors[log.actor.role] ?? '#64748b'

                  return (
                    <div key={log.id} style={{
                      display: 'flex',
                      gap: '12px',
                      padding: '12px',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      backgroundColor: i % 2 === 0 ? '#f8fafc' : '#fff',
                      position: 'relative'
                    }}>
                      <div style={{ fontSize: '20px', flexShrink: 0, lineHeight: 1 }}>{cfg.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '4px' }}>
                          <span style={{ fontWeight: '600', fontSize: '13px', color: cfg.color }}>{cfg.label}</span>
                          <span style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                            {new Date(log.createdAt).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' })}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', marginTop: '4px' }}>
                          Par <span style={{ fontWeight: '600', color: roleColor }}>{log.actor.name}</span>
                          <span style={{ marginLeft: '6px', padding: '1px 6px', borderRadius: '4px', backgroundColor: roleColor + '20', color: roleColor, fontSize: '10px', fontWeight: '600' }}>
                            {log.actor.role}
                          </span>
                        </div>
                        {(log.oldValue || log.newValue) && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '12px' }}>
                            {log.oldValue && <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: '#fee2e2', color: '#b91c1c', fontWeight: '600' }}>{log.oldValue}</span>}
                            {log.oldValue && log.newValue && <span style={{ color: '#94a3b8' }}>→</span>}
                            {log.newValue && <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: '#dcfce7', color: '#15803d', fontWeight: '600' }}>{log.newValue}</span>}
                          </div>
                        )}
                        {log.note && <div style={{ marginTop: '4px', fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>{log.note}</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Modal Carte Supervision pour l'Admin */}
      {trackingOrder && (
        <div className="modal-backdrop" onClick={() => setTrackingOrder(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', width: '95%', padding: '20px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, fontWeight: 'bold' }}>Supervision Livraison #{trackingOrder.id.slice(-6).toUpperCase()}</h3>
              <button onClick={() => setTrackingOrder(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#666' }}>&times;</button>
            </div>
            <div style={{ marginBottom: '15px' }}>
              <DeliveryMap
                destLat={trackingOrder.delivery?.destLat}
                destLng={trackingOrder.delivery?.destLng}
                delivererLat={trackingOrder.delivery?.delivererLat}
                delivererLng={trackingOrder.delivery?.delivererLng}
                estimatedTime={trackingOrder.delivery?.estimatedTime}
                height="350px"
              />
            </div>
            <div style={{ fontSize: '14px', color: '#444' }}>
              <div style={{ marginBottom: '5px' }}>
                📍 Adresse : <span style={{ fontWeight: '600' }}>{trackingOrder.delivery?.deliveryAddress}</span>
              </div>
              {trackingOrder.delivery?.deliverer && (
                <div style={{ color: '#15803d', fontWeight: '500', marginBottom: '5px' }}>
                  🚴 Livreur : {trackingOrder.delivery.deliverer.name} {trackingOrder.delivery.deliverer.phone ? `(${trackingOrder.delivery.deliverer.phone})` : ''}
                </div>
              )}
              {trackingOrder.delivery?.delivererLat && (
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Position : {trackingOrder.delivery.delivererLat.toFixed(5)}, {trackingOrder.delivery.delivererLng?.toFixed(5)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DashboardPage

