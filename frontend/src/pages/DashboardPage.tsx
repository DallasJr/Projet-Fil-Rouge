import { useState, useEffect } from 'react'
import type { ReactElement } from 'react'
import { Clock, ChefHat, Package, CheckCircle, XCircle, Truck, AlertCircle, RefreshCw, MapPin, X, ClipboardList, Filter, Search, ChevronDown, Heart } from 'lucide-react'
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

interface RichDescription {
  desc?: string
  calories?: string
  prepTime?: string
  allergens?: string
}

const parseDescription = (rawDesc: string | null): RichDescription => {
  if (!rawDesc) return {}
  if (rawDesc.trim().startsWith('{')) {
    try {
      return JSON.parse(rawDesc)
    } catch {
      // Ignore
    }
  }
  return { desc: rawDesc }
}

const CollapsibleOrderItems = ({ items, onItemClick }: { items: any[]; onItemClick: (item: any) => void }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const displayedItems = isExpanded ? items : items.slice(0, 3)
  const remainingCount = items.length - 3

  return (
    <div className="order-items-summary" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {displayedItems.map((item) => (
        <div
          key={item.id}
          onClick={() => onItemClick(item.item)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 10px',
            background: 'var(--color-surface-2)',
            borderRadius: '6px',
            border: '1px solid var(--color-border)',
            cursor: 'pointer',
            fontSize: '11px',
            transition: 'all 0.15s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)' }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
          title="Cliquer pour voir les détails du plat"
        >
          {item.item.imageUrl ? (
            <img src={item.item.imageUrl} alt={item.item.name} style={{ width: '28px', height: '28px', borderRadius: '4px', objectFit: 'cover', border: '1px solid var(--color-border)' }} />
          ) : (
            <div style={{ width: '28px', height: '28px', background: 'var(--color-surface-3)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🍽️</div>
          )}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700' }}>
              <span>{item.item.name}</span>
              <span style={{ color: 'var(--color-primary)' }}>×{item.quantity}</span>
            </div>
            <div style={{ color: 'var(--color-primary)', fontWeight: '600', fontSize: '10px' }}>
              {(item.unitPrice * item.quantity).toFixed(2)} €
            </div>
          </div>
        </div>
      ))}
      {items.length > 3 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            width: '100%',
            padding: '4px 8px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px dashed var(--color-border)',
            borderRadius: '6px',
            color: 'var(--color-primary)',
            fontSize: '10px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s',
            marginTop: '2px'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-primary-glow)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
        >
          {isExpanded ? (
            <>Masquer <ChevronDown size={10} style={{ transform: 'rotate(180deg)' }} /></>
          ) : (
            <>Voir {remainingCount} de plus <ChevronDown size={10} /></>
          )}
        </button>
      )}
    </div>
  )
}

