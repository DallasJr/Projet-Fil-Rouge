import React, { useState, useEffect, useCallback } from 'react'
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { getMyOrders, confirmDelivery, Order, OrderStatus } from '../api/orders'

export default function OrderHistoryScreen() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({})
  const navigation = useNavigation<any>()

  const fetchOrders = useCallback(async (showIndicator = true) => {
    if (showIndicator) setLoading(true)
    try {
      const data = await getMyOrders()
      // Sort orders by creation date descending
      const sorted = data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setOrders(sorted)
    } catch (err) {
      console.error('Error fetching orders:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchOrders(false)
  }, [fetchOrders])

  const toggleExpand = (orderId: string) => {
    setExpandedOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }))
  }

  const handleConfirmReceipt = async (orderId: string) => {
    try {
      await confirmDelivery(orderId)
      fetchOrders(false)
    } catch (err) {
      console.error('Error confirming delivery:', err)
    }
  }

  const getStatusStyle = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING':
        return { bg: '#fef3c7', text: '#d97706', label: 'En attente' }
      case 'ACCEPTED':
        return { bg: '#e0f2fe', text: '#0284c7', label: 'Acceptée' }
      case 'PREPARING':
        return { bg: '#f3e8ff', text: '#7c3aed', label: 'En préparation' }
      case 'READY':
        return { bg: '#dcfce7', text: '#16a34a', label: 'Prête' }
      case 'DELIVERING':
        return { bg: '#ffe4e6', text: '#e11d48', label: 'En livraison' }
      case 'DELIVERED':
        return { bg: '#d1fae5', text: '#059669', label: 'Livrée' }
      case 'CANCELLED':
        return { bg: '#fee2e2', text: '#dc2626', label: 'Annulée' }
      default:
        return { bg: '#f1f5f9', text: '#475569', label: status }
    }
  }

  const renderOrderItem = ({ item }: { item: Order }) => {
    const isExpanded = !!expandedOrders[item.id]
    const statusInfo = getStatusStyle(item.status)
    const formattedDate = new Date(item.createdAt).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })

    const showConfirmBtn =
      item.delivery &&
      item.delivery.status === 'DELIVERED' &&
      !item.delivery.confirmedByCustomer

    const showTrackBtn =
      item.delivery &&
      item.status !== 'DELIVERED' &&
      item.status !== 'CANCELLED'

    return (
      <View style={styles.orderCard}>
        <TouchableOpacity style={styles.cardHeader} onPress={() => toggleExpand(item.id)}>
          <View style={styles.headerRow}>
            <Text style={styles.dateText}>{formattedDate}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
              <Text style={[styles.statusText, { color: statusInfo.text }]}>{statusInfo.label}</Text>
            </View>
          </View>
          <View style={styles.headerRow}>
            <Text style={styles.idText}>Commande #{item.id.substring(0, 8)}</Text>
            <Text style={styles.totalText}>{item.totalAmount.toFixed(2)} €</Text>
          </View>
          <Text style={styles.itemsCountText}>
            {item.items.reduce((acc, curr) => acc + curr.quantity, 0)} article(s)
          </Text>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.cardDetails}>
            <Text style={styles.sectionTitle}>Détail des articles</Text>
            {item.items.map((orderItem) => (
              <View key={orderItem.id} style={styles.itemRow}>
                <Text style={styles.itemName}>
                  {orderItem.quantity}x {orderItem.item.name}
                </Text>
                <Text style={styles.itemPrice}>
                  {(orderItem.unitPrice * orderItem.quantity).toFixed(2)} €
                </Text>
              </View>
            ))}

            {item.note && (
              <View style={styles.noteContainer}>
                <Text style={styles.noteLabel}>Note :</Text>
                <Text style={styles.noteText}>{item.note}</Text>
              </View>
            )}

            {item.delivery && (
              <View style={styles.deliveryContainer}>
                <Text style={styles.sectionTitle}>Détails de la livraison</Text>
                <Text style={styles.deliveryAddress}>
                  📍 Adresse : {item.delivery.deliveryAddress}
                </Text>
                <Text style={styles.deliveryStatus}>
                  🚚 Statut : {item.delivery.status}
                </Text>
                {item.delivery.deliverer && (
                  <Text style={styles.delivererText}>
                    👤 Livreur : {item.delivery.deliverer.name}
                  </Text>
                )}
              </View>
            )}

            <View style={styles.actionsContainer}>
              {showTrackBtn && (
                <TouchableOpacity
                  style={styles.trackButton}
                  onPress={() => navigation.navigate('OrderTracking', { orderId: item.id })}
                >
                  <Text style={styles.trackButtonText}>📍 Suivre en temps réel</Text>
                </TouchableOpacity>
              )}

              {showConfirmBtn && (
                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={() => handleConfirmReceipt(item.id)}
                >
                  <Text style={styles.confirmButtonText}>✅ Confirmer la réception</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mes Commandes</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.noOrdersText}>Aucune commande trouvée</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={() => fetchOrders()}>
            <Text style={styles.refreshButtonText}>Actualiser</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={renderOrderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noOrdersText: {
    color: '#94a3b8',
    fontSize: 16,
    marginBottom: 16,
  },
  refreshButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  listContent: {
    padding: 16,
  },
  orderCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  cardHeader: {
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  idText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalText: {
    color: '#6366f1',
    fontSize: 18,
    fontWeight: 'bold',
  },
  itemsCountText: {
    color: '#64748b',
    fontSize: 13,
  },
  cardDetails: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    backgroundColor: '#0f172a',
  },
  sectionTitle: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
    marginTop: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  itemName: {
    color: '#ffffff',
    fontSize: 14,
  },
  itemPrice: {
    color: '#ffffff',
    fontSize: 14,
  },
  noteContainer: {
    marginTop: 12,
    backgroundColor: '#1e293b',
    padding: 10,
    borderRadius: 8,
  },
  noteLabel: {
    color: '#6366f1',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  noteText: {
    color: '#ffffff',
    fontSize: 13,
  },
  deliveryContainer: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 12,
  },
  deliveryAddress: {
    color: '#ffffff',
    fontSize: 13,
    marginBottom: 4,
  },
  deliveryStatus: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 4,
  },
  delivererText: {
    color: '#ffffff',
    fontSize: 13,
  },
  actionsContainer: {
    marginTop: 16,
    gap: 10,
  },
  trackButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  trackButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  confirmButton: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
})
