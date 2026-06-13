import { useState, useEffect } from 'react'
import type { ReactElement } from 'react'
import { Truck, MapPin, CheckCircle, XCircle, Package, Clock, AlertCircle, RefreshCw, MessageSquare, Filter, Search, ChevronDown, Heart } from 'lucide-react'
import { getAvailableDeliveries, acceptDelivery, updateDeliveryStatus, getMyOrders, updateDelivererLocation } from '../api/orders.api'
import type { Delivery, DeliveryStatus, Order } from '../api/orders.api'
import { cancelDelivery } from '../api/admin.api'
import { useAuth } from '../contexts/AuthContext'
import { ChatWindow } from '../components/ChatWindow'
import { useSocket } from '../contexts/SocketContext'
import { DeliveryMap } from '../components/DeliveryMap'

const deliveryStatusConfig: Record<DeliveryStatus, { label: string; icon: ReactElement; className: string }> = {
  ASSIGNED:   { label: 'Assignée',         icon: <Clock size={13} />,       className: 'status-pending' },
  PICKED_UP:  { label: 'Récupérée',        icon: <Package size={13} />,     className: 'status-preparing' },
  DELIVERED:  { label: 'Livrée',           icon: <CheckCircle size={13} />, className: 'status-delivered' },
  CANCELLED:  { label: 'Annulée',          icon: <XCircle size={13} />,     className: 'status-cancelled' },
}

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