const DashboardPage = () => {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'ALL'>('ALL')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const { socket } = useSocket()
  const [selectedItemDetail, setSelectedItemDetail] = useState<any | null>(null)

  // ── Favorites state & toggle ──
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('restau_favorites')
    return saved ? JSON.parse(saved) : []
  })

  const toggleFavorite = (id: string) => {
    setFavorites(prev => {
      const updated = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
      localStorage.setItem('restau_favorites', JSON.stringify(updated))
      return updated
    })
  }

  // Filtres
  const [searchTerm, setSearchTerm] = useState('')
  const [showFilters, setShowFilters] = useState(false)

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

  const filteredOrders = orders.filter((o) => {
    const matchesStatus = filterStatus === 'ALL' || o.status === filterStatus
    const matchesSearch = o.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.delivery?.deliveryAddress || '').toLowerCase().includes(searchTerm.toLowerCase())
    return matchesStatus && matchesSearch
  })

  const stats = {
    total: orders.length,
    pending: orders.filter((o) => o.status === 'PENDING').length,
    preparing: orders.filter((o) => ['ACCEPTED', 'PREPARING'].includes(o.status)).length,
    ready: orders.filter((o) => o.status === 'READY').length,
    revenue: orders.filter((o) => o.status !== 'CANCELLED').reduce((s, o) => s + o.totalAmount, 0),
  }

  const statCards = [
    { value: stats.total, label: 'Total commandes', icon: '📋', gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)', glow: 'rgba(99,102,241,0.25)' },
    { value: stats.pending, label: 'En attente', icon: '⏳', gradient: 'linear-gradient(135deg, #f59e0b, #f97316)', glow: 'rgba(245,158,11,0.25)' },
    { value: stats.preparing, label: 'En préparation', icon: '👨‍🍳', gradient: 'linear-gradient(135deg, #0ea5e9, #06b6d4)', glow: 'rgba(14,165,233,0.25)' },
    { value: stats.ready, label: 'Prêtes', icon: '✅', gradient: 'linear-gradient(135deg, #10b981, #059669)', glow: 'rgba(16,185,129,0.25)' },
    { value: `${stats.revenue.toFixed(2)} €`, label: "Chiffre d'affaires", icon: '💶', gradient: 'linear-gradient(135deg, #f97316, #ef4444)', glow: 'rgba(249,115,22,0.25)' },
  ]

  return (
    <div className="dashboard-page">
      <div className="page-header" style={{ flexDirection: 'column', alignItems: 'stretch', display: 'flex' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              📊 Dashboard Admin
            </h1>
            <p className="page-subtitle">Gérez toutes les commandes en temps réel</p>
          </div>
          <button id="btn-refresh" className="btn btn-secondary" onClick={fetchOrders} disabled={isLoading}>
            <RefreshCw size={15} className={isLoading ? 'spin' : ''} /> Actualiser
          </button>
        </div>

        {/* ── Filtre collapsible (pattern uniforme) ── */}
        <div className="filter-panel" style={{ width: '100%', marginTop: '16px' }}>
          <div className="filter-panel-header" onClick={() => setShowFilters(v => !v)}>
            <span className="filter-panel-title">
              <Filter size={13} style={{ color: 'var(--color-primary)' }} /> Filtres &amp; Recherche
              {(searchTerm || filterStatus !== 'ALL') && (
                <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '10px', background: 'var(--color-primary)', color: '#fff', fontWeight: '700', marginLeft: '6px' }}>
                  {[searchTerm && '1', filterStatus !== 'ALL' && '1'].filter(Boolean).length}
                </span>
              )}
            </span>
            <span className={`filter-panel-toggle ${showFilters ? 'open' : ''}`}>
              {showFilters ? 'Masquer' : 'Afficher'} <ChevronDown size={13} style={{ marginLeft: '4px' }} />
            </span>
          </div>
          {showFilters && (
            <div className="filter-panel-body" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '14px' }}>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ margin: 0, flex: '1', minWidth: '220px' }}>
                  <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Recherche</label>
                  <div style={{ position: 'relative' }}>
                    <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-dim)' }} />
                    <input type="text" className="form-input" placeholder="ID commande, client, adresse..." value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)} style={{ paddingLeft: '30px', fontSize: '13px' }} />
                  </div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => { setSearchTerm(''); setFilterStatus('ALL') }} style={{ height: '38px' }}>
                  Réinitialiser
                </button>
              </div>
              
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
                <label className="form-label" style={{ fontSize: '11px', marginBottom: '8px', display: 'block' }}>Statut de commande</label>
                <div className="dashboard-filters" style={{ margin: 0 }}>
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
              </div>
            </div>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error"><AlertCircle size={16} /><span>{error}</span></div>}

      {/* Stats premium */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        {statCards.map((card, i) => (
          <div key={i} style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: `0 4px 20px ${card.glow}`,
            transition: 'transform 0.2s, box-shadow 0.2s',
            cursor: 'default',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 12px 30px ${card.glow}` }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = `0 4px 20px ${card.glow}` }}
          >
            <div style={{
              position: 'absolute', top: '-20px', right: '-10px',
              width: '80px', height: '80px',
              background: card.gradient,
              borderRadius: '50%',
              opacity: 0.12,
            }} />
            <div style={{ fontSize: '22px', lineHeight: 1 }}>{card.icon}</div>
            <div style={{ fontSize: '28px', fontWeight: '900', background: card.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1.1 }}>
              {card.value}
            </div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {card.label}
            </div>
          </div>
        ))}
      </div>

      {/* Removed old separate filter panel since it is now merged inside page-header */}

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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '28px', height: '28px', borderRadius: '50%',
                          background: 'linear-gradient(135deg, #0ea5e9, #2563eb)',
                          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '11px', fontWeight: '800', flexShrink: 0
                        }}>
                          {(order.customer?.name || 'C').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: '600' }}>{order.customer?.name || '—'}</div>
                          {order.customer?.phone && <div style={{ color: 'var(--color-text-dim)', fontSize: '11px' }}>{order.customer.phone}</div>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <CollapsibleOrderItems items={order.items} onItemClick={setSelectedItemDetail} />
                    </td>
                    <td>
                      {order.delivery ? (
                        <div className="delivery-cell" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={12} style={{ color: 'var(--color-primary)' }} />
                          <span className="text-sm" title={order.delivery.deliveryAddress}>{order.delivery.deliveryAddress.slice(0, 25)}…</span>
                        </div>
                      ) : (
                        <span className="text-muted text-sm">Sur place</span>
                      )}
                    </td>
                    <td>
                      {order.delivery ? (
                        order.delivery.deliverer ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                              width: '28px', height: '28px', borderRadius: '50%',
                              background: 'linear-gradient(135deg, #10b981, #059669)',
                              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '11px', fontWeight: '800', flexShrink: 0
                            }}>
                              {order.delivery.deliverer.name.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: '500', fontSize: '13px' }}>{order.delivery.deliverer.name}</span>
                              {order.delivery.status === 'CANCELLED' && <span style={{ color: '#ef4444', fontSize: '10px' }}>(Annulée)</span>}
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => openAssignModal(order.delivery!.id)}
                            style={{
                              padding: '6px 12px',
                              fontSize: '11px',
                              backgroundColor: 'rgba(2,132,199,0.1)',
                              border: '1.5px solid #0284c7',
                              color: '#0284c7',
                              borderRadius: '20px',
                              cursor: 'pointer',
                              fontWeight: '700',
                              transition: 'all 0.15s'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#0284c7'; e.currentTarget.style.color = '#fff' }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(2,132,199,0.1)'; e.currentTarget.style.color = '#0284c7' }}
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
        <div className="modal-overlay" onClick={() => !isAssigning && setIsAssignModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🚴 Assigner un livreur
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--color-text-muted)' }}>Sélectionnez le livreur disponible</p>
              </div>
              <button
                onClick={() => setIsAssignModalOpen(false)}
                style={{ border: 'none', background: 'rgba(255,255,255,0.07)', borderRadius: '8px', cursor: 'pointer', padding: '8px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center' }}
              >
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              {isLoadingDeliverers ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-muted)' }}>
                  <div className="loading-spinner" style={{ margin: '0 auto 12px' }} />
                  Chargement des livreurs...
                </div>
              ) : deliverers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-muted)' }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>🚫</div>
                  <p style={{ margin: 0, fontSize: '14px' }}>Aucun livreur disponible.<br />Créez-en un dans l'onglet Utilisateurs.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '340px', overflowY: 'auto' }}>
                  {deliverers.map((deliverer) => (
                    <button
                      key={deliverer.id}
                      disabled={isAssigning}
                      onClick={() => handleAssign(deliverer.id)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '14px 16px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-bg)',
                        cursor: isAssigning ? 'not-allowed' : 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.18s',
                        opacity: isAssigning ? 0.7 : 1,
                      }}
                      onMouseEnter={(e) => { if (!isAssigning) { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.backgroundColor = 'var(--color-primary-glow)' } }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.backgroundColor = 'var(--color-bg)' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '38px', height: '38px', background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>🚴</div>
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--color-text)' }}>{deliverer.name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{deliverer.email}</div>
                        </div>
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '20px', background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))', color: '#fff', whiteSpace: 'nowrap' }}>Assigner →</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Journal d'Audit */}
      {auditOrder && (
        <div className="modal-overlay" onClick={() => setAuditOrder(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>📋 Journal d'audit</h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--color-text-muted)' }}>Commande #{auditOrder.id.slice(-6).toUpperCase()}</p>
              </div>
              <button onClick={() => setAuditOrder(null)} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--color-text-dim)', lineHeight: 1 }}>&times;</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {isLoadingAudit ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--color-text-muted)' }}>Chargement…</div>
              ) : auditLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--color-text-muted)' }}>
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
                        display: 'flex', gap: '12px', padding: '12px',
                        borderRadius: '10px', border: '1px solid var(--color-border)',
                        backgroundColor: i % 2 === 0 ? 'var(--color-surface-2)' : 'var(--color-surface)',
                      }}>
                        <div style={{ fontSize: '20px', flexShrink: 0, lineHeight: 1 }}>{cfg.icon}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '4px' }}>
                            <span style={{ fontWeight: '600', fontSize: '13px', color: cfg.color }}>{cfg.label}</span>
                            <span style={{ fontSize: '11px', color: 'var(--color-text-dim)', whiteSpace: 'nowrap' }}>
                              {new Date(log.createdAt).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' })}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', marginTop: '4px' }}>
                            Par <span style={{ fontWeight: '600', color: roleColor }}>{log.actor.name}</span>
                            <span style={{ marginLeft: '6px', padding: '1px 6px', borderRadius: '4px', backgroundColor: roleColor + '20', color: roleColor, fontSize: '10px', fontWeight: '600' }}>{log.actor.role}</span>
                          </div>
                          {(log.oldValue || log.newValue) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '12px' }}>
                              {log.oldValue && <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: '#fee2e2', color: '#b91c1c', fontWeight: '600' }}>{log.oldValue}</span>}
                              {log.oldValue && log.newValue && <span style={{ color: 'var(--color-text-dim)' }}>→</span>}
                              {log.newValue && <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: '#dcfce7', color: '#15803d', fontWeight: '600' }}>{log.newValue}</span>}
                            </div>
                          )}
                          {log.note && <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--color-text-dim)', fontStyle: 'italic' }}>{log.note}</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Modal Carte Supervision pour l'Admin */}
      {trackingOrder && (
        <div className="modal-overlay" onClick={() => setTrackingOrder(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📍 Supervision Livraison #{trackingOrder.id.slice(-6).toUpperCase()}
                </h3>
                {trackingOrder.delivery?.deliverer && (
                  <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                    🚴 {trackingOrder.delivery.deliverer.name} → {trackingOrder.customer?.name || 'Client'}
                  </p>
                )}
              </div>
              <button onClick={() => setTrackingOrder(null)} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--color-text-dim)', lineHeight: 1 }}>&times;</button>
            </div>
            <div style={{ flex: 1, minHeight: '350px' }}>
              <DeliveryMap
                destLat={trackingOrder.delivery?.destLat}
                destLng={trackingOrder.delivery?.destLng}
                delivererLat={trackingOrder.delivery?.delivererLat}
                delivererLng={trackingOrder.delivery?.delivererLng}
                estimatedTime={trackingOrder.delivery?.estimatedTime}
                height="350px"
              />
            </div>
            <div style={{ padding: '14px 20px', fontSize: '13px', color: 'var(--color-text)', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <div>📍 <span style={{ fontWeight: '600' }}>{trackingOrder.delivery?.deliveryAddress}</span></div>
              {trackingOrder.delivery?.deliverer && (
                <div style={{ color: '#15803d', fontWeight: '500' }}>
                  🚴 Livreur : {trackingOrder.delivery.deliverer.name}{trackingOrder.delivery.deliverer.phone ? ` (${trackingOrder.delivery.deliverer.phone})` : ''}
                </div>
              )}
              {trackingOrder.delivery?.delivererLat && (
                <div style={{ fontSize: '12px', color: 'var(--color-text-dim)' }}>
                  Position : {trackingOrder.delivery.delivererLat.toFixed(5)}, {trackingOrder.delivery.delivererLng?.toFixed(5)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

       {/* Modal Détails du Plat */}
       {selectedItemDetail && (() => {
         const rich = parseDescription(selectedItemDetail.description)
         const isFav = favorites.includes(selectedItemDetail.id)
         return (
           <div className="modal-overlay" onClick={() => setSelectedItemDetail(null)}>
             <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px', overflow: 'hidden', padding: 0, position: 'relative' }}>
               
               {/* Heart button in the top right corner */}
               <button
                 type="button"
                 onClick={() => toggleFavorite(selectedItemDetail.id)}
                 style={{
                   position: 'absolute',
                   top: '16px',
                   right: '16px',
                   zIndex: 50,
                   background: 'rgba(0, 0, 0, 0.5)',
                   border: 'none',
                   cursor: 'pointer',
                   color: isFav ? '#ef4444' : '#fff',
                   display: 'flex',
                   alignItems: 'center',
                   justifyContent: 'center',
                   padding: '8px',
                   borderRadius: '50%',
                   backdropFilter: 'blur(4px)',
                   boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                   transition: 'transform 0.2s',
                 }}
                 title={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
               >
                 <Heart size={18} fill={isFav ? 'currentColor' : 'none'} />
               </button>

               {/* Hero image */}
               {selectedItemDetail.imageUrl ? (
                 <div style={{ position: 'relative', height: '240px', overflow: 'hidden' }}>
                   <img
                     src={selectedItemDetail.imageUrl}
                     alt={selectedItemDetail.name}
                     style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                   />
                   <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 50%)' }} />
                   <div style={{ position: 'absolute', bottom: '16px', left: '20px', right: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                     <h3 style={{ margin: 0, fontWeight: '900', fontSize: '1.4rem', color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>{selectedItemDetail.name}</h3>
                     <span style={{ fontSize: '1.3rem', fontWeight: '900', color: '#fff', background: 'var(--color-primary)', padding: '4px 12px', borderRadius: '20px', flexShrink: 0, marginLeft: '12px' }}>
                       {selectedItemDetail.price.toFixed(2)} €
                     </span>
                   </div>
                 </div>
               ) : (
                 <div style={{ height: '160px', background: 'linear-gradient(135deg, var(--color-surface-2), var(--color-border))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '56px' }}>
                   🍔
                 </div>
               )}

               <div style={{ padding: '20px 24px 24px' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                   <h3 style={{ margin: 0, fontWeight: '800', fontSize: '1.2rem', color: 'var(--color-text)' }}>{selectedItemDetail.name}</h3>
                   {!selectedItemDetail.imageUrl && <span style={{ fontSize: '1.2rem', fontWeight: '900', color: 'var(--color-primary)' }}>{selectedItemDetail.price.toFixed(2)} €</span>}
                 </div>

                 {rich.desc && (
                   <p style={{ fontSize: '13.5px', color: 'var(--color-text-muted)', margin: '0 0 16px', lineHeight: 1.6 }}>{rich.desc}</p>
                 )}

                 {(rich.prepTime || rich.calories || rich.allergens) && (
                   <div style={{ display: 'flex', gap: '8px', fontSize: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
                     {rich.prepTime && (
                       <span style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-dim)', padding: '5px 10px', borderRadius: '8px', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}>
                         ⏱️ {rich.prepTime} min
                       </span>
                     )}
                     {rich.calories && (
                       <span style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-dim)', padding: '5px 10px', borderRadius: '8px', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}>
                         🔥 {rich.calories} kcal
                       </span>
                     )}
                     {rich.allergens && (
                       <span style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '5px 10px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)', fontWeight: '600' }}>
                         ⚠️ Allergènes : {rich.allergens}
                       </span>
                     )}
                   </div>
                 )}

                 {selectedItemDetail.category && (
                   <div style={{ marginBottom: '16px' }}>
                     <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-dim)', background: 'var(--color-surface-2)', padding: '3px 10px', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
                       {selectedItemDetail.category}
                     </span>
                   </div>
                 )}

                 <button className="btn btn-secondary btn-full" onClick={() => setSelectedItemDetail(null)} style={{ marginTop: '4px' }}>
                   Fermer
                 </button>
               </div>
             </div>
           </div>
         )
       })()}
    </div>
  )
}

export default DashboardPage

