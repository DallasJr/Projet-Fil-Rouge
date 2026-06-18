import React, { useState, useEffect, useCallback } from 'react'
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
  TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import {
  getAvailableDeliveries,
  acceptDelivery,
  getMyOrders,
  acceptAssignment,
  rejectAssignment,
  updateDeliveryStatus,
  cancelDelivery,
  Delivery,
  Order,
  DeliveryStatus,
} from '../api/orders'

const parseDescription = (raw: string | null | undefined): { calories?: number; prepTime?: number } => {
  if (!raw) return {}
  if (raw.trim().startsWith('{')) {
    try { return JSON.parse(raw) } catch { /* */ }
  }
  return {}
}

export default function DelivererScreen() {
  const [activeTab, setActiveTab] = useState<'available' | 'mine'>('available')
  const [availableDeliveries, setAvailableDeliveries] = useState<Delivery[]>([])
  const [myDeliveries, setMyDeliveries] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  // Collapsible Filters & Search
  const [search, setSearch] = useState('')
  const [filterPayment, setFilterPayment] = useState<'ALL' | 'CREDIT_CARD' | 'PAYPAL' | 'CASH'>('ALL')
  const [showFilters, setShowFilters] = useState(false)

  const navigation = useNavigation<any>()

  const fetchData = useCallback(async (showIndicator = true) => {
    if (showIndicator) setLoading(true)
    try {
      if (activeTab === 'available') {
        const data = await getAvailableDeliveries()
        setAvailableDeliveries(data)
      } else {
        const data = await getMyOrders()
        setMyDeliveries(data)
      }
    } catch (err) {
      console.error('Error fetching deliveries:', err)
      Alert.alert('Erreur', 'Impossible de récupérer les livraisons.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [activeTab])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchData(false)
  }, [fetchData])

  const handleAcceptDelivery = async (deliveryId: string) => {
    try {
      await acceptDelivery(deliveryId)
      Alert.alert('Succès', 'Vous avez accepté la livraison.')
      fetchData()
    } catch (err) {
      console.error('Error accepting delivery:', err)
      Alert.alert('Erreur', "Impossible d'accepter cette livraison.")
    }
  }

  const handleAcceptAssignment = async (deliveryId: string) => {
    try {
      await acceptAssignment(deliveryId)
      Alert.alert('Succès', 'Attribution acceptée.')
      fetchData()
    } catch (err) {
      console.error('Error accepting assignment:', err)
      Alert.alert('Erreur', "Impossible d'accepter cette attribution.")
    }
  }

  const handleRejectAssignment = async (deliveryId: string) => {
    try {
      await rejectAssignment(deliveryId)
      Alert.alert('Info', 'Attribution rejetée.')
      fetchData()
    } catch (err) {
      console.error('Error rejecting assignment:', err)
      Alert.alert('Erreur', "Impossible de rejeter cette attribution.")
    }
  }

  const handleUpdateStatus = async (deliveryId: string, status: DeliveryStatus) => {
    try {
      await updateDeliveryStatus(deliveryId, status)
      Alert.alert('Succès', `Statut mis à jour.`)
      fetchData()
    } catch (err) {
      console.error('Error updating status:', err)
      Alert.alert('Erreur', 'Impossible de mettre à jour le statut.')
    }
  }

  const handleConfirmCashPayment = async (deliveryId: string, currentStatus: DeliveryStatus, amount: number) => {
    Alert.alert(
      "Confirmer le paiement",
      `Confirmez-vous avoir reçu le paiement de ${amount.toFixed(2)} € en espèces pour cette livraison ?`,
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, encaissé',
          onPress: async () => {
            try {
              await updateDeliveryStatus(deliveryId, currentStatus, true)
              Alert.alert('Succès', 'Paiement enregistré.')
              fetchData()
            } catch (err) {
              console.error('Error confirming cash payment:', err)
              Alert.alert('Erreur', 'Impossible de valider le paiement.')
            }
          }
        }
      ]
    )
  }

  const handleRollbackStatus = async (deliveryId: string, status: DeliveryStatus) => {
    Alert.alert(
      "Retourner à l'état précédent",
      `Voulez-vous retourner à l'état précédent (${status === 'ASSIGNED' ? 'Assignée' : 'Récupérée'}) ?`,
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, modifier',
          onPress: async () => {
            try {
              await updateDeliveryStatus(deliveryId, status)
              Alert.alert('Succès', 'Statut mis à jour.')
              fetchData()
            } catch (err) {
              console.error('Error rolling back status:', err)
              Alert.alert('Erreur', 'Impossible de modifier le statut.')
            }
          }
        }
      ]
    )
  }

  const handleCancelDelivery = async (deliveryId: string) => {
    Alert.alert(
      "Annuler la livraison",
      "Êtes-vous sûr de vouloir annuler la livraison de cette commande ? Elle redeviendra disponible pour les autres livreurs.",
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelDelivery(deliveryId)
              Alert.alert('Succès', 'Livraison annulée.')
              fetchData()
            } catch (err) {
              console.error('Error cancelling delivery:', err)
              Alert.alert('Erreur', "Impossible d'annuler la livraison.")
            }
          }
        }
      ]
    )
  }

  const renderAvailableItem = ({ item }: { item: Delivery }) => {
    const order = item.order
    if (!order) return null

    const totalItems = order.items?.reduce((s: number, i: any) => s + i.quantity, 0) || 0
    const orderDate = new Date(order.createdAt)
    const formattedDate = orderDate.toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit'
    })
    const pmLabel = item.paymentMethod === 'CREDIT_CARD' ? '💳 Carte' : item.paymentMethod === 'PAYPAL' ? '🅿️ PayPal' : '💵 Espèces'

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.idText}>Commande <Text style={styles.idHighlight}>#{order.id.slice(-6).toUpperCase()}</Text></Text>
          <View style={[styles.statusBadge, styles.statusPending]}>
            <Text style={styles.statusText}>Disponible</Text>
          </View>
        </View>

        <Text style={styles.dateText}>📅 {formattedDate} • {totalItems} article{totalItems > 1 ? 's' : ''}</Text>
        
        <View style={styles.clientBox}>
          <Text style={styles.clientText}>👤 Client : <Text style={styles.clientBold}>{order.customer?.name || 'Inconnu'}</Text> ({order.customer?.phone || 'Pas de téléphone'})</Text>
        </View>

        <View style={styles.addressBox}>
          <Text style={styles.addressText}>📍 {item.deliveryAddress}</Text>
        </View>

        {/* List of items */}
        {order.items && order.items.length > 0 && (
          <View style={styles.itemsContainer}>
            {order.items.map((oi: any) => {
              return (
                <View key={oi.id} style={styles.itemRow}>
                  {oi.item.imageUrl ? (
                    <Image source={{ uri: oi.item.imageUrl }} style={styles.itemImg} />
                  ) : (
                    <View style={[styles.itemImg, styles.itemImgPlaceholder]}>
                      <Text style={{ fontSize: 12 }}>🍽️</Text>
                    </View>
                  )}
                  <View style={styles.itemInfo}>
                    <View style={styles.itemTopRow}>
                      <Text style={styles.itemName} numberOfLines={1}>{oi.item.name}</Text>
                      <Text style={styles.itemQty}>×{oi.quantity}</Text>
                    </View>
                    <Text style={styles.itemPrice}>{(oi.unitPrice * oi.quantity).toFixed(2)} €</Text>
                  </View>
                </View>
              )
            })}
          </View>
        )}

        {/* Pricing Summary */}
        <View style={styles.metaBox}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Montant articles</Text>
            <Text style={styles.metaValue}>{order.totalAmount.toFixed(2)} €</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Frais de livraison</Text>
            <Text style={styles.metaValue}>{item.deliveryFee.toFixed(2)} €</Text>
          </View>
          <View style={[styles.metaRow, styles.metaTotalRow]}>
            <Text style={styles.metaTotalLabel}>Total à encaisser</Text>
            <Text style={styles.metaTotalValue}>{(order.totalAmount + item.deliveryFee).toFixed(2)} €</Text>
          </View>
          <View style={styles.badgesRow}>
            <View style={[styles.badgeItem, { backgroundColor: item.paymentMethod === 'CASH' ? 'rgba(234,179,8,0.15)' : 'rgba(59,130,246,0.15)' }]}>
              <Text style={[styles.badgeItemText, { color: item.paymentMethod === 'CASH' ? '#eab308' : '#3b82f6' }]}>{pmLabel}</Text>
            </View>
            <View style={[styles.badgeItem, { backgroundColor: item.isPaid ? 'rgba(16,185,129,0.15)' : 'rgba(234,179,8,0.15)' }]}>
              <Text style={[styles.badgeItemText, { color: item.isPaid ? '#10b981' : '#eab308' }]}>{item.isPaid ? '✅ Payé' : '⏳ À encaisser'}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() => handleAcceptDelivery(item.id)}
        >
          <Text style={styles.buttonText}>🚚 Accepter cette livraison</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const renderMyDeliveryItem = ({ item }: { item: Order }) => {
    const delivery = item.delivery
    if (!delivery) return null

    const isAssignedNotAccepted = delivery.status === 'ASSIGNED' && !delivery.acceptedByDeliverer
    const totalItems = item.items?.reduce((s: number, i: any) => s + i.quantity, 0) || 0
    const orderDate = new Date(item.createdAt)
    const formattedDate = orderDate.toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit'
    })
    const pmLabel = delivery.paymentMethod === 'CREDIT_CARD' ? '💳 Carte' : delivery.paymentMethod === 'PAYPAL' ? '🅿️ PayPal' : '💵 Espèces'

    let statusLabel = 'Assignée'
    let statusBg = 'rgba(234,179,8,0.15)'
    let statusColor = '#eab308'

    if (delivery.status === 'PICKED_UP') {
      if (delivery.confirmedByDeliverer) {
        statusLabel = 'Livrée (attente client)'
        statusBg = 'rgba(168,85,247,0.15)'
        statusColor = '#a855f7'
      } else {
        statusLabel = 'Récupérée'
        statusBg = 'rgba(59,130,246,0.15)'
        statusColor = '#3b82f6'
      }
    } else if (delivery.status === 'DELIVERED') {
      statusLabel = 'Livrée'
      statusBg = 'rgba(16,185,129,0.15)'
      statusColor = '#10b981'
    } else if (delivery.status === 'CANCELLED') {
      statusLabel = 'Annulée'
      statusBg = 'rgba(239,68,68,0.15)'
      statusColor = '#ef4444'
    }

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.idText}>Commande <Text style={styles.idHighlight}>#{item.id.slice(-6).toUpperCase()}</Text></Text>
          <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>

        <Text style={styles.dateText}>📅 {formattedDate} • {totalItems} article{totalItems > 1 ? 's' : ''}</Text>

        <View style={styles.clientBox}>
          <Text style={styles.clientText}>👤 Client : <Text style={styles.clientBold}>{item.customer?.name || 'Inconnu'}</Text> ({item.customer?.phone || 'Pas de téléphone'})</Text>
        </View>

        <View style={styles.addressBox}>
          <Text style={styles.addressText}>📍 {delivery.deliveryAddress}</Text>
        </View>

        {/* List of items */}
        {item.items && item.items.length > 0 && (
          <View style={styles.itemsContainer}>
            {item.items.map((oi: any) => (
              <View key={oi.id} style={styles.itemRow}>
                {oi.item.imageUrl ? (
                  <Image source={{ uri: oi.item.imageUrl }} style={styles.itemImg} />
                ) : (
                  <View style={[styles.itemImg, styles.itemImgPlaceholder]}>
                    <Text style={{ fontSize: 12 }}>🍽️</Text>
                  </View>
                )}
                <View style={styles.itemInfo}>
                  <View style={styles.itemTopRow}>
                    <Text style={styles.itemName} numberOfLines={1}>{oi.item.name}</Text>
                    <Text style={styles.itemQty}>×{oi.quantity}</Text>
                  </View>
                  <Text style={styles.itemPrice}>{(oi.unitPrice * oi.quantity).toFixed(2)} €</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Pricing Summary */}
        <View style={styles.metaBox}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Sous-total articles</Text>
            <Text style={styles.metaValue}>{item.totalAmount.toFixed(2)} €</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Frais de livraison</Text>
            <Text style={styles.metaValue}>{delivery.deliveryFee.toFixed(2)} €</Text>
          </View>
          <View style={[styles.metaRow, styles.metaTotalRow]}>
            <Text style={styles.metaTotalLabel}>Total à encaisser</Text>
            <Text style={styles.metaTotalValue}>{(item.totalAmount + delivery.deliveryFee).toFixed(2)} €</Text>
          </View>
          <View style={styles.badgesRow}>
            <View style={[styles.badgeItem, { backgroundColor: delivery.paymentMethod === 'CASH' ? 'rgba(234,179,8,0.15)' : 'rgba(59,130,246,0.15)' }]}>
              <Text style={[styles.badgeItemText, { color: delivery.paymentMethod === 'CASH' ? '#eab308' : '#3b82f6' }]}>{pmLabel}</Text>
            </View>
            <View style={[styles.badgeItem, { backgroundColor: delivery.isPaid ? 'rgba(16,185,129,0.15)' : 'rgba(234,179,8,0.15)' }]}>
              <Text style={[styles.badgeItemText, { color: delivery.isPaid ? '#10b981' : '#eab308' }]}>{delivery.isPaid ? '✅ Payé' : '⏳ À encaisser'}</Text>
            </View>
          </View>
          {delivery.confirmedByCustomer && !delivery.confirmedByDeliverer && (
            <Text style={styles.alertText}>✓ Le client a déjà confirmé la réception</Text>
          )}
          {delivery.confirmedByDeliverer && !delivery.confirmedByCustomer && (
            <Text style={styles.warnText}>⏳ En attente de confirmation du client</Text>
          )}
        </View>

        <View style={styles.actionsContainer}>
          {isAssignedNotAccepted ? (
            <View style={styles.rowActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.acceptButtonColor]}
                onPress={() => handleAcceptAssignment(delivery.id)}
              >
                <Text style={[styles.buttonText, { color: '#22c55e' }]}>✓ Accepter</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButtonColor]}
                onPress={() => handleRejectAssignment(delivery.id)}
              >
                <Text style={[styles.buttonText, { color: '#ef4444' }]}>✗ Refuser</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {delivery.paymentMethod === 'CASH' && !delivery.isPaid && delivery.status === 'DELIVERED' && (
                <TouchableOpacity
                  style={[styles.fullButton, styles.collectCashButton]}
                  onPress={() => handleConfirmCashPayment(delivery.id, delivery.status, item.totalAmount + delivery.deliveryFee)}
                >
                  <Text style={[styles.buttonText, { color: '#22c55e' }]}>💵 Encaisser {(item.totalAmount + delivery.deliveryFee).toFixed(2)} €</Text>
                </TouchableOpacity>
              )}
              {delivery.status === 'ASSIGNED' && (
                <TouchableOpacity
                  style={[styles.fullButton, styles.pickupButtonColor]}
                  onPress={() => handleUpdateStatus(delivery.id, 'PICKED_UP')}
                >
                  <Text style={styles.buttonText}>📦 Commande récupérée</Text>
                </TouchableOpacity>
              )}
              {delivery.status === 'PICKED_UP' && !delivery.confirmedByDeliverer && (
                <View style={{ gap: 8 }}>
                  <TouchableOpacity
                    style={[styles.fullButton, styles.deliverButtonColor]}
                    onPress={() => handleUpdateStatus(delivery.id, 'DELIVERED')}
                  >
                    <Text style={styles.buttonText}>✅ Livraison effectuée</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.fullButton, styles.rollbackButton]}
                    onPress={() => handleRollbackStatus(delivery.id, 'ASSIGNED')}
                  >
                    <Text style={[styles.buttonText, { color: '#ef4444' }]}>🔄 Retour (Assignée)</Text>
                  </TouchableOpacity>
                </View>
              )}
              {delivery.status === 'DELIVERED' && !delivery.confirmedByCustomer && !delivery.confirmedByDeliverer && (
                <TouchableOpacity
                  style={[styles.fullButton, styles.rollbackButton]}
                  onPress={() => handleRollbackStatus(delivery.id, 'PICKED_UP')}
                >
                  <Text style={[styles.buttonText, { color: '#ef4444' }]}>🔄 Retour (Récupérée)</Text>
                </TouchableOpacity>
              )}
              {delivery.status !== 'DELIVERED' && delivery.status !== 'CANCELLED' && (
                <View style={styles.rowActions}>
                  <TouchableOpacity
                    style={styles.actionBtnSecondary}
                    onPress={() => navigation.navigate('OrderTracking', { orderId: item.id })}
                  >
                    <Text style={styles.actionBtnSecondaryText}>📍 Carte & GPS</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionBtnSecondary}
                    onPress={() =>
                      navigation.navigate('Chat', {
                        orderId: item.id,
                        interlocutorName: item.customer?.name || 'Client',
                        interlocutorRole: 'CLIENT',
                      })
                    }
                  >
                    <Text style={styles.actionBtnSecondaryText}>💬 Chat Client</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtnSecondary, { borderColor: 'rgba(239,68,68,0.3)' }]}
                    onPress={() => handleCancelDelivery(delivery.id)}
                  >
                    <Text style={[styles.actionBtnSecondaryText, { color: '#ef4444' }]}>Annuler</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>
      </View>
    )
  }

  const filteredAvailable = availableDeliveries.filter(d => {
    const order = d.order
    if (!order) return false
    const q = search.toLowerCase()
    const matchSearch = !q || d.id.toLowerCase().includes(q) || d.deliveryAddress.toLowerCase().includes(q) || (order.customer?.name || '').toLowerCase().includes(q) || order.items.some(i => i.item.name.toLowerCase().includes(q))
    const matchPayment = filterPayment === 'ALL' || d.paymentMethod === filterPayment
    return matchSearch && matchPayment
  })

  const filteredMy = myDeliveries.filter(o => {
    const delivery = o.delivery
    if (!delivery) return false
    const q = search.toLowerCase()
    const matchSearch = !q || o.id.toLowerCase().includes(q) || delivery.deliveryAddress.toLowerCase().includes(q) || (o.customer?.name || '').toLowerCase().includes(q) || o.items.some(i => i.item.name.toLowerCase().includes(q))
    const matchPayment = filterPayment === 'ALL' || delivery.paymentMethod === filterPayment
    return matchSearch && matchPayment
  })

  const activeFiltersCount = [search.trim() !== '', filterPayment !== 'ALL'].filter(Boolean).length

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.tabsHeader}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'available' && styles.activeTab]}
          onPress={() => {
            setActiveTab('available')
            setAvailableDeliveries([])
          }}
        >
          <Text style={[styles.tabText, activeTab === 'available' && styles.activeTabText]}>
            Disponibles ({availableDeliveries.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'mine' && styles.activeTab]}
          onPress={() => {
            setActiveTab('mine')
            setMyDeliveries([])
          }}
        >
          <Text style={[styles.tabText, activeTab === 'mine' && styles.activeTabText]}>
            Mes Livraisons ({myDeliveries.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Collapsible filter panel ── */}
      <View style={styles.filterPanel}>
        <TouchableOpacity
          style={styles.filterPanelHeader}
          onPress={() => setShowFilters(v => !v)}
          activeOpacity={0.7}
        >
          <Text style={styles.filterPanelTitle}>
            🔍 Filtres & Recherche {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''}
          </Text>
          <Text style={styles.filterPanelToggle}>
            {showFilters ? 'Masquer ▲' : 'Afficher ▼'}
          </Text>
        </TouchableOpacity>

        {showFilters && (
          <View style={styles.filterPanelBody}>
            <View style={styles.filterInputRow}>
              <TextInput
                style={styles.filterInputSearch}
                value={search}
                onChangeText={setSearch}
                placeholder="Rechercher par adresse, ID, client, plat..."
                placeholderTextColor="#64748b"
              />
            </View>
            <View style={styles.filterButtonsRow}>
              {(['ALL', 'CREDIT_CARD', 'PAYPAL', 'CASH'] as const).map(method => {
                const label = method === 'ALL' ? 'Tout' : method === 'CREDIT_CARD' ? '💳 CB' : method === 'PAYPAL' ? '🅿️ PayPal' : '💵 Espèces'
                return (
                  <TouchableOpacity
                    key={method}
                    style={[styles.filterChipButton, filterPayment === method && styles.filterChipButtonActive]}
                    onPress={() => setFilterPayment(method)}
                  >
                    <Text style={[styles.filterChipButtonText, filterPayment === method && styles.filterChipButtonTextActive]}>{label}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            <TouchableOpacity 
              style={styles.resetFiltersBtn}
              onPress={() => { setSearch(''); setFilterPayment('ALL') }}
            >
              <Text style={styles.resetFiltersBtnText}>Réinitialiser</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : activeTab === 'available' ? (
        <FlatList
          data={filteredAvailable}
          keyExtractor={(item) => item.id}
          renderItem={renderAvailableItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>Aucune livraison pour le moment</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={filteredMy}
          keyExtractor={(item) => item.id}
          renderItem={renderMyDeliveryItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>Aucune livraison pour le moment</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0f14',
  },
  tabsHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    backgroundColor: '#151821',
    paddingTop: 6,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#f97316',
  },
  tabText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '700',
  },
  activeTabText: {
    color: '#f97316',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 16,
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#151821',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  idText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  idHighlight: {
    color: '#f1f5f9',
    fontWeight: '900',
    fontSize: 15,
  },
  dateText: {
    color: '#64748b',
    fontSize: 11,
    marginBottom: 8,
  },
  clientBox: {
    marginBottom: 8,
  },
  clientText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  clientBold: {
    color: '#f1f5f9',
    fontWeight: '800',
  },
  addressBox: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  addressText: {
    color: '#f1f5f9',
    fontSize: 13,
  },
  itemsContainer: {
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    gap: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemImg: {
    width: 40,
    height: 40,
    borderRadius: 6,
    marginRight: 10,
  },
  itemImgPlaceholder: {
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemName: {
    color: '#f1f5f9',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  itemQty: {
    color: '#f97316',
    fontWeight: '800',
    fontSize: 12,
  },
  itemPrice: {
    color: '#f97316',
    fontSize: 13,
    fontWeight: '700',
  },
  metaBox: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    color: '#64748b',
    fontSize: 12,
  },
  metaValue: {
    color: '#f1f5f9',
    fontSize: 12,
    fontWeight: '700',
  },
  metaTotalRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 6,
    marginTop: 2,
  },
  metaTotalLabel: {
    color: '#f1f5f9',
    fontSize: 13,
    fontWeight: '800',
  },
  metaTotalValue: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: '900',
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  badgeItem: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeItemText: {
    fontSize: 10,
    fontWeight: '800',
  },
  alertText: {
    color: '#22c55e',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  warnText: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  acceptButton: {
    backgroundColor: '#f97316',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusPending: {
    backgroundColor: 'rgba(249,115,22,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.4)',
  },
  statusText: {
    color: '#f97316',
    fontSize: 11,
    fontWeight: '800',
  },
  actionsContainer: {
    gap: 8,
  },
  rowActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  acceptButtonColor: {
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  rejectButtonColor: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  fullButton: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  collectCashButton: {
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  pickupButtonColor: {
    backgroundColor: 'rgba(249,115,22,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.4)',
  },
  deliverButtonColor: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.4)',
  },
  rollbackButton: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  actionBtnSecondary: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  actionBtnSecondaryText: {
    color: '#f1f5f9',
    fontSize: 12,
    fontWeight: '800',
  },
  filterPanel: {
    backgroundColor: '#151821',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  filterPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterPanelTitle: {
    color: '#f1f5f9',
    fontSize: 13,
    fontWeight: '700',
  },
  filterPanelToggle: {
    color: '#f97316',
    fontSize: 11,
    fontWeight: '700',
  },
  filterPanelBody: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 10,
  },
  filterInputRow: {
    width: '100%',
  },
  filterInputSearch: {
    backgroundColor: '#0d0f14',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#f1f5f9',
    fontSize: 13,
  },
  filterButtonsRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  filterChipButton: {
    backgroundColor: '#0d0f14',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  filterChipButtonActive: {
    backgroundColor: '#f97316',
    borderColor: '#f97316',
  },
  filterChipButtonText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
  },
  filterChipButtonTextActive: {
    color: '#fff',
  },
  resetFiltersBtn: {
    alignSelf: 'flex-end',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  resetFiltersBtnText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
})
