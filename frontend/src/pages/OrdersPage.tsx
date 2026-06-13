import { useState, useEffect } from 'react'
import type { ReactElement } from 'react'
import { Clock, CheckCircle, XCircle, ChefHat, Package, Truck, AlertCircle, MapPin, MessageSquare, Filter, Search, ChevronDown, RotateCcw, HelpCircle, Maximize2, Minimize2, AlertTriangle, Heart } from 'lucide-react'
import { getMyOrders, confirmDelivery, updateOrderStatus } from '../api/orders.api'
import type { Order, OrderStatus } from '../api/orders.api'
import { ChatWindow } from '../components/ChatWindow'
import { useSocket } from '../contexts/SocketContext'
import { DeliveryMap } from '../components/DeliveryMap'
import { useToast } from '../contexts/ToastContext'

const statusConfig: Record<OrderStatus, { label: string; icon: ReactElement; className: string }> = {
  PENDING:    { label: 'En attente',      icon: <Clock size={13} />,        className: 'status-pending' },
  ACCEPTED:   { label: 'Acceptée',        icon: <CheckCircle size={13} />,  className: 'status-accepted' },
  PREPARING:  { label: 'En préparation',  icon: <ChefHat size={13} />,      className: 'status-preparing' },
  READY:      { label: 'Prête',           icon: <Package size={13} />,      className: 'status-ready' },
  DELIVERING: { label: 'En livraison',    icon: <Truck size={13} />,        className: 'status-delivering' },
  DELIVERED:  { label: 'Livrée',          icon: <CheckCircle size={13} />,  className: 'status-delivered' },
  CANCELLED:  { label: 'Annulée',         icon: <XCircle size={13} />,      className: 'status-cancelled' },
}

// Ordre des statuts pour afficher une timeline
const STATUS_TIMELINE: OrderStatus[] = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'DELIVERING', 'DELIVERED']

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

// Component de compte à rebours pour annulation client (2 min max)
const CancelTimerButton = ({ createdAt, onCancel, isDisabled }: { createdAt: string; onCancel: () => void; isDisabled: boolean }) => {
  const [timeLeft, setTimeLeft] = useState(0)

  useEffect(() => {
    const checkTime = () => {
      const created = new Date(createdAt).getTime()
      const diff = Math.max(0, 120000 - (Date.now() - created)) // 2 minutes
      setTimeLeft(Math.ceil(diff / 1000))
    }
    checkTime()
    const timer = setInterval(checkTime, 1000)
    return () => clearInterval(timer)
  }, [createdAt])

  if (timeLeft <= 0) return null

  return (
    <button
      className="btn btn-danger btn-sm"
      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
      onClick={onCancel}
      disabled={isDisabled}
    >
      <XCircle size={13} /> Annuler ({timeLeft}s)
    </button>
  )
}

const OrdersPage = () => {
  const { addToast } = useToast()
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeChatOrderId, setActiveChatOrderId] = useState<string | null>(null)
  const [trackingOrder, setTrackingOrder] = useState<Order | null>(null)
  const { socket } = useSocket()

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
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderStatus>('ALL')
  const [showFilters, setShowFilters] = useState(false)

  // Nouveaux états
  const [selectedItemDetail, setSelectedItemDetail] = useState<any | null>(null)
  const [isMapFullScreen, setIsMapFullScreen] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  
  // Support / Signalement
  const [reportingOrder, setReportingOrder] = useState<Order | null>(null)
  const [reportType, setReportType] = useState('MISSING_ITEM')
  const [reportComment, setReportComment] = useState('')
  const [isSendingReport, setIsSendingReport] = useState(false)

  // Statistiques de consommation client
  const totalOrdersCount = orders.length
  const completedOrders = orders.filter(o => o.status === 'DELIVERED')
  const totalSpent = completedOrders.reduce((acc, o) => acc + o.totalAmount, 0)
  const activeOrdersCount = orders.filter(o => !['DELIVERED', 'CANCELLED'].includes(o.status)).length

  // Calcul du plat préféré
  const itemCounts: Record<string, { count: number; name: string }> = {}
  orders.forEach(o => {
    o.items.forEach(it => {
      if (it.item) {
        if (!itemCounts[it.itemId]) {
          itemCounts[it.itemId] = { count: 0, name: it.item.name }
        }
        itemCounts[it.itemId].count += it.quantity
      }
    })
  })
  let favoriteDish = '—'
  let maxCount = 0
  Object.values(itemCounts).forEach(entry => {
    if (entry.count > maxCount) {
      maxCount = entry.count
      favoriteDish = `${entry.name} (${entry.count}x)`
    }
  })

  // Recommander à l'identique
  const handleReorder = (order: Order) => {
    const payload = order.items.map(it => ({ id: it.itemId, qty: it.quantity }))
    localStorage.setItem('reorder_items', JSON.stringify(payload))
    addToast('Articles de la commande ajoutés au panier ! Redirection...', 'info')
    setTimeout(() => {
      window.location.href = '/menu'
    }, 1000)
  }

  // Annuler la commande côté client
  const handleCancelOrder = async (orderId: string) => {
    if (!window.confirm('Voulez-vous vraiment annuler cette commande ?')) return
    setCancellingId(orderId)
    try {
      await updateOrderStatus(orderId, 'CANCELLED')
      addToast('Commande annulée avec succès.', 'success')
      fetchOrders()
    } catch (err: any) {
      addToast(err.response?.data?.error || "Erreur lors de l'annulation", 'error')
    } finally {
      setCancellingId(null)
    }
  }

  // Soumettre un signalement
  const handleSendReport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reportingOrder) return
    setIsSendingReport(true)

    const typeLabels: Record<string, string> = {
      MISSING_ITEM: 'Plat manquant / incorrect',
      LATE_DELIVERY: 'Retard important de livraison',
      POOR_QUALITY: 'Problème de qualité',
      OTHER: 'Autre problème'
    }

    const reportMessage = `⚠️ [SIGNALEMENT SUPPORT]
Type : ${typeLabels[reportType] || reportType}
Commentaire : ${reportComment || 'Aucun détail fourni'}`

    try {
      // Envoyer un message dans le chat pour que l'admin le voie
      if (socket) {
        socket.emit('send_message', { orderId: reportingOrder.id, content: reportMessage })
      }
      addToast('Votre signalement a été enregistré et transmis au support client.', 'success')
      setReportingOrder(null)
      setReportComment('')
    } catch {
      addToast('Impossible de transmettre le signalement.', 'error')
    } finally {
      setIsSendingReport(false)
    }
  }

  const fetchOrders = async () => {
    try {
      const data = await getMyOrders()
      setOrders(data)
    } catch {
      setError('Impossible de charger vos commandes.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  // Écouter les changements de statut et les assignations en temps réel
  useEffect(() => {
    if (!socket) return

    const onStatusUpdate = () => fetchOrders()
    const onDeliveryAssigned = () => fetchOrders()
    const onLocationUpdate = (data: { orderId: string; deliveryId: string; lat: number; lng: number; estimatedTime?: number }) => {
      console.log('📍 Reçu mise à jour position livreur:', data)
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
          // Si cette commande est actuellement affichée dans la modal de suivi, on met aussi à jour trackingOrder
          setTrackingOrder(currentTracking => {
            if (currentTracking && currentTracking.id === data.orderId) {
              return updatedOrder
            }
            return currentTracking
          })
          return updatedOrder
        }
        return order
      }))
    }

    socket.on('order_status_updated', onStatusUpdate)
    socket.on('delivery_assigned', onDeliveryAssigned)
    socket.on('deliverer_location', onLocationUpdate)

    return () => {
      socket.off('order_status_updated', onStatusUpdate)
      socket.off('delivery_assigned', onDeliveryAssigned)
      socket.off('deliverer_location', onLocationUpdate)
    }
  }, [socket])

  const handleConfirmDelivery = async (orderId: string) => {
    if (!window.confirm('Confirmez-vous avoir reçu votre commande ?')) {
      return
    }
    try {
      await confirmDelivery(orderId)
      fetchOrders()
    } catch {
      setError('Impossible de confirmer la livraison.')
    }
  }

  if (isLoading) return <div className="loading-screen"><div className="loading-spinner"></div></div>

  const filteredOrders = orders.filter((o) => {
    const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter
    const matchesSearch = o.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.items.some(item => item.item.name.toLowerCase().includes(searchTerm.toLowerCase()))
    return matchesStatus && matchesSearch
  })

  return (
    <div className="orders-page">
      <div className="page-header" style={{ flexDirection: 'column', alignItems: 'stretch', display: 'flex' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h1 className="page-title">Mes Commandes</h1>
            <p className="page-subtitle">Suivez l'état de vos commandes en temps réel</p>
          </div>
        </div>

        {/* ── Filtre collapsible (pattern uniforme) ── */}
        {orders.length > 0 && (
          <div className="filter-panel" style={{ width: '100%', marginTop: '16px' }}>
            <div className="filter-panel-header" onClick={() => setShowFilters(v => !v)}>
              <span className="filter-panel-title">
                <Filter size={13} style={{ color: 'var(--color-primary)' }} /> Filtres &amp; Recherche
                {(searchTerm || statusFilter !== 'ALL') && (
                  <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '10px', background: 'var(--color-primary)', color: '#fff', fontWeight: '700', marginLeft: '6px' }}>
                    {[searchTerm && '1', statusFilter !== 'ALL' && '1'].filter(Boolean).length}
                  </span>
                )}
              </span>
              <span className={`filter-panel-toggle ${showFilters ? 'open' : ''}`}>
                {showFilters ? 'Masquer' : 'Afficher'} <ChevronDown size={13} style={{ marginLeft: '4px' }} />
              </span>
            </div>
            {showFilters && (
              <div className="filter-panel-body">
                <div className="form-group" style={{ margin: 0, flex: '1', minWidth: '180px' }}>
                  <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Recherche</label>
                  <div style={{ position: 'relative' }}>
                    <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-dim)' }} />
                    <input type="text" className="form-input" placeholder="ID commande, nom de plat..." value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)} style={{ paddingLeft: '30px', fontSize: '13px' }} />
                  </div>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Statut</label>
                  <select className="form-input form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} style={{ fontSize: '13px', minWidth: '160px' }}>
                    <option value="ALL">Toutes</option>
                    {Object.entries(statusConfig).map(([key, value]) => (
                      <option key={key} value={key}>{value.label}</option>
                    ))}
                  </select>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => { setSearchTerm(''); setStatusFilter('ALL') }} style={{ height: '38px' }}>
                  Réinitialiser
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {error && <div className="alert alert-error"><AlertCircle size={16} /><span>{error}</span></div>}

      {/* Statistiques Client Premium */}
      {orders.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'Commandes passées', value: totalOrdersCount, icon: '📋', gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)', glow: 'rgba(99,102,241,0.15)' },
            { label: 'Plat préféré', value: favoriteDish, icon: '🍔', gradient: 'linear-gradient(135deg, #f59e0b, #f97316)', glow: 'rgba(245,158,11,0.15)', valueStyle: { fontSize: '14px', fontWeight: '800' } },
            { label: 'Total dépensé', value: `${totalSpent.toFixed(2)} €`, icon: '💶', gradient: 'linear-gradient(135deg, #10b981, #059669)', glow: 'rgba(16,185,129,0.15)' },
            { label: 'Commandes en cours', value: activeOrdersCount, icon: '⏳', gradient: 'linear-gradient(135deg, #0ea5e9, #06b6d4)', glow: 'rgba(14,165,233,0.15)' }
          ].map((card, i) => (
            <div key={i} style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: `0 4px 20px ${card.glow}`,
              cursor: 'default',
            }}>
              <div style={{
                position: 'absolute', top: '-20px', right: '-10px',
                width: '60px', height: '60px',
                background: card.gradient,
                borderRadius: '50%',
                opacity: 0.1,
              }} />
              <div style={{ fontSize: '18px', lineHeight: 1 }}>{card.icon}</div>
              <div style={{
                fontSize: '22px',
                fontWeight: '900',
                background: card.gradient,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                lineHeight: 1.2,
                ...card.valueStyle
              }}>
                {card.value}
              </div>
              <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                {card.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Removed old separate filter panel since it is now merged inside page-header */}

      {orders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🛍️</div>
          <h2>Aucune commande pour l'instant</h2>
          <p>Rendez-vous sur le menu pour passer votre première commande !</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <h2>Aucune commande correspondante</h2>
          <p>Ajustez vos filtres ou réinitialisez la recherche.</p>
        </div>
      ) : (
        <div className="orders-list">
          {filteredOrders.map((order) => {
            const status = statusConfig[order.status]
            const currentIdx = STATUS_TIMELINE.indexOf(order.status)
            const isCancelled = order.status === 'CANCELLED'

            // Surcharger les statuts pour la livraison
            let statusLabel = status.label
            let statusClass = status.className
            let statusIcon = status.icon

            if (order.status === 'READY' && order.delivery && order.delivery.status === 'ASSIGNED') {
              statusLabel = 'Livreur en route'
              statusClass = 'status-preparing'
              statusIcon = <Truck size={13} />
            } else if (order.status === 'DELIVERING' && order.delivery) {
              if (order.delivery.confirmedByDeliverer && !order.delivery.confirmedByCustomer) {
                statusLabel = 'Livrée (à confirmer)'
                statusClass = 'status-ready'
              } else if (order.delivery.confirmedByCustomer && !order.delivery.confirmedByDeliverer) {
                statusLabel = 'Reçue (attente livreur)'
                statusClass = 'status-preparing'
              }
            }

            return (
              <div key={order.id} id={`order-${order.id}`} className="order-card">
                <div className="order-card-header">
                  <div className="order-id">
                    Commande <span>#{order.id.slice(-6).toUpperCase()}</span>
                  </div>
                  <span className={`status-badge ${statusClass}`}>
                    {statusIcon} {statusLabel}
                  </span>
                </div>

                {/* Timeline de progression */}
                {!isCancelled && (
                  <div className="order-timeline">
                    {STATUS_TIMELINE.map((s, idx) => {
                      const isCompleted = idx <= currentIdx
                      const isCurrent = idx === currentIdx
                      // Timeline text overrides
                      let label = statusConfig[s].label
                      if (s === 'READY' && order.delivery && order.delivery.status === 'ASSIGNED') {
                        label = 'Livreur en route'
                      }
                      return (
                        <div key={s} className={`timeline-step ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}>
                          <div className="timeline-dot"></div>
                          <span className="timeline-label">{label}</span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Articles styled as cart-items */}
                <div className="order-items-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                  {order.items.map((item) => {
                    const itemRich = parseDescription((item.item as any).description)
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedItemDetail(item.item)}
                        style={{
                          display: 'flex',
                          gap: '12px',
                          padding: '10px 12px',
                          background: 'var(--color-surface-2)',
                          borderRadius: '8px',
                          border: '1px solid var(--color-border)',
                          alignItems: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
                        title="Cliquer pour voir les détails du plat"
                      >
                        {item.item.imageUrl ? (
                          <img
                            src={item.item.imageUrl}
                            alt={item.item.name}
                            style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                          />
                        ) : (
                          <div style={{ width: '44px', height: '44px', background: 'var(--color-surface-3)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            🍽️
                          </div>
                        )}
                        
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--color-text)' }}>{item.item.name}</span>
                            <span style={{ fontSize: '11px', fontWeight: '800', background: 'var(--color-primary-glow)', color: 'var(--color-primary)', padding: '2px 6px', borderRadius: '4px' }}>
                              ×{item.quantity}
                            </span>
                          </div>
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                            <span style={{ color: 'var(--color-primary)', fontWeight: '700' }}>{(item.unitPrice * item.quantity).toFixed(2)} €</span>
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{item.unitPrice.toFixed(2)} € / u</span>
                          </div>

                          {(itemRich.calories || itemRich.prepTime) && (
                            <div style={{ display: 'flex', gap: '8px', fontSize: '10px', color: 'var(--color-text-dim)', marginTop: '2px' }}>
                              {itemRich.calories && <span>🔥 {itemRich.calories} kcal</span>}
                              {itemRich.prepTime && <span>⏱️ {itemRich.prepTime} min</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  </div>

                {/* Livraison */}
                {order.delivery && (
                  <div className="order-delivery-info" style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <MapPin size={13} />
                      <span>{order.delivery.deliveryAddress}</span>
                      <span className={`status-badge ${order.delivery.status === 'DELIVERED' ? 'status-delivered' : 'status-preparing'}`}>
                        {order.delivery.status === 'ASSIGNED' ? 'Livreur assigné' : 
                         order.delivery.status === 'PICKED_UP' ? 'En cours de livraison' : 
                         order.delivery.status}
                      </span>
                      {order.delivery.confirmedByDeliverer && !order.delivery.confirmedByCustomer && (
                        <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: '500' }}>
                          ✓ Le livreur confirme le dépôt
                        </span>
                      )}
                      {order.delivery.confirmedByCustomer && !order.delivery.confirmedByDeliverer && (
                        <span style={{ fontSize: '11px', color: '#b45309', fontWeight: '500' }}>
                          ⏳ En attente de confirmation du livreur
                        </span>
                      )}
                    </div>
                    {order.delivery.deliverer && (
                      <div style={{ fontSize: '13px', color: '#15803d', fontWeight: '500' }}>
                        🚴 Livreur assigné : {order.delivery.deliverer.name} {order.delivery.deliverer.phone ? `(${order.delivery.deliverer.phone})` : ''}
                      </div>
                    )}
                  </div>
                )}

                {order.note && (
                  <div className="order-notes">
                    <span className="order-notes-label">Notes :</span> {order.note}
                  </div>
                )}

                <div className="order-card-footer" style={{ gap: '8px', flexWrap: 'wrap' }}>
                  <span className="order-date">
                    {new Date(order.createdAt).toLocaleDateString('fr-FR', {
                      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                  
                  {order.delivery && (
                    <>
                      {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
                        <button 
                          className="btn btn-secondary btn-sm" 
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          onClick={() => setTrackingOrder(order)}
                        >
                          <MapPin size={13} /> Carte Live
                        </button>
                      )}
                      <button 
                        className="btn btn-secondary btn-sm" 
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        onClick={() => setActiveChatOrderId(order.id)}
                      >
                        <MessageSquare size={13} /> {['DELIVERED', 'CANCELLED'].includes(order.status) ? 'Historique Chat' : 'Chat Live'}
                      </button>
                    </>
                  )}

                  {order.delivery && order.status === 'DELIVERING' && !order.delivery.confirmedByCustomer && (
                    <button 
                      className="btn btn-primary btn-sm" 
                      style={{ backgroundColor: '#16a34a', color: '#fff', border: 'none' }}
                      onClick={() => handleConfirmDelivery(order.id)}
                    >
                      Confirmer la réception
                    </button>
                  )}

                  {order.status === 'PENDING' && (
                    <CancelTimerButton
                      createdAt={order.createdAt}
                      onCancel={() => handleCancelOrder(order.id)}
                      isDisabled={cancellingId === order.id}
                    />
                  )}

                  {['DELIVERED', 'CANCELLED'].includes(order.status) && (
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      onClick={() => handleReorder(order)}
                    >
                      <RotateCcw size={13} style={{ color: 'var(--color-primary)' }} /> Recommander
                    </button>
                  )}

                  {order.status !== 'CANCELLED' && (
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#f59e0b' }}
                      onClick={() => setReportingOrder(order)}
                    >
                      <HelpCircle size={13} /> Signaler
                    </button>
                  )}
                  
                  <span className="order-total">{order.totalAmount.toFixed(2)} €</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Chat Live */}
      {activeChatOrderId && (() => {
        const chatOrder = orders.find(o => o.id === activeChatOrderId)
        const interlocutorName = chatOrder?.delivery?.deliverer?.name || 'Support Client'
        const interlocutorRole = chatOrder?.delivery?.deliverer ? 'DELIVERER' : 'ADMIN'
        return (
          <div className="modal-overlay" onClick={() => setActiveChatOrderId(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ padding: 0, maxWidth: '440px', overflow: 'hidden' }}>
              <ChatWindow 
                orderId={activeChatOrderId} 
                onClose={() => setActiveChatOrderId(null)} 
                isClosed={['DELIVERED', 'CANCELLED'].includes(chatOrder?.status || '')}
                interlocutorName={interlocutorName}
                interlocutorRole={interlocutorRole}
                chatList={orders.filter(o => o.delivery).map(o => ({
                  orderId: o.id,
                  label: `#${o.id.slice(-6).toUpperCase()} — ${o.delivery?.deliverer?.name || 'Support Client'}`,
                  active: o.id === activeChatOrderId,
                  interlocutorName: o.delivery?.deliverer?.name || 'Support Client',
                  interlocutorRole: o.delivery?.deliverer ? 'DELIVERER' : 'ADMIN',
                  orderStatus: o.status
                }))}
                onChatSelect={(id) => setActiveChatOrderId(id)}
              />
            </div>
          </div>
        )
      })()}

      {/* Modal Carte de Suivi */}
      {trackingOrder && (
        <div
          className={isMapFullScreen ? '' : 'modal-overlay'}
          onClick={() => { setTrackingOrder(null); setIsMapFullScreen(false) }}
          style={isMapFullScreen ? {
            position: 'fixed', inset: 0, zIndex: 300,
            background: 'rgba(0,0,0,0.85)', display: 'flex',
            alignItems: 'center', justifyContent: 'center'
          } : undefined}
        >
          <div
            className={isMapFullScreen ? '' : 'modal'}
            onClick={(e) => e.stopPropagation()}
            style={isMapFullScreen ? {
              position: 'fixed', inset: 0, background: 'var(--color-surface)',
              display: 'flex', flexDirection: 'column', padding: '20px', transition: 'all 0.3s'
            } : {
              maxWidth: '640px', padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: isMapFullScreen ? '0 0 16px' : '20px 20px 16px', flexShrink: 0, borderBottom: '1px solid var(--color-border)' }}>
              <h3 style={{ margin: 0, fontWeight: '800', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text)' }}>
                📍 Suivi #{trackingOrder.id.slice(-6).toUpperCase()}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => setIsMapFullScreen(v => !v)}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  title={isMapFullScreen ? 'Réduire la carte' : 'Agrandir la carte'}
                >
                  {isMapFullScreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  {isMapFullScreen ? 'Réduire' : 'Plein écran'}
                </button>
                <button
                  onClick={() => { setTrackingOrder(null); setIsMapFullScreen(false) }}
                  style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--color-text-dim)', lineHeight: 1 }}
                >
                  &times;
                </button>
              </div>
            </div>
            <div style={{ flex: 1, minHeight: isMapFullScreen ? 0 : '350px' }}>
              <DeliveryMap
                destLat={trackingOrder.delivery?.destLat}
                destLng={trackingOrder.delivery?.destLng}
                delivererLat={trackingOrder.delivery?.delivererLat}
                delivererLng={trackingOrder.delivery?.delivererLng}
                estimatedTime={trackingOrder.delivery?.estimatedTime}
                height={isMapFullScreen ? '100%' : '350px'}
              />
            </div>
            <div style={{ padding: '14px 20px', fontSize: '13px', color: 'var(--color-text)', flexShrink: 0, borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div>📍 <span style={{ fontWeight: '600' }}>{trackingOrder.delivery?.deliveryAddress}</span></div>
              {trackingOrder.delivery?.deliverer && (
                <div style={{ color: '#15803d', fontWeight: '500' }}>
                  🚴 Livreur : {trackingOrder.delivery.deliverer.name}{trackingOrder.delivery.deliverer.phone ? ` (${trackingOrder.delivery.deliverer.phone})` : ''}
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

      {/* Modal Signaler un problème */}
      {reportingOrder && (
        <div className="modal-overlay" onClick={() => setReportingOrder(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b' }}>
                <AlertTriangle size={18} /> Signaler un problème
              </h3>
              <button onClick={() => setReportingOrder(null)} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--color-text-dim)', lineHeight: 1 }}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Nature du problème</label>
                <select className="form-input form-select" value={reportType} onChange={e => setReportType(e.target.value)}>
                  <option value="MISSING_ITEM">Plat manquant / incorrect</option>
                  <option value="LATE_DELIVERY">Retard important de livraison</option>
                  <option value="POOR_QUALITY">Problème de qualité</option>
                  <option value="OTHER">Autre problème</option>
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Détails / Commentaire</label>
                <textarea
                  className="form-input"
                  rows={4}
                  placeholder="Décrivez précisément le souci pour que le support puisse intervenir..."
                  value={reportComment}
                  onChange={e => setReportComment(e.target.value)}
                  required
                  style={{ resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setReportingOrder(null)} disabled={isSendingReport}>Annuler</button>
              <button
                onClick={handleSendReport as any}
                className="btn btn-primary"
                style={{ flex: 2, background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none' }}
                disabled={isSendingReport}
              >
                {isSendingReport ? <span className="btn-spinner" /> : 'Envoyer le signalement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Animation pulse de timeline et slide up */}
      <style>{`
        @keyframes pulseGlow {
          0% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.4); }
          70% { box-shadow: 0 0 0 8px rgba(249, 115, 22, 0); }
          100% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0); }
        }
        .timeline-step.current .timeline-dot {
          animation: pulseGlow 1.5s infinite;
          background: var(--color-primary);
          border-color: var(--color-primary);
        }
        .animate-slide-up {
          animation: modalSlideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        @keyframes modalSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

export default OrdersPage
