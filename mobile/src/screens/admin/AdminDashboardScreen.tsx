import React, { useState, useEffect, useCallback } from 'react'
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator,
  RefreshControl, TextInput, ScrollView, Modal, Alert, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { Order, OrderStatus } from '../../api/orders'
import { getDashboardStats, getAllOrders, updateOrderStatus, assignDeliverer, getAvailableDeliverers, UserDetail, DashboardStats } from '../../api/admin'

// ─── Status config ───────────────────────────────────────────────────────────

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING:    '⏳ En attente',
  ACCEPTED:   '✅ Acceptée',
  PREPARING:  '👨‍🍳 Préparation',
  READY:      '📦 Prête',
  DELIVERING: '🚴 Livraison',
  DELIVERED:  '🏁 Livrée',
  CANCELLED:  '❌ Annulée',
}

const STATUS_COLORS: Record<OrderStatus, { bg: string; text: string }> = {
  PENDING:    { bg: 'rgba(234,179,8,0.15)',  text: '#eab308' },
  ACCEPTED:   { bg: 'rgba(59,130,246,0.15)', text: '#3b82f6' },
  PREPARING:  { bg: 'rgba(168,85,247,0.15)', text: '#a855f7' },
  READY:      { bg: 'rgba(34,197,94,0.15)',  text: '#22c55e' },
  DELIVERING: { bg: 'rgba(249,115,22,0.15)', text: '#f97316' },
  DELIVERED:  { bg: 'rgba(16,185,129,0.15)', text: '#10b981' },
  CANCELLED:  { bg: 'rgba(239,68,68,0.15)',  text: '#ef4444' },
}

const STATUS_FLOW: OrderStatus[] = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'DELIVERING', 'DELIVERED']
const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PENDING:   ['ACCEPTED', 'CANCELLED'],
  ACCEPTED:  ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY:     ['CANCELLED'],
}