const DeliveriesPage = () => {
  const { isAdmin, user } = useAuth()
  const { socket } = useSocket()
  const [available, setAvailable] = useState<Delivery[]>([])
  const [myOrders, setMyOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionId, setActionId] = useState<string | null>(null)
  const [tab, setTab] = useState<'available' | 'mine'>('available')
  const [activeChatOrderId, setActiveChatOrderId] = useState<string | null>(null)
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

  // Filtres et recherche
  const [searchTerm, setSearchTerm] = useState('')
  const [filterPayment, setFilterPayment] = useState<'ALL' | 'CREDIT_CARD' | 'PAYPAL' | 'CASH'>('ALL')
  const [showFilters, setShowFilters] = useState(false)
  
  // GPS & Simulation States
  const [simulatingDeliveryId, setSimulatingDeliveryId] = useState<string | null>(null)
  const [simulationIntervalId, setSimulationIntervalId] = useState<any | null>(null)
  const [watchPositionId, setWatchPositionId] = useState<number | null>(null)
  const [trackingOrder, setTrackingOrder] = useState<Order | null>(null)

  const fetchAll = async () => {
    setIsLoading(true)
    setError('')
    try {
      const [avail, orders] = await Promise.all([
        getAvailableDeliveries(),
        getMyOrders(),
      ])
      // Tri chronologique : plus anciennes d'abord (da - db)
      const sortByDate = <T extends { id: string }>(arr: T[], getDate: (item: T) => string | undefined) =>
        [...arr].sort((a, b) => {
          const da = new Date(getDate(a) ?? 0).getTime()
          const db = new Date(getDate(b) ?? 0).getTime()
          return da - db
        })
      setAvailable(sortByDate(avail, (d) => d.createdAt))
      // Filtrer les commandes avec livraison assignée à ce livreur + tri par date
      const mine = orders.filter((o) => o.delivery && o.delivery.delivererId === user?.id)
      setMyOrders(sortByDate(mine, (o) => o.createdAt))
    } catch {
      setError('Impossible de charger les livraisons.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  useEffect(() => {
    if (!socket) return

    const onOrderCreated = () => fetchAll()
    const onStatusUpdate = () => fetchAll()
    const onDeliveryAssigned = () => fetchAll()

    socket.on('order_created', onOrderCreated)
    socket.on('order_status_updated', onStatusUpdate)
    socket.on('delivery_assigned', onDeliveryAssigned)

    return () => {
      socket.off('order_created', onOrderCreated)
      socket.off('order_status_updated', onStatusUpdate)
      socket.off('delivery_assigned', onDeliveryAssigned)
    }
  }, [socket])

  const handleAccept = async (deliveryId: string) => {
    setActionId(deliveryId)
    try {
      await acceptDelivery(deliveryId)
      await fetchAll()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de l\'acceptation.')
    } finally {
      setActionId(null)
    }
  }

  const handleStatusUpdate = async (deliveryId: string, status: DeliveryStatus) => {
    setActionId(deliveryId)
    try {
      await updateDeliveryStatus(deliveryId, status)
      await fetchAll()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de la mise à jour.')
    } finally {
      setActionId(null)
    }
  }

  const handleRollbackStatus = async (deliveryId: string, status: DeliveryStatus) => {
    if (!window.confirm(`Voulez-vous retourner à l'état précédent (${status === 'ASSIGNED' ? 'Assignée' : 'Récupérée'}) ?`)) {
      return
    }
    setActionId(deliveryId)
    try {
      await updateDeliveryStatus(deliveryId, status)
      await fetchAll()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de la modification.')
    } finally {
      setActionId(null)
    }
  }

  const handleConfirmCashPayment = async (deliveryId: string, currentStatus: DeliveryStatus) => {
    if (!window.confirm("Confirmez-vous avoir reçu le paiement en espèces pour cette livraison ?")) {
      return
    }
    setActionId(deliveryId)
    try {
      await updateDeliveryStatus(deliveryId, currentStatus, true)
      await fetchAll()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de la validation du paiement.')
    } finally {
      setActionId(null)
    }
  }

  const handleCancelDelivery = async (deliveryId: string) => {
    if (!window.confirm('Êtes-vous sûr de vouloir annuler la livraison de cette commande ? Elle redeviendra disponible pour les autres livreurs.')) {
      return
    }
    setActionId(deliveryId)
    try {
      await cancelDelivery(deliveryId)
      await fetchAll()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de l\'annulation de la livraison.')
    } finally {
      setActionId(null)
    }
  }

  // GPS Tracking Controls
  const startSimulation = async (order: Order) => {
    if (!order.delivery) return
    const deliveryId = order.delivery.id
    
    const startLat = 48.8566
    const startLng = 2.3522
    const endLat = order.delivery.destLat || 48.8666
    const endLng = order.delivery.destLng || 2.3622
    
    stopTracking()
    setSimulatingDeliveryId(deliveryId)
    
    let step = 0
    const totalSteps = 10
    
    const interval = setInterval(async () => {
      step++
      if (step > totalSteps) {
        clearInterval(interval)
        setSimulationIntervalId(null)
        setSimulatingDeliveryId(null)
        alert("Simulation terminée !")
        return
      }
      
      const currentLat = startLat + (endLat - startLat) * (step / totalSteps)
      const currentLng = startLng + (endLng - startLng) * (step / totalSteps)
      
      try {
        const updatedDelivery = await updateDelivererLocation(deliveryId, currentLat, currentLng)
        const updatedOrder: Order = {
          ...order,
          delivery: {
            ...order.delivery!,
            delivererLat: currentLat,
            delivererLng: currentLng,
            estimatedTime: updatedDelivery.estimatedTime
          }
        }
        
        // Update local states
        setMyOrders(prev => prev.map(o => o.delivery?.id === deliveryId ? updatedOrder : o))
        setTrackingOrder(current => current?.delivery?.id === deliveryId ? updatedOrder : current)
      } catch (err) {
        console.error("Erreur simulation GPS", err)
      }
    }, 3000)
    
    setSimulationIntervalId(interval)
  }

  const startRealGPS = (order: Order) => {
    if (!order.delivery) return
    const deliveryId = order.delivery.id
    
    stopTracking()
    
    if (!navigator.geolocation) {
      alert("La géolocalisation n'est pas supportée par votre navigateur.")
      return
    }
    
    setSimulatingDeliveryId(deliveryId)
    
    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude } = position.coords
        try {
          const updatedDelivery = await updateDelivererLocation(deliveryId, latitude, longitude)
          const updatedOrder: Order = {
            ...order,
            delivery: {
              ...order.delivery!,
              delivererLat: latitude,
              delivererLng: longitude,
              estimatedTime: updatedDelivery.estimatedTime
            }
          }
          
          setMyOrders(prev => prev.map(o => o.delivery?.id === deliveryId ? updatedOrder : o))
          setTrackingOrder(current => current?.delivery?.id === deliveryId ? updatedOrder : current)
        } catch (err) {
          console.error("Erreur GPS réel", err)
        }
      },
      (error) => {
        console.error("Erreur de géolocalisation", error)
        alert(`Erreur de géolocalisation: ${error.message}`)
        stopTracking()
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
    
    setWatchPositionId(watchId)
  }

  const stopTracking = () => {
    if (simulationIntervalId) {
      clearInterval(simulationIntervalId)
      setSimulationIntervalId(null)
    }
    if (watchPositionId !== null) {
      navigator.geolocation.clearWatch(watchPositionId)
      setWatchPositionId(null)
    }
    setSimulatingDeliveryId(null)
  }

  useEffect(() => {
    return () => {
      if (simulationIntervalId) clearInterval(simulationIntervalId)
      if (watchPositionId !== null) navigator.geolocation.clearWatch(watchPositionId)
    }
  }, [simulationIntervalId, watchPositionId])

  const filteredAvailable = available.filter(d => {
    const orderId = d.orderId.toLowerCase()
    const address = d.deliveryAddress.toLowerCase()
    const customerName = (d.order?.customer?.name || '').toLowerCase()
    const term = searchTerm.toLowerCase()
    const matchesSearch = orderId.includes(term) || address.includes(term) || customerName.includes(term)
    const matchesPayment = filterPayment === 'ALL' || d.paymentMethod === filterPayment
    return matchesSearch && matchesPayment
  })

  const filteredMyOrders = myOrders.filter(o => {
    const orderId = o.id.toLowerCase()
    const address = (o.delivery?.deliveryAddress || '').toLowerCase()
    const customerName = (o.customer?.name || '').toLowerCase()
    const term = searchTerm.toLowerCase()
    const matchesSearch = orderId.includes(term) || address.includes(term) || customerName.includes(term)
    const matchesPayment = filterPayment === 'ALL' || o.delivery?.paymentMethod === filterPayment
    return matchesSearch && matchesPayment
  })

  return (
    <div className="deliveries-page">
      <div className="page-header" style={{ flexDirection: 'column', alignItems: 'stretch', display: 'flex' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h1 className="page-title">Livraisons</h1>
            <p className="page-subtitle">
              {isAdmin ? 'Vue admin — toutes les livraisons disponibles' : 'Gérez vos livraisons en cours'}
            </p>
          </div>
          <button id="btn-refresh-deliveries" className="btn btn-secondary" onClick={fetchAll} disabled={isLoading}>
            <RefreshCw size={15} className={isLoading ? 'spin' : ''} /> Actualiser
          </button>
        </div>

        {/* ── Filtre collapsible (pattern uniforme) ── */}
        <div className="filter-panel" style={{ width: '100%', marginTop: '16px' }}>
          <div className="filter-panel-header" onClick={() => setShowFilters(v => !v)}>
            <span className="filter-panel-title">
              <Filter size={13} style={{ color: 'var(--color-primary)' }} /> Filtres &amp; Recherche
              {(searchTerm || filterPayment !== 'ALL') && (
                <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '10px', background: 'var(--color-primary)', color: '#fff', fontWeight: '700', marginLeft: '6px' }}>
                  {[searchTerm && '1', filterPayment !== 'ALL' && '1'].filter(Boolean).length}
                </span>
              )}
            </span>
            <span className={`filter-panel-toggle ${showFilters ? 'open' : ''}`}>
              {showFilters ? 'Masquer' : 'Afficher'} <ChevronDown size={13} style={{ marginLeft: '4px' }} />
            </span>
          </div>
          {showFilters && (
            <div className="filter-panel-body">
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '10px' }}>Recherche</label>
                <div style={{ position: 'relative' }}>
                  <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-dim)', pointerEvents: 'none' }} />
                  <input
                    id="delivery-search"
                    type="text"
                    className="form-input"
                    placeholder="Adresse, commande, client..."
                    style={{ paddingLeft: '30px', fontSize: '13px' }}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '10px' }}>Mode de paiement</label>
                <select
                  id="filter-payment"
                  className="form-input form-select"
                  style={{ fontSize: '13px', minWidth: '140px' }}
                  value={filterPayment}
                  onChange={(e) => setFilterPayment(e.target.value as any)}
                >
                  <option value="ALL">Tous</option>
                  <option value="CREDIT_CARD">💳 Carte</option>
                  <option value="PAYPAL">🅿️ PayPal</option>
                  <option value="CASH">💵 Espèces</option>
                </select>
              </div>
              <button className="btn btn-secondary" style={{ fontSize: '12px', padding: '8px 14px', alignSelf: 'flex-end', height: '38px' }}
                onClick={() => { setSearchTerm(''); setFilterPayment('ALL') }}>
                Réinitialiser
              </button>
            </div>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error"><AlertCircle size={16} /><span>{error}</span></div>}

      {/* Onglets */}
      <div className="tabs">
        <button id="tab-available" className={`tab-btn ${tab === 'available' ? 'active' : ''}`} onClick={() => setTab('available')}>
          <Truck size={15} /> Disponibles ({filteredAvailable.length})
        </button>
        <button id="tab-mine" className={`tab-btn ${tab === 'mine' ? 'active' : ''}`} onClick={() => setTab('mine')}>
          <Package size={15} /> Mes livraisons ({filteredMyOrders.filter(o => o.delivery).length})
        </button>
      </div>

      {/* Filter panel removed since it is now inside the page-header */}

      {isLoading ? (
        <div className="loading-screen"><div className="loading-spinner"></div></div>
      ) : tab === 'available' ? (
        /* Livraisons disponibles */
        filteredAvailable.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🚚</div>
            <h2>Aucune livraison disponible</h2>
            <p>Revenez plus tard ou ajustez vos filtres de recherche.</p>
          </div>
        ) : (
          <div className="deliveries-grid">
            {filteredAvailable.map((delivery) => {
              const order = delivery.order!
              const totalItems = order.items?.reduce((s, i) => s + i.quantity, 0) || 0
              const orderDate = new Date(order.createdAt)
              const pmLabel = delivery.paymentMethod === 'CREDIT_CARD' ? '💳 Carte' : delivery.paymentMethod === 'PAYPAL' ? '🅿️ PayPal' : '💵 Espèces'
              return (
              <div key={delivery.id} id={`delivery-${delivery.id}`} className="delivery-card">
                <div className="delivery-card-header">
                  <div className="order-id">Commande <span>#{order.id.slice(-6).toUpperCase()}</span></div>
                  <span className={`status-badge ${deliveryStatusConfig[delivery.status].className}`}>
                    {deliveryStatusConfig[delivery.status].icon} {deliveryStatusConfig[delivery.status].label}
                  </span>
                </div>
                {/* Date & Client */}
                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <Clock size={11} />
                  {orderDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })} à {orderDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  <span style={{ marginLeft: '4px', backgroundColor: '#f1f5f9', padding: '1px 6px', borderRadius: '8px', color: '#475569', fontWeight: '600' }}>
                    {totalItems} article{totalItems > 1 ? 's' : ''}
                  </span>
                </div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '8px' }}>
                  Client : {order.customer?.name} ({order.customer?.phone || 'Pas de téléphone'})
                </div>
                <div className="delivery-address">
                  <MapPin size={15} />
                  <span>{delivery.deliveryAddress}</span>
                </div>

                {/* Articles styled as cart-items */}
                {order.items && order.items.length > 0 && (
                  <div className="order-items-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px', marginBottom: '12px' }}>
                    {order.items.map((item) => {
                      const itemRich = parseDescription(item.item.description)
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
                )}

                <div className="delivery-meta" style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'flex-start', padding: '10px', backgroundColor: '#f8fafc', borderRadius: '8px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <span style={{ fontSize: '13px', color: '#475569' }}>Montant articles</span>
                    <strong style={{ fontSize: '13px' }}>{order.totalAmount.toFixed(2)} €</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <span style={{ fontSize: '13px', color: '#475569' }}>Frais de livraison</span>
                    <strong style={{ fontSize: '13px' }}>{delivery.deliveryFee.toFixed(2)} €</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', borderTop: '1px solid #e2e8f0', paddingTop: '5px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>Total à encaisser</span>
                    <strong style={{ fontSize: '14px', color: '#0f172a' }}>{(order.totalAmount + delivery.deliveryFee).toFixed(2)} €</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px',
                      backgroundColor: delivery.paymentMethod === 'CASH' ? '#fef9c3' : '#e0f2fe',
                      color: delivery.paymentMethod === 'CASH' ? '#92400e' : '#075985'
                    }}>{pmLabel}</span>
                    <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px',
                      backgroundColor: delivery.isPaid ? '#dcfce7' : '#fef3c7',
                      color: delivery.isPaid ? '#15803d' : '#92400e'
                    }}>{delivery.isPaid ? '✅ Payé' : '⏳ À encaisser'}</span>
                  </div>
                </div>

                <button
                  id={`accept-${delivery.id}`}
                  className="btn btn-primary btn-full"
                  onClick={() => handleAccept(delivery.id)}
                  disabled={actionId === delivery.id}
                >
                  {actionId === delivery.id ? <span className="btn-spinner"></span> : (<><Truck size={15} /> Accepter cette livraison</>)}
                </button>
              </div>
            )})}
          </div>
        )
      ) : (
        /* Mes livraisons en cours */
        filteredMyOrders.filter(o => o.delivery).length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            <h2>Aucune livraison en cours</h2>
            <p>Acceptez une livraison dans l'onglet "Disponibles" ou modifiez vos filtres.</p>
          </div>
        ) : (
          <div className="deliveries-grid">
            {filteredMyOrders.filter(o => o.delivery).map((order) => {
              const delivery = order.delivery!
              const dStatus = deliveryStatusConfig[delivery.status]
              
              // Custom text status for deliverer
              let label = dStatus.label
              let className = dStatus.className
              if (delivery.status === 'PICKED_UP') {
                if (delivery.confirmedByDeliverer) {
                  label = 'Livrée (attente client)'
                  className = 'status-ready'
                } else {
                  label = 'Récupérée'
                }
              }

              const totalItems = order.items.reduce((s, i) => s + i.quantity, 0)
              const orderDate = new Date(order.createdAt)
              const pmLabel = delivery.paymentMethod === 'CREDIT_CARD' ? '💳 Carte Bancaire' : delivery.paymentMethod === 'PAYPAL' ? '🅿️ PayPal' : '💵 Espèces'

              return (
                <div key={delivery.id} id={`my-delivery-${delivery.id}`} className="delivery-card">
                  {/* En-tête */}
                  <div className="delivery-card-header">
                    <div className="order-id">Commande <span>#{order.id.slice(-6).toUpperCase()}</span></div>
                    <span className={`status-badge ${className}`}>{dStatus.icon} {label}</span>
                  </div>

                  {/* Date de commande */}
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <Clock size={11} />
                    {orderDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })} à {orderDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    <span style={{ marginLeft: '4px', backgroundColor: '#f1f5f9', padding: '1px 6px', borderRadius: '8px', color: '#475569', fontWeight: '600' }}>
                      {totalItems} article{totalItems > 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Adresse */}
                  <div className="delivery-address"><MapPin size={15} /><span>{delivery.deliveryAddress}</span></div>

                  {/* Articles styled as cart-items */}
                  {order.items && order.items.length > 0 && (
                    <div className="order-items-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px', marginBottom: '12px' }}>
                      {order.items.map((item) => {
                        const itemRich = parseDescription(item.item.description)
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
                  )}

                  {/* Méta : total, paiement */}
                  <div className="delivery-meta" style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'flex-start', padding: '10px', backgroundColor: '#f8fafc', borderRadius: '8px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                      <span style={{ fontSize: '13px', color: '#475569' }}>Sous-total articles</span>
                      <strong style={{ fontSize: '13px' }}>{order.totalAmount.toFixed(2)} €</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                      <span style={{ fontSize: '13px', color: '#475569' }}>Frais de livraison</span>
                      <strong style={{ fontSize: '13px' }}>{delivery.deliveryFee.toFixed(2)} €</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', borderTop: '1px solid #e2e8f0', paddingTop: '5px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>Total à encaisser</span>
                      <strong style={{ fontSize: '14px', color: '#0f172a' }}>{(order.totalAmount + delivery.deliveryFee).toFixed(2)} €</strong>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px',
                        backgroundColor: delivery.paymentMethod === 'CASH' ? '#fef9c3' : '#e0f2fe',
                        color: delivery.paymentMethod === 'CASH' ? '#92400e' : '#075985'
                      }}>{pmLabel}</span>
                      <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px',
                        backgroundColor: delivery.isPaid ? '#dcfce7' : '#fef3c7',
                        color: delivery.isPaid ? '#15803d' : '#92400e'
                      }}>{delivery.isPaid ? '✅ Payé' : '⏳ À encaisser'}</span>
                    </div>
                    {delivery.confirmedByCustomer && !delivery.confirmedByDeliverer && (
                      <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: '500', marginTop: '2px' }}>
                        ✓ Le client a déjà confirmé la réception
                      </span>
                    )}
                    {delivery.confirmedByDeliverer && !delivery.confirmedByCustomer && (
                      <span style={{ fontSize: '11px', color: '#b45309', fontWeight: '500', marginTop: '2px' }}>
                        ⏳ En attente de confirmation du client
                      </span>
                    )}
                  </div>
                  <div className="action-buttons" style={{ marginTop: '0.75rem', gap: '8px', flexWrap: 'wrap' }}>
                    {delivery.paymentMethod === 'CASH' && !delivery.isPaid && delivery.status === 'DELIVERED' && (
                      <button
                        id={`collect-cash-${delivery.id}`}
                        className="btn btn-success btn-sm"
                        style={{ backgroundColor: '#16a34a', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => handleConfirmCashPayment(delivery.id, delivery.status)}
                        disabled={actionId === delivery.id}
                      >
                        {actionId === delivery.id ? <span className="btn-spinner"></span> : `💵 Encaisser ${(order.totalAmount + delivery.deliveryFee).toFixed(2)} €`}
                      </button>
                    )}
                    {delivery.status === 'ASSIGNED' && (
                      <button id={`pickup-${delivery.id}`} className="btn btn-primary btn-sm" onClick={() => handleStatusUpdate(delivery.id, 'PICKED_UP')} disabled={actionId === delivery.id}>
                        {actionId === delivery.id ? <span className="btn-spinner"></span> : '📦 Commande récupérée'}
                      </button>
                    )}
                    {delivery.status === 'PICKED_UP' && !delivery.confirmedByDeliverer && (
                      <>
                        <button id={`delivered-${delivery.id}`} className="btn btn-primary btn-sm" onClick={() => handleStatusUpdate(delivery.id, 'DELIVERED')} disabled={actionId === delivery.id}>
                          {actionId === delivery.id ? <span className="btn-spinner"></span> : '✅ Livraison effectuée'}
                        </button>
                      </>
                    )}

                    <button className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={() => setActiveChatOrderId(order.id)}>
                      <MessageSquare size={13} /> {['DELIVERED', 'CANCELLED'].includes(delivery.status) ? 'Historique Chat' : 'Chat Client'}
                    </button>
                    {(delivery.status === 'ASSIGNED' || delivery.status === 'PICKED_UP') && (
                      <>
                        <button 
                          className="btn btn-secondary btn-sm" 
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }} 
                          onClick={() => setTrackingOrder(order)}
                        >
                          <MapPin size={13} /> Carte & GPS
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleCancelDelivery(delivery.id)}
                          disabled={actionId === delivery.id}
                        >
                          Annuler la livraison
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* Modal Chat Live */}
      {activeChatOrderId && (() => {
        const chatOrder = myOrders.find(o => o.id === activeChatOrderId)
        const interlocutor = chatOrder?.customer
        return (
          <div className="modal-overlay" onClick={() => setActiveChatOrderId(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ padding: 0, maxWidth: '440px', overflow: 'hidden' }}>
              <ChatWindow
                orderId={activeChatOrderId}
                onClose={() => setActiveChatOrderId(null)}
                isClosed={['DELIVERED', 'CANCELLED'].includes(chatOrder?.status || '')}
                interlocutorName={interlocutor?.name}
                interlocutorRole="CLIENT"
                chatList={myOrders.filter(o => o.delivery).map(o => ({ orderId: o.id, label: `#${o.id.slice(-6).toUpperCase()} — ${o.customer?.name || 'Client'}`, active: o.id === activeChatOrderId }))}
                onChatSelect={(id) => setActiveChatOrderId(id)}
              />
            </div>
          </div>
        )
      })()}

      {/* Modal Carte & Contrôles GPS pour le Livreur */}
      {trackingOrder && (
        <div className="modal-overlay" onClick={() => setTrackingOrder(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                📍 Livraison #{trackingOrder.id.slice(-6).toUpperCase()}
                {trackingOrder.customer && (
                  <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--color-text-muted)', background: 'var(--color-surface-2)', padding: '2px 8px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                    {trackingOrder.customer.name}
                  </span>
                )}
              </h3>
              <button onClick={() => setTrackingOrder(null)} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--color-text-dim)', lineHeight: 1 }}>&times;</button>
            </div>

            <div style={{ flex: 1, minHeight: '320px' }}>
              <DeliveryMap
                destLat={trackingOrder.delivery?.destLat}
                destLng={trackingOrder.delivery?.destLng}
                delivererLat={trackingOrder.delivery?.delivererLat}
                delivererLng={trackingOrder.delivery?.delivererLng}
                estimatedTime={trackingOrder.delivery?.estimatedTime}
                height="320px"
              />
            </div>

            {/* Contrôles GPS */}
            <div style={{ padding: '14px 20px', background: 'var(--color-surface-2)', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                🎛️ Géolocalisation
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {simulatingDeliveryId === trackingOrder.delivery?.id ? (
                  <button className="btn btn-danger btn-sm" onClick={stopTracking}>⏹️ Arrêter le GPS</button>
                ) : (
                  <>
                    <button className="btn btn-primary btn-sm" style={{ backgroundColor: '#3b82f6', border: 'none' }} onClick={() => startSimulation(trackingOrder)}>🚗 Simuler trajet</button>
                    <button className="btn btn-primary btn-sm" style={{ backgroundColor: '#10b981', border: 'none' }} onClick={() => startRealGPS(trackingOrder)}>📡 GPS Réel</button>
                  </>
                )}
              </div>
              {simulatingDeliveryId === trackingOrder.delivery?.id && (
                <div style={{ fontSize: '12px', color: '#3b82f6', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span className="spin" style={{ display: 'inline-block' }}>🔄</span> Partage de position actif...
                </div>
              )}
              <div style={{ fontSize: '13px', color: 'var(--color-text)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div>📍 <span style={{ fontWeight: '600' }}>{trackingOrder.delivery?.deliveryAddress}</span></div>
                {trackingOrder.delivery?.delivererLat && (
                  <div style={{ fontSize: '12px', color: 'var(--color-text-dim)' }}>
                    Position : {trackingOrder.delivery.delivererLat.toFixed(5)}, {trackingOrder.delivery.delivererLng?.toFixed(5)}
                  </div>
                )}
              </div>
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

export default DeliveriesPage
