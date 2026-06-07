import { useState, useEffect } from 'react'
import type { ReactElement } from 'react'
import { Clock, CheckCircle, XCircle, ChefHat, Package, Truck, AlertCircle, MapPin, MessageSquare } from 'lucide-react'
import { getMyOrders, confirmDelivery } from '../api/orders.api'
import type { Order, OrderStatus } from '../api/orders.api'
import { ChatWindow } from '../components/ChatWindow'
import { useSocket } from '../contexts/SocketContext'

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

const OrdersPage = () => {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeChatOrderId, setActiveChatOrderId] = useState<string | null>(null)
  const { socket } = useSocket()

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

    socket.on('order_status_updated', onStatusUpdate)
    socket.on('delivery_assigned', onDeliveryAssigned)

    return () => {
      socket.off('order_status_updated', onStatusUpdate)
      socket.off('delivery_assigned', onDeliveryAssigned)
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

  return (
    <div className="orders-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Mes Commandes</h1>
          <p className="page-subtitle">Suivez l'état de vos commandes en temps réel</p>
        </div>
      </div>

      {error && <div className="alert alert-error"><AlertCircle size={16} /><span>{error}</span></div>}

      {orders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🛍️</div>
          <h2>Aucune commande pour l'instant</h2>
          <p>Rendez-vous sur le menu pour passer votre première commande !</p>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map((order) => {
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

                {/* Articles */}
                <div className="order-items-list">
                  {order.items.map((item) => (
                    <div key={item.id} className="order-item-row">
                      <span className="order-item-qty">×{item.quantity}</span>
                      <span className="order-item-name">{item.item.name}</span>
                      <span className="order-item-price">{(item.unitPrice * item.quantity).toFixed(2)} €</span>
                    </div>
                  ))}
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
                  
                  {order.delivery && order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
                    <button 
                      className="btn btn-secondary btn-sm" 
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      onClick={() => setActiveChatOrderId(order.id)}
                    >
                      <MessageSquare size={13} /> Chat Live
                    </button>
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
                  
                  <span className="order-total">{order.totalAmount.toFixed(2)} €</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Chat Live */}
      {activeChatOrderId && (
        <div className="modal-backdrop" onClick={() => setActiveChatOrderId(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: 0, maxWidth: '400px', width: '90%' }}>
            <ChatWindow orderId={activeChatOrderId} onClose={() => setActiveChatOrderId(null)} />
          </div>
        </div>
      )}
    </div>
  )
}

export default OrdersPage
