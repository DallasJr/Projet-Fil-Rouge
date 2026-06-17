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
  Alert,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import {
  getAvailableDeliveries,
  acceptDelivery,
  getMyDeliveries,
  acceptAssignment,
  rejectAssignment,
  updateDeliveryStatus,
  Delivery,
  Order,
  DeliveryStatus,
} from '../api/orders'

export default function DelivererScreen() {
  const [activeTab, setActiveTab] = useState<'available' | 'mine'>('available')
  const [availableDeliveries, setAvailableDeliveries] = useState<Delivery[]>([])
  const [myDeliveries, setMyDeliveries] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const navigation = useNavigation<any>()

  const fetchData = useCallback(async (showIndicator = true) => {
    if (showIndicator) setLoading(true)
    try {
      if (activeTab === 'available') {
        const data = await getAvailableDeliveries()
        setAvailableDeliveries(data)
      } else {
        const data = await getMyDeliveries()
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
      Alert.alert('Succès', `Statut mis à jour : ${status === 'PICKED_UP' ? 'Récupérée' : 'Livrée'}.`)
      fetchData()
    } catch (err) {
      console.error('Error updating status:', err)
      Alert.alert('Erreur', 'Impossible de mettre à jour le statut.')
    }
  }

  const renderAvailableItem = ({ item }: { item: Delivery }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.idText}>Livraison #{item.id.substring(0, 8)}</Text>
        <Text style={styles.feeText}>+ {item.deliveryFee.toFixed(2)} €</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.infoText}>📍 {item.deliveryAddress}</Text>
        <Text style={styles.infoText}>💳 Paiement : {item.paymentMethod}</Text>
      </View>
      <TouchableOpacity
        style={styles.acceptButton}
        onPress={() => handleAcceptDelivery(item.id)}
      >
        <Text style={styles.buttonText}>Accepter la livraison</Text>
      </TouchableOpacity>
    </View>
  )

  const renderMyDeliveryItem = ({ item }: { item: Order }) => {
    const delivery = item.delivery
    if (!delivery) return null

    const isAssignedNotAccepted = delivery.status === 'ASSIGNED' && !delivery.acceptedByDeliverer

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.idText}>Commande #{item.id.substring(0, 8)}</Text>
          <View style={[styles.statusBadge, delivery.status === 'DELIVERED' ? styles.statusDelivered : styles.statusPending]}>
            <Text style={styles.statusText}>{delivery.status}</Text>
          </View>
        </View>
        
        <View style={styles.cardBody}>
          <Text style={styles.infoText}>📍 Adresse : {delivery.deliveryAddress}</Text>
          <Text style={styles.infoText}>💰 Total Commande : {item.totalAmount.toFixed(2)} €</Text>
          <Text style={styles.infoText}>🚴 Commission : {delivery.deliveryFee.toFixed(2)} €</Text>
        </View>

        <View style={styles.actionsContainer}>
          {isAssignedNotAccepted ? (
            <View style={styles.rowActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.acceptButtonColor]}
                onPress={() => handleAcceptAssignment(delivery.id)}
              >
                <Text style={styles.buttonText}>✓ Accepter</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButtonColor]}
                onPress={() => handleRejectAssignment(delivery.id)}
              >
                <Text style={styles.buttonText}>✗ Refuser</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {delivery.status === 'ASSIGNED' && (
                <TouchableOpacity
                  style={[styles.fullButton, styles.pickupButtonColor]}
                  onPress={() => handleUpdateStatus(delivery.id, 'PICKED_UP')}
                >
                  <Text style={styles.buttonText}>📦 Commande récupérée</Text>
                </TouchableOpacity>
              )}
              {delivery.status === 'PICKED_UP' && (
                <TouchableOpacity
                  style={[styles.fullButton, styles.deliverButtonColor]}
                  onPress={() => handleUpdateStatus(delivery.id, 'DELIVERED')}
                >
                  <Text style={styles.buttonText}>🏁 Commande livrée</Text>
                </TouchableOpacity>
              )}
              {delivery.status !== 'DELIVERED' && delivery.status !== 'CANCELLED' && (
                <TouchableOpacity
                  style={styles.trackButton}
                  onPress={() => navigation.navigate('OrderTracking', { orderId: item.id })}
                >
                  <Text style={styles.trackButtonText}>📍 Ouvrir la carte de suivi</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>
    )
  }

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

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : activeTab === 'available' ? (
        <FlatList
          data={availableDeliveries}
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
          data={myDeliveries}
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
    backgroundColor: '#0f172a',
  },
  tabsHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#1e293b',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#6366f1',
  },
  tabText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: 'bold',
  },
  activeTabText: {
    color: '#ffffff',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 16,
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  idText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  feeText: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cardBody: {
    marginBottom: 16,
  },
  infoText: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 6,
  },
  acceptButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  statusPending: {
    backgroundColor: '#3b82f6',
  },
  statusDelivered: {
    backgroundColor: '#10b981',
  },
  statusText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  actionsContainer: {
    gap: 8,
  },
  rowActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButtonColor: {
    backgroundColor: '#10b981',
  },
  rejectButtonColor: {
    backgroundColor: '#ef4444',
  },
  fullButton: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  pickupButtonColor: {
    backgroundColor: '#f59e0b',
  },
  deliverButtonColor: {
    backgroundColor: '#10b981',
  },
  trackButton: {
    width: '100%',
    backgroundColor: '#475569',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  trackButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
})
