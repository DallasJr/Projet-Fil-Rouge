import React, { useState, useEffect, useCallback } from 'react'
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, ScrollView,
  Modal, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { Order, OrderStatus } from '../../api/orders'
import {
  getAllOrders, updateOrderStatus,
  assignDeliverer, getAvailableDeliverers, UserDetail,
} from '../../api/admin'

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING:    '⏳ En attente',
  ACCEPTED:   '✅ Acceptée',
  PREPARING:  '👨‍🍳 Préparation',
  READY:      '📦 Prête',
  DELIVERING: '🚴 En livraison',
  DELIVERED:  '🏁 Livrée',
  CANCELLED:  '❌ Annulée',
}

const STATUS_COLORS: Record<OrderStatus, { bg: string; text: string }> = {
  PENDING:    { bg: 'rgba(234,179,8,0.15)',   text: '#eab308' },
  ACCEPTED:   { bg: 'rgba(59,130,246,0.15)',  text: '#3b82f6' },
  PREPARING:  { bg: 'rgba(168,85,247,0.15)', text: '#a855f7' },
  READY:      { bg: 'rgba(34,197,94,0.15)',   text: '#22c55e' },
  DELIVERING: { bg: 'rgba(249,115,22,0.15)',  text: '#f97316' },
  DELIVERED:  { bg: 'rgba(16,185,129,0.15)',  text: '#10b981' },
  CANCELLED:  { bg: 'rgba(239,68,68,0.15)',   text: '#ef4444' },
}

// Next possible statuses for the admin to advance
const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PENDING:   ['ACCEPTED', 'CANCELLED'],
  ACCEPTED:  ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY:     ['CANCELLED'],
}

const STATUS_FILTERS = ['ALL', 'PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'DELIVERING', 'DELIVERED', 'CANCELLED']

export default function AdminOrdersScreen() {
  const navigation = useNavigation<any>()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // Assign deliverer modal
  const [assignModalOrder, setAssignModalOrder] = useState<Order | null>(null)
  const [deliverers, setDeliverers] = useState<UserDetail[]>([])
  const [loadingDeliverers, setLoadingDeliverers] = useState(false)

  const loadOrders = useCallback(async (showIndicator = true) => {
    if (showIndicator) setLoading(true)
    try {
      const data = await getAllOrders()
      const sorted = data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setOrders(sorted)
    } catch (err) {
      console.error('Failed to load admin orders:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { loadOrders() }, [loadOrders])

  const onRefresh = () => {
    setRefreshing(true)
    loadOrders(false)
  }

  const handleStatusChange = async (order: Order, newStatus: OrderStatus) => {
    setUpdatingId(order.id)
    try {
      await updateOrderStatus(order.id, newStatus)
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: newStatus } : o))
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error || 'Impossible de mettre à jour le statut.')
    } finally {
      setUpdatingId(null)
    }
  }

  const openAssignModal = async (order: Order) => {
    setAssignModalOrder(order)
    setLoadingDeliverers(true)
    try {
      const data = await getAvailableDeliverers()
      setDeliverers(data)
    } catch {
      setDeliverers([])
    } finally {
      setLoadingDeliverers(false)
    }
  }

  const handleAssign = async (delivererId: string) => {
    if (!assignModalOrder?.delivery) return
    try {
      await assignDeliverer(assignModalOrder.delivery.id, delivererId)
      Alert.alert('Succès', 'Livreur assigné avec succès.')
      setAssignModalOrder(null)
      loadOrders(false)
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error || 'Impossible d\'assigner le livreur.')
    }
  }

  const filteredOrders = orders.filter(o => {
    const matchStatus = statusFilter === 'ALL' || o.status === statusFilter
    const q = search.toLowerCase()
    const matchSearch = !q ||
      o.id.toLowerCase().includes(q) ||
      o.items.some(i => i.item.name.toLowerCase().includes(q))
    return matchStatus && matchSearch
  })

  const renderOrder = ({ item }: { item: Order }) => {
    const isExpanded = expandedId === item.id
    const colors = STATUS_COLORS[item.status]
    const nextStatuses = NEXT_STATUS[item.status] || []
    const isUpdating = updatingId === item.id
    const formattedDate = new Date(item.createdAt).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    })
    const isReady = item.status === 'READY'

    return (
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.cardHeader}
          activeOpacity={0.7}
          onPress={() => setExpandedId(prev => prev === item.id ? null : item.id)}
        >
          <View style={styles.cardHeaderRow}>
            <Text style={styles.orderId}>#{item.id.substring(0, 8)}</Text>
            <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
              <Text style={[styles.statusBadgeText, { color: colors.text }]}>
                {STATUS_LABELS[item.status]}
              </Text>
            </View>
          </View>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.orderDate}>{formattedDate}</Text>
            <Text style={styles.orderTotal}>{item.totalAmount.toFixed(2)} €</Text>
          </View>
          <Text style={styles.orderItems}>
            {item.items.reduce((s, i) => s + i.quantity, 0)} article(s)
            {item.delivery ? ` · 🚴 Livraison` : ' · 🏠 Sur place'}
          </Text>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.cardBody}>
            {/* Articles */}
            <Text style={styles.bodySection}>Articles commandés</Text>
            {item.items.map(oi => (
              <View key={oi.id} style={styles.itemRow}>
                <Text style={styles.itemName}>{oi.quantity}× {oi.item.name}</Text>
                <Text style={styles.itemPrice}>{(oi.unitPrice * oi.quantity).toFixed(2)} €</Text>
              </View>
            ))}

            {/* Delivery info */}
            {item.delivery && (
              <View style={styles.deliveryInfo}>
                <Text style={styles.bodySection}>Livraison</Text>
                <Text style={styles.deliveryDetail}>📍 {item.delivery.deliveryAddress}</Text>
                <Text style={styles.deliveryDetail}>
                  💳 {item.delivery.paymentMethod === 'CREDIT_CARD' ? 'Carte bancaire' : item.delivery.paymentMethod === 'PAYPAL' ? 'PayPal' : 'Espèces'}
                </Text>
                {item.delivery.deliverer ? (
                  <Text style={styles.deliveryDetail}>👤 Livreur : {item.delivery.deliverer.name}</Text>
                ) : (
                  <Text style={[styles.deliveryDetail, { color: '#f97316' }]}>⚠️ Aucun livreur assigné</Text>
                )}
              </View>
            )}

            {/* Note */}
            {item.note && (
              <View style={styles.noteBox}>
                <Text style={styles.noteLabel}>📝 Note client</Text>
                <Text style={styles.noteText}>{item.note}</Text>
              </View>
            )}

            {/* Actions */}
            <View style={styles.actionsBox}>
              {/* Status progression */}
              {nextStatuses.length > 0 && (
                <>
                  <Text style={styles.actionsLabel}>Changer le statut :</Text>
                  <View style={styles.statusBtns}>
                    {nextStatuses.map(ns => (
                      <TouchableOpacity
                        key={ns}
                        style={[styles.statusBtn, ns === 'CANCELLED' && styles.statusBtnCancel]}
                        onPress={() => handleStatusChange(item, ns)}
                        disabled={isUpdating}
                      >
                        {isUpdating
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <Text style={styles.statusBtnText}>{STATUS_LABELS[ns]}</Text>
                        }
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* Assign deliverer (only when READY and has delivery but no deliverer) */}
              {isReady && item.delivery && !item.delivery.delivererId && (
                <TouchableOpacity
                  style={styles.assignBtn}
                  onPress={() => openAssignModal(item)}
                >
                  <Text style={styles.assignBtnText}>🚴 Assigner un livreur</Text>
                </TouchableOpacity>
              )}

              {/* Chat */}
              {item.delivery && (
                <TouchableOpacity
                  style={styles.chatBtn}
                  onPress={() => navigation.navigate('Chat', {
                    orderId: item.id,
                    interlocutorName: 'Client',
                    interlocutorRole: 'CLIENT',
                  })}
                >
                  <Text style={styles.chatBtnText}>💬 Chat commande</Text>
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Commandes</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher par ID ou plat..."
          placeholderTextColor="#475569"
        />
      </View>

      {/* Status filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersRow}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
      >
        {STATUS_FILTERS.map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.filterChip, statusFilter === s && styles.filterChipActive]}
            onPress={() => setStatusFilter(s)}
          >
            <Text style={[styles.filterChipText, statusFilter === s && styles.filterChipTextActive]}>
              {s === 'ALL' ? '📋 Tout' : STATUS_LABELS[s as OrderStatus]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Orders list */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#f97316" />
          <Text style={styles.loadingText}>Chargement des commandes...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={i => i.id}
          renderItem={renderOrder}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>Aucune commande trouvée</Text>
            </View>
          }
        />
      )}

      {/* Assign Deliverer Modal */}
      <Modal visible={!!assignModalOrder} animationType="slide" transparent onRequestClose={() => setAssignModalOrder(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🚴 Assigner un livreur</Text>
              <TouchableOpacity onPress={() => setAssignModalOrder(null)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            {loadingDeliverers ? (
              <ActivityIndicator size="large" color="#f97316" style={{ marginVertical: 24 }} />
            ) : deliverers.length === 0 ? (
              <Text style={styles.emptyText}>Aucun livreur disponible en ce moment.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 360 }}>
                {deliverers.map(d => (
                  <TouchableOpacity
                    key={d.id}
                    style={styles.delivererRow}
                    onPress={() => handleAssign(d.id)}
                  >
                    <View style={styles.delivererAvatar}>
                      <Text style={styles.delivererAvatarText}>{d.name.substring(0, 2).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.delivererName}>{d.name}</Text>
                      {d.phone && <Text style={styles.delivererPhone}>{d.phone}</Text>}
                    </View>
                    <View style={styles.onlineDot} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0f14' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 20 },
  loadingText: { color: '#94a3b8', fontSize: 14 },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: '#64748b', fontSize: 15, textAlign: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  backBtn: { padding: 4 },
  backBtnText: { color: '#f97316', fontWeight: '800', fontSize: 15 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#f1f5f9' },

  searchRow: { paddingHorizontal: 16, paddingVertical: 10 },
  searchInput: {
    backgroundColor: '#151821', borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)', paddingHorizontal: 16,
    paddingVertical: 11, fontSize: 14, color: '#f1f5f9',
  },

  filtersRow: { maxHeight: 48, marginBottom: 4 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#151821', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  filterChipActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  filterChipText: { color: '#94a3b8', fontSize: 12, fontWeight: '700' },
  filterChipTextActive: { color: '#fff' },

  list: { padding: 16, gap: 12, paddingBottom: 32 },

  card: {
    backgroundColor: '#151821', borderRadius: 16, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)', overflow: 'hidden',
  },
  cardHeader: { padding: 16 },
  cardHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 6,
  },
  orderId: { color: '#f1f5f9', fontSize: 15, fontWeight: '800' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusBadgeText: { fontSize: 11, fontWeight: '800' },
  orderDate: { color: '#64748b', fontSize: 13 },
  orderTotal: { color: '#f97316', fontSize: 17, fontWeight: '900' },
  orderItems: { color: '#64748b', fontSize: 12, marginTop: 2 },

  cardBody: {
    padding: 16, borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)', gap: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  bodySection: {
    color: '#94a3b8', fontSize: 11, fontWeight: '800',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  itemRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  itemName: { color: '#f1f5f9', fontSize: 13, flex: 1 },
  itemPrice: { color: '#f97316', fontSize: 13, fontWeight: '700' },

  deliveryInfo: { gap: 6 },
  deliveryDetail: { color: '#f1f5f9', fontSize: 13 },

  noteBox: {
    backgroundColor: 'rgba(249,115,22,0.08)', borderRadius: 10,
    padding: 10, borderWidth: 1, borderColor: 'rgba(249,115,22,0.2)',
  },
  noteLabel: { color: '#f97316', fontSize: 11, fontWeight: '700', marginBottom: 4 },
  noteText: { color: '#f1f5f9', fontSize: 13 },

  actionsBox: { gap: 10 },
  actionsLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  statusBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusBtn: {
    backgroundColor: '#f97316', borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 10, alignItems: 'center', justifyContent: 'center',
    flex: 1, minWidth: 120,
  },
  statusBtnCancel: { backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)' },
  statusBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  assignBtn: {
    backgroundColor: 'rgba(34,197,94,0.15)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.4)',
    borderRadius: 12, paddingVertical: 12, alignItems: 'center',
  },
  assignBtnText: { color: '#22c55e', fontWeight: '800', fontSize: 13 },

  chatBtn: {
    backgroundColor: '#1e293b', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12, paddingVertical: 12, alignItems: 'center',
  },
  chatBtnText: { color: '#f1f5f9', fontWeight: '800', fontSize: 13 },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#151821', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20,
  },
  modalTitle: { color: '#f1f5f9', fontSize: 18, fontWeight: '900' },
  closeBtn: { color: '#64748b', fontSize: 20, fontWeight: '800' },

  delivererRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  delivererAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(249,115,22,0.15)', borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.3)', justifyContent: 'center', alignItems: 'center',
  },
  delivererAvatarText: { color: '#f97316', fontWeight: '900', fontSize: 15 },
  delivererName: { color: '#f1f5f9', fontSize: 15, fontWeight: '700' },
  delivererPhone: { color: '#64748b', fontSize: 13 },
  onlineDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#22c55e', borderWidth: 2, borderColor: '#0d0f14',
  },
})