const STATUS_FILTERS = ['ALL', 'PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'DELIVERING', 'DELIVERED', 'CANCELLED']

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AdminDashboardScreen() {
  const navigation = useNavigation<any>()

  // Stats
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  // Orders
  const [orders, setOrders] = useState<Order[]>([])
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // Assign
  const [assignModalOrder, setAssignModalOrder] = useState<Order | null>(null)
  const [deliverers, setDeliverers] = useState<UserDetail[]>([])
  const [loadingDeliverers, setLoadingDeliverers] = useState(false)

  // ─── Load data ───────────────────────────────────────────────────────────────

  const loadAll = useCallback(async (showIndicator = true) => {
    if (showIndicator) { setLoadingStats(true); setLoadingOrders(true) }
    try {
      const [statsData, ordersData] = await Promise.all([getDashboardStats(), getAllOrders()])
      setStats(statsData)
      setOrders(ordersData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
    } catch (err) {
      console.error('Dashboard load error:', err)
    } finally {
      setLoadingStats(false)
      setLoadingOrders(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])
  const onRefresh = () => { setRefreshing(true); loadAll(false) }

  // ─── Order actions ───────────────────────────────────────────────────────────

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
      setAssignModalOrder(null)
      loadAll(false)
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error || "Impossible d'assigner le livreur.")
    }
  }

  const filteredOrders = orders.filter(o => {
    const matchStatus = statusFilter === 'ALL' || o.status === statusFilter
    const q = search.toLowerCase()
    const matchSearch = !q || o.id.toLowerCase().includes(q) || o.items.some(i => i.item.name.toLowerCase().includes(q))
    return matchStatus && matchSearch
  })

  // ─── Helpers for stats rendering ─────────────────────────────────────────────

  const dailyData = stats?.revenue?.daily || []
  const maxRevenue = Math.max(...dailyData.map(d => d.amount), 1)
  const topItems = stats?.topItems || []
  const maxQty = Math.max(...topItems.map(i => i.quantity), 1)

  const renderStars = (rating: number) => (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map(s => (
        <Text key={s} style={{ color: s <= rating ? '#f59e0b' : '#334155', fontSize: 14 }}>★</Text>
      ))}
    </View>
  )

  // ─── Order card ──────────────────────────────────────────────────────────────

  const renderOrder = ({ item }: { item: Order }) => {
    const isExpanded = expandedId === item.id
    const colors = STATUS_COLORS[item.status]
    const nextStatuses = NEXT_STATUS[item.status] || []
    const isUpdating = updatingId === item.id
    const isReady = item.status === 'READY'

    return (
      <View style={styles.orderCard}>
        <TouchableOpacity
          style={styles.orderCardHeader}
          onPress={() => setExpandedId(prev => prev === item.id ? null : item.id)}
          activeOpacity={0.8}
        >
          <View style={styles.orderCardRow}>
            {/* Client avatar */}
            <View style={styles.clientAvatar}>
              <Text style={styles.clientAvatarText}>
                {(item.customer?.name || 'C').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.orderIdRow}>
                <Text style={styles.orderId}>#{item.id.slice(-6).toUpperCase()}</Text>
                <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
                  <Text style={[styles.statusBadgeText, { color: colors.text }]}>{STATUS_LABELS[item.status]}</Text>
                </View>
              </View>
              <Text style={styles.clientName}>{item.customer?.name || '—'}</Text>
              {item.customer?.phone && <Text style={styles.clientPhone}>{item.customer.phone}</Text>}
            </View>
            <View style={styles.orderAmountBox}>
              <Text style={styles.orderAmount}>{item.totalAmount.toFixed(2)} €</Text>
              <Text style={styles.orderDate}>
                {new Date(item.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          </View>

          {/* Items summary */}
          <View style={styles.itemsSummary}>
            {item.items.slice(0, 2).map(oi => (
              <View key={oi.id} style={styles.itemPill}>
                {oi.item.imageUrl ? (
                  <Image source={{ uri: oi.item.imageUrl }} style={styles.itemThumb} />
                ) : (
                  <View style={[styles.itemThumb, { backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{ fontSize: 10 }}>🍽️</Text>
                  </View>
                )}
                <Text style={styles.itemPillName} numberOfLines={1}>{oi.item.name}</Text>
                <Text style={styles.itemPillQty}>×{oi.quantity}</Text>
              </View>
            ))}
            {item.items.length > 2 && (
              <Text style={styles.moreItems}>+{item.items.length - 2} autres</Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Expanded body */}
        {isExpanded && (
          <View style={styles.orderCardBody}>
            {/* All items */}
            <Text style={styles.bodySectionLabel}>Articles</Text>
            {item.items.map(oi => (
              <View key={oi.id} style={styles.itemRow}>
                <Text style={styles.itemRowName}>{oi.quantity}× {oi.item.name}</Text>
                <Text style={styles.itemRowPrice}>{(oi.unitPrice * oi.quantity).toFixed(2)} €</Text>
              </View>
            ))}

            {/* Delivery info */}
            {item.delivery && (
              <View style={{ gap: 6 }}>
                <Text style={styles.bodySectionLabel}>Livraison</Text>
                <Text style={styles.deliveryDetail}>📍 {item.delivery.deliveryAddress}</Text>
                <Text style={styles.deliveryDetail}>
                  💳 {item.delivery.paymentMethod === 'CREDIT_CARD' ? 'Carte bancaire' : item.delivery.paymentMethod === 'PAYPAL' ? 'PayPal' : 'Espèces'}
                </Text>
                {item.delivery.deliverer ? (
                  <Text style={styles.deliveryDetail}>🚴 {item.delivery.deliverer.name}</Text>
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
            <View style={{ gap: 8 }}>
              {nextStatuses.length > 0 && (
                <>
                  <Text style={styles.bodySectionLabel}>Changer le statut</Text>
                  <View style={styles.statusBtns}>
                    {nextStatuses.map(ns => (
                      <TouchableOpacity
                        key={ns}
                        style={[styles.statusBtn, ns === 'CANCELLED' && styles.statusBtnCancel]}
                        onPress={() => handleStatusChange(item, ns)}
                        disabled={isUpdating}
                      >
                        {isUpdating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.statusBtnText}>{STATUS_LABELS[ns]}</Text>}
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {isReady && item.delivery && !item.delivery.delivererId && (
                <TouchableOpacity style={styles.assignBtn} onPress={() => openAssignModal(item)}>
                  <Text style={styles.assignBtnText}>🚴 Assigner un livreur</Text>
                </TouchableOpacity>
              )}

              {item.delivery && (
                <TouchableOpacity
                  style={styles.chatBtn}
                  onPress={() => navigation.navigate('Chat', { orderId: item.id, interlocutorName: 'Client', interlocutorRole: 'CLIENT' })}
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

  // ─── Stats Header ─────────────────────────────────────────────────────────────

  const StatsHeader = () => (
    <View style={styles.statsHeader}>
      {/* Title */}
      <View style={styles.dashTitle}>
        <Text style={styles.dashTitleText}>🖥️ Dashboard Admin</Text>
        <Text style={styles.dashSubTitle}>Commandes en temps réel & performances</Text>
      </View>

      {loadingStats ? (
        <ActivityIndicator color="#f97316" style={{ marginVertical: 20 }} />
      ) : (
        <>
          {/* KPI Row */}
          <View style={styles.kpiRow}>
            {[
              { label: 'Commandes', value: stats?.orders?.total || 0, icon: '📦', color: '#6366f1' },
              { label: 'CA Total', value: `${(stats?.revenue?.total || 0).toFixed(0)}€`, icon: '💳', color: '#f97316' },
              { label: 'En attente', value: stats?.orders?.byStatus?.PENDING || 0, icon: '⏳', color: '#f59e0b' },
              { label: 'Prêtes', value: stats?.orders?.byStatus?.READY || 0, icon: '📦', color: '#22c55e' },
            ].map(k => (
              <View key={k.label} style={[styles.kpiCard, { borderTopColor: k.color }]}>
                <Text style={styles.kpiIcon}>{k.icon}</Text>
                <Text style={styles.kpiVal}>{k.value}</Text>
                <Text style={styles.kpiLabel}>{k.label}</Text>
              </View>
            ))}
          </View>

          {/* Revenue chart */}
          {dailyData.length > 0 && (
            <View style={styles.chartSection}>
              <Text style={styles.sectionTitle}>📈 CA des 7 derniers jours</Text>
              <View style={styles.barsRow}>
                {dailyData.map((d, i) => {
                  const h = Math.max((d.amount / maxRevenue) * 80, 4)
                  const isSelected = selectedDay === i
                  return (
                    <TouchableOpacity key={i} style={styles.barCol} onPress={() => setSelectedDay(isSelected ? null : i)}>
                      {(isSelected || (selectedDay === null && i === dailyData.length - 1)) && (
                        <View style={styles.tooltip}><Text style={styles.tooltipText}>{d.amount.toFixed(0)}€</Text></View>
                      )}
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { height: h, backgroundColor: isSelected ? '#f59e0b' : '#f97316' }]} />
                      </View>
                      <Text style={styles.barLabel}>{d.date.split(' ')[0]}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>
          )}

          {/* Top items */}
          {topItems.length > 0 && (
            <View style={styles.chartSection}>
              <Text style={styles.sectionTitle}>🔥 Top 5 des plats</Text>
              {topItems.slice(0, 5).map((item, idx) => {
                const pct = (item.quantity / maxQty) * 100
                const rankColor = idx === 0 ? '#f59e0b' : idx === 1 ? '#94a3b8' : idx === 2 ? '#b45309' : '#475569'
                return (
                  <View key={item.id} style={styles.topItemRow}>
                    <View style={[styles.rankBadge, { borderColor: rankColor + '60', backgroundColor: rankColor + '20' }]}>
                      <Text style={[styles.rankText, { color: rankColor }]}>{idx + 1}</Text>
                    </View>
                    {item.imageUrl ? (
                      <Image source={{ uri: item.imageUrl }} style={styles.topItemImg} />
                    ) : (
                      <View style={[styles.topItemImg, { backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center' }]}>
                        <Text>🍽️</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <View style={styles.topItemHeader}>
                        <Text style={styles.topItemName} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.topItemQty}>{item.quantity} ventes</Text>
                      </View>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { flex: pct / 100, backgroundColor: idx === 0 ? '#f97316' : idx === 1 ? '#6366f1' : '#10b981' }]} />
                      </View>
                      <Text style={styles.topItemRev}>Revenu : {item.revenue.toFixed(2)} €</Text>
                    </View>
                  </View>
                )
              })}
            </View>
          )}

          {/* Reviews */}
          <View style={styles.chartSection}>
            <Text style={styles.sectionTitle}>⭐ Satisfaction client</Text>
            <View style={styles.ratingRow}>
              <Text style={styles.ratingBig}>{stats?.reviews?.avgRating?.toFixed(1) || '—'}</Text>
              <View>
                {renderStars(Math.round(stats?.reviews?.avgRating || 0))}
                <Text style={styles.ratingCount}>{stats?.reviews?.count || 0} avis</Text>
              </View>
            </View>
          </View>
        </>
      )}

      {/* Orders section header */}
      <View style={styles.ordersSectionHeader}>
        <Text style={styles.sectionTitle}>🧾 Toutes les commandes</Text>
      </View>

      {/* Search */}
      <TextInput
        style={styles.searchInput}
        value={search}
        onChangeText={setSearch}
        placeholder="Rechercher par ID ou plat..."
        placeholderTextColor="#475569"
      />

      {/* Status filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 44 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 4 }}>
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
    </View>
  )

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <TouchableOpacity onPress={() => loadAll(true)}>
          <Text style={styles.refreshIcon}>🔄</Text>
        </TouchableOpacity>
      </View>

      {loadingOrders && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#f97316" />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={o => o.id}
          renderItem={renderOrder}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />}
          ListHeaderComponent={<StatsHeader />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>Aucune commande trouvée</Text>
            </View>
          }
        />
      )}

      {/* Assign modal */}
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
              <ActivityIndicator color="#f97316" style={{ marginVertical: 24 }} />
            ) : deliverers.length === 0 ? (
              <Text style={styles.emptyText}>Aucun livreur disponible.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 300 }}>
                {deliverers.map(d => (
                  <TouchableOpacity key={d.id} style={styles.delivererRow} onPress={() => handleAssign(d.id)}>
                    <View style={styles.delivererAvatar}>
                      <Text style={styles.delivererAvatarText}>{d.name.slice(0, 2).toUpperCase()}</Text>
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0f14' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 20 },
  loadingText: { color: '#94a3b8', fontSize: 14 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  backBtnText: { color: '#f97316', fontWeight: '800', fontSize: 15 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#f1f5f9' },
  refreshIcon: { fontSize: 18 },

  list: { gap: 12, paddingBottom: 32 },

  // Stats header
  statsHeader: { gap: 0 },
  dashTitle: { padding: 16, paddingBottom: 8 },
  dashTitleText: { fontSize: 22, fontWeight: '900', color: '#f1f5f9' },
  dashSubTitle: { fontSize: 13, color: '#64748b', marginTop: 2 },

  kpiRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 16 },
  kpiCard: {
    flex: 1, backgroundColor: '#151821', borderRadius: 12, padding: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderTopWidth: 3, alignItems: 'center', gap: 2,
  },
  kpiIcon: { fontSize: 18 },
  kpiVal: { fontSize: 14, fontWeight: '900', color: '#f1f5f9' },
  kpiLabel: { fontSize: 9, color: '#64748b', fontWeight: '700', textTransform: 'uppercase', textAlign: 'center' },

  chartSection: {
    marginHorizontal: 16, marginBottom: 14, backgroundColor: '#151821', borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', gap: 10,
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#f1f5f9' },

  // Bar chart
  barsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 100 },
  barCol: { alignItems: 'center', width: '12%' },
  tooltip: { position: 'absolute', top: -20, backgroundColor: '#1e293b', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
  tooltipText: { color: '#fff', fontSize: 8, fontWeight: '700' },
  barTrack: { height: 80, width: 12, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', borderRadius: 6 },
  barLabel: { color: '#64748b', fontSize: 8, fontWeight: '600', marginTop: 4 },

  // Top items
  topItemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rankBadge: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  rankText: { fontSize: 11, fontWeight: '900' },
  topItemImg: { width: 38, height: 38, borderRadius: 7 },
  topItemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  topItemName: { flex: 1, color: '#f1f5f9', fontWeight: '700', fontSize: 12 },
  topItemQty: { color: '#f97316', fontWeight: '800', fontSize: 11 },
  progressTrack: { height: 5, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  topItemRev: { color: '#64748b', fontSize: 10, fontWeight: '600', textAlign: 'right', marginTop: 2 },

  // Rating
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  ratingBig: { fontSize: 38, fontWeight: '900', color: '#f59e0b' },
  starRow: { flexDirection: 'row', gap: 2 },
  ratingCount: { color: '#64748b', fontSize: 12, fontWeight: '600', marginTop: 2 },

  // Orders section
  ordersSectionHeader: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  searchInput: {
    backgroundColor: '#151821', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 16, paddingVertical: 11, fontSize: 14, color: '#f1f5f9', marginHorizontal: 16, marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#151821', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  filterChipActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  filterChipText: { color: '#94a3b8', fontSize: 11, fontWeight: '700' },
  filterChipTextActive: { color: '#fff' },

  // Order cards
  orderCard: {
    backgroundColor: '#151821', borderRadius: 16, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)', overflow: 'hidden', marginHorizontal: 16,
  },
  orderCardHeader: { padding: 14 },
  orderCardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  clientAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1d4ed8',
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  clientAvatarText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  orderIdRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  orderId: { color: '#f1f5f9', fontSize: 13, fontWeight: '800' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusBadgeText: { fontSize: 10, fontWeight: '800' },
  clientName: { color: '#f1f5f9', fontSize: 13, fontWeight: '600' },
  clientPhone: { color: '#64748b', fontSize: 11 },
  orderAmountBox: { alignItems: 'flex-end' },
  orderAmount: { color: '#f97316', fontSize: 16, fontWeight: '900' },
  orderDate: { color: '#64748b', fontSize: 10 },

  itemsSummary: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  itemPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  itemThumb: { width: 22, height: 22, borderRadius: 4 },
  itemPillName: { color: '#94a3b8', fontSize: 11, fontWeight: '600', maxWidth: 80 },
  itemPillQty: { color: '#f97316', fontSize: 11, fontWeight: '700' },
  moreItems: { color: '#64748b', fontSize: 11, alignSelf: 'center' },

  orderCardBody: {
    padding: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(0,0,0,0.2)', gap: 12,
  },
  bodySectionLabel: { color: '#94a3b8', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  itemRowName: { color: '#f1f5f9', fontSize: 12, flex: 1 },
  itemRowPrice: { color: '#f97316', fontSize: 12, fontWeight: '700' },
  deliveryDetail: { color: '#f1f5f9', fontSize: 12 },
  noteBox: { backgroundColor: 'rgba(249,115,22,0.08)', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: 'rgba(249,115,22,0.2)' },
  noteLabel: { color: '#f97316', fontSize: 10, fontWeight: '700', marginBottom: 4 },
  noteText: { color: '#f1f5f9', fontSize: 12 },

  statusBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusBtn: { backgroundColor: '#f97316', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, alignItems: 'center', flex: 1, minWidth: 100 },
  statusBtnCancel: { backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)' },
  statusBtnText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  assignBtn: { backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  assignBtnText: { color: '#22c55e', fontWeight: '800', fontSize: 13 },
  chatBtn: { backgroundColor: '#1e293b', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  chatBtnText: { color: '#f1f5f9', fontWeight: '800', fontSize: 13 },

  // Empty
  emptyBox: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyText: { color: '#64748b', fontSize: 15, textAlign: 'center' },

  // Assign modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#151821', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '55%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { color: '#f1f5f9', fontSize: 18, fontWeight: '900' },
  closeBtn: { color: '#64748b', fontSize: 20 },
  delivererRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  delivererAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(249,115,22,0.15)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)', justifyContent: 'center', alignItems: 'center' },
  delivererAvatarText: { color: '#f97316', fontWeight: '900', fontSize: 14 },
  delivererName: { color: '#f1f5f9', fontSize: 14, fontWeight: '700' },
  delivererPhone: { color: '#64748b', fontSize: 12 },
  onlineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#22c55e' },
})
