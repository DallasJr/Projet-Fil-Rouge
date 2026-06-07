import { useState, useEffect } from 'react'
import type { ReactElement } from 'react'
import { Truck, MapPin, CheckCircle, XCircle, Package, Clock, AlertCircle, RefreshCw, MessageSquare } from 'lucide-react'
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

const DeliveriesPage = () => {
  const { isAdmin } = useAuth()
  const { socket } = useSocket()
  const [available, setAvailable] = useState<Delivery[]>([])
  const [myOrders, setMyOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionId, setActionId] = useState<string | null>(null)
  const [tab, setTab] = useState<'available' | 'mine'>('available')
  const [activeChatOrderId, setActiveChatOrderId] = useState<string | null>(null)
  
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
      setAvailable(avail)
      // Filtrer les commandes avec livraison assignée à ce livreur
      setMyOrders(orders.filter((o) => o.delivery))
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

  return (
    <div className="deliveries-page">
      <div className="page-header">
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

      {error && <div className="alert alert-error"><AlertCircle size={16} /><span>{error}</span></div>}

      {/* Onglets */}
      <div className="tabs">
        <button id="tab-available" className={`tab-btn ${tab === 'available' ? 'active' : ''}`} onClick={() => setTab('available')}>
          <Truck size={15} /> Disponibles ({available.length})
        </button>
        <button id="tab-mine" className={`tab-btn ${tab === 'mine' ? 'active' : ''}`} onClick={() => setTab('mine')}>
          <Package size={15} /> Mes livraisons ({myOrders.filter(o => o.delivery).length})
        </button>
      </div>

      {isLoading ? (
        <div className="loading-screen"><div className="loading-spinner"></div></div>
      ) : tab === 'available' ? (
        /* Livraisons disponibles */
        available.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🚚</div>
            <h2>Aucune livraison disponible</h2>
            <p>Revenez plus tard pour de nouvelles livraisons.</p>
          </div>
        ) : (
          <div className="deliveries-grid">
            {available.map((delivery) => (
              <div key={delivery.id} id={`delivery-${delivery.id}`} className="delivery-card">
                <div className="delivery-card-header">
                  <div className="order-id">Livraison <span>#{delivery.id.slice(-6).toUpperCase()}</span></div>
                  <span className={`status-badge ${deliveryStatusConfig[delivery.status].className}`}>
                    {deliveryStatusConfig[delivery.status].icon} {deliveryStatusConfig[delivery.status].label}
                  </span>
                </div>
                <div className="delivery-address">
                  <MapPin size={15} />
                  <span>{delivery.deliveryAddress}</span>
                </div>
                <div className="delivery-meta">
                  <span>Frais : <strong>{delivery.deliveryFee.toFixed(2)} €</strong></span>
                  <span>Paiement : <strong>{delivery.isPaid ? '✅ Payé' : '⏳ À percevoir'}</strong></span>
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
            ))}
          </div>
        )
      ) : (
        /* Mes livraisons en cours */
        myOrders.filter(o => o.delivery).length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            <h2>Aucune livraison en cours</h2>
            <p>Acceptez une livraison dans l'onglet "Disponibles".</p>
          </div>
        ) : (
          <div className="deliveries-grid">
            {myOrders.filter(o => o.delivery).map((order) => {
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

              return (
                <div key={delivery.id} id={`my-delivery-${delivery.id}`} className="delivery-card">
                  <div className="delivery-card-header">
                    <div className="order-id">Commande <span>#{order.id.slice(-6).toUpperCase()}</span></div>
                    <span className={`status-badge ${className}`}>{dStatus.icon} {label}</span>
                  </div>
                  <div className="delivery-address"><MapPin size={15} /><span>{delivery.deliveryAddress}</span></div>
                  <div className="order-items-list">
                    {order.items.map(item => (
                      <div key={item.id} className="order-item-row">
                        <span className="order-item-qty">×{item.quantity}</span>
                        <span className="order-item-name">{item.item.name}</span>
                      </div>
                    ))}
                  </div>
                  <div className="delivery-meta" style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                    <span>Total commande : <strong>{order.totalAmount.toFixed(2)} €</strong></span>
                    {delivery.confirmedByCustomer && !delivery.confirmedByDeliverer && (
                      <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: '500' }}>
                        ✓ Le client a déjà confirmé la réception
                      </span>
                    )}
                    {delivery.confirmedByDeliverer && !delivery.confirmedByCustomer && (
                      <span style={{ fontSize: '11px', color: '#b45309', fontWeight: '500' }}>
                        ⏳ En attente de confirmation du client
                      </span>
                    )}
                  </div>
                  <div className="action-buttons" style={{ marginTop: '0.75rem', gap: '8px', flexWrap: 'wrap' }}>
                    {delivery.status === 'ASSIGNED' && (
                      <button id={`pickup-${delivery.id}`} className="btn btn-primary btn-sm" onClick={() => handleStatusUpdate(delivery.id, 'PICKED_UP')} disabled={actionId === delivery.id}>
                        {actionId === delivery.id ? <span className="btn-spinner"></span> : '📦 Commande récupérée'}
                      </button>
                    )}
                    {delivery.status === 'PICKED_UP' && !delivery.confirmedByDeliverer && (
                      <button id={`delivered-${delivery.id}`} className="btn btn-primary btn-sm" onClick={() => handleStatusUpdate(delivery.id, 'DELIVERED')} disabled={actionId === delivery.id}>
                        {actionId === delivery.id ? <span className="btn-spinner"></span> : '✅ Livraison effectuée'}
                      </button>
                    )}
                    {delivery.status === 'PICKED_UP' && delivery.confirmedByDeliverer && (
                      <span style={{ fontSize: '13px', color: '#16a34a', fontWeight: '500', padding: '4px 8px' }}>
                        ⏳ En attente de validation client...
                      </span>
                    )}
                    {delivery.status !== 'DELIVERED' && delivery.status !== 'CANCELLED' && (
                      <button className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={() => setActiveChatOrderId(order.id)}>
                        <MessageSquare size={13} /> Chat Client
                      </button>
                    )}
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
      {activeChatOrderId && (
        <div className="modal-backdrop" onClick={() => setActiveChatOrderId(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: 0, maxWidth: '400px', width: '90%' }}>
            <ChatWindow orderId={activeChatOrderId} onClose={() => setActiveChatOrderId(null)} />
          </div>
        </div>
      )}

      {/* Modal Carte & Contrôles GPS pour le Livreur */}
      {trackingOrder && (
        <div className="modal-backdrop" onClick={() => setTrackingOrder(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', width: '95%', padding: '20px', borderRadius: '16px' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 className="modal-title" style={{ margin: 0, fontWeight: 'bold' }}>Livraison #{trackingOrder.id.slice(-6).toUpperCase()}</h3>
              <button 
                onClick={() => setTrackingOrder(null)} 
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#666' }}
              >
                &times;
              </button>
            </div>
            
            <div style={{ marginBottom: '15px' }}>
              <DeliveryMap
                destLat={trackingOrder.delivery?.destLat}
                destLng={trackingOrder.delivery?.destLng}
                delivererLat={trackingOrder.delivery?.delivererLat}
                delivererLng={trackingOrder.delivery?.delivererLng}
                estimatedTime={trackingOrder.delivery?.estimatedTime}
                height="320px"
              />
            </div>
            
            {/* Contrôles de simulation */}
            <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '15px' }}>
              <div style={{ fontWeight: '600', fontSize: '14px', color: '#334155', marginBottom: '8px' }}>
                🎛️ Contrôles de géolocalisation :
              </div>
              
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {simulatingDeliveryId === trackingOrder.delivery?.id ? (
                  <button 
                    className="btn btn-danger btn-sm"
                    onClick={stopTracking}
                  >
                    ⏹️ Arrêter le partage GPS
                  </button>
                ) : (
                  <>
                    <button 
                      className="btn btn-primary btn-sm"
                      style={{ backgroundColor: '#3b82f6', border: 'none' }}
                      onClick={() => startSimulation(trackingOrder)}
                    >
                      🚗 Simuler trajet
                    </button>
                    <button 
                      className="btn btn-primary btn-sm"
                      style={{ backgroundColor: '#10b981', border: 'none' }}
                      onClick={() => startRealGPS(trackingOrder)}
                    >
                      📡 Activer GPS Réel
                    </button>
                  </>
                )}
              </div>
              
              {simulatingDeliveryId === trackingOrder.delivery?.id && (
                <div style={{ fontSize: '12px', color: '#3b82f6', fontWeight: '500', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span className="spin" style={{ display: 'inline-block' }}>🔄</span> Partage de position actif...
                </div>
              )}
            </div>

            <div style={{ fontSize: '14px', color: '#444' }}>
              <div style={{ marginBottom: '5px' }}>
                📍 Adresse client : <span style={{ fontWeight: '600' }}>{trackingOrder.delivery?.deliveryAddress}</span>
              </div>
              {trackingOrder.delivery?.delivererLat && (
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Position livreur : {trackingOrder.delivery.delivererLat.toFixed(5)}, {trackingOrder.delivery.delivererLng?.toFixed(5)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DeliveriesPage
