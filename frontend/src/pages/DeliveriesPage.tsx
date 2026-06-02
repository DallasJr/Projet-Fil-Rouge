import { useState, useEffect } from 'react'
import type { ReactElement } from 'react'
import { Truck, MapPin, CheckCircle, XCircle, Package, Clock, AlertCircle, RefreshCw } from 'lucide-react'
import { getAvailableDeliveries, acceptDelivery, updateDeliveryStatus, getMyOrders } from '../api/orders.api'
import type { Delivery, DeliveryStatus, Order } from '../api/orders.api'
import { useAuth } from '../contexts/AuthContext'

const deliveryStatusConfig: Record<DeliveryStatus, { label: string; icon: ReactElement; className: string }> = {
  ASSIGNED:   { label: 'Assignée',         icon: <Clock size={13} />,       className: 'status-pending' },
  PICKED_UP:  { label: 'Récupérée',        icon: <Package size={13} />,     className: 'status-preparing' },
  DELIVERED:  { label: 'Livrée',           icon: <CheckCircle size={13} />, className: 'status-delivered' },
  CANCELLED:  { label: 'Annulée',          icon: <XCircle size={13} />,     className: 'status-cancelled' },
}

const DeliveriesPage = () => {
  const { isAdmin } = useAuth()
  const [available, setAvailable] = useState<Delivery[]>([])
  const [myOrders, setMyOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionId, setActionId] = useState<string | null>(null)
  const [tab, setTab] = useState<'available' | 'mine'>('available')

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
              return (
                <div key={delivery.id} id={`my-delivery-${delivery.id}`} className="delivery-card">
                  <div className="delivery-card-header">
                    <div className="order-id">Commande <span>#{order.id.slice(-6).toUpperCase()}</span></div>
                    <span className={`status-badge ${dStatus.className}`}>{dStatus.icon} {dStatus.label}</span>
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
                  <div className="delivery-meta">
                    <span>Total commande : <strong>{order.totalAmount.toFixed(2)} €</strong></span>
                  </div>
                  <div className="action-buttons" style={{ marginTop: '0.75rem' }}>
                    {delivery.status === 'ASSIGNED' && (
                      <button id={`pickup-${delivery.id}`} className="btn btn-primary btn-sm" onClick={() => handleStatusUpdate(delivery.id, 'PICKED_UP')} disabled={actionId === delivery.id}>
                        {actionId === delivery.id ? <span className="btn-spinner"></span> : '📦 Commande récupérée'}
                      </button>
                    )}
                    {delivery.status === 'PICKED_UP' && (
                      <button id={`delivered-${delivery.id}`} className="btn btn-primary btn-sm" onClick={() => handleStatusUpdate(delivery.id, 'DELIVERED')} disabled={actionId === delivery.id}>
                        {actionId === delivery.id ? <span className="btn-spinner"></span> : '✅ Livraison effectuée'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}

export default DeliveriesPage
