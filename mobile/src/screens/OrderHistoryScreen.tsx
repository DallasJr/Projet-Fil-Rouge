import React, { useState, useEffect, useCallback } from 'react'
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, ScrollView,
  Modal, Image, Alert, Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { getMyOrders, confirmDelivery, updateOrderStatus, Order, OrderStatus } from '../api/orders'
import { submitReview } from '../api/reviews'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { io } from 'socket.io-client'
import { API_BASE_URL } from '../api/client'

const SOCKET_URL = API_BASE_URL.replace('/api', '')

// ─── Status config ────────────────────────────────────────────────────────────
type StatusInfo = { label: string; emoji: string; bg: string; text: string }
const STATUS_CONFIG: Record<OrderStatus, StatusInfo> = {
  PENDING:    { label: 'En attente',     emoji: '⏳', bg: 'rgba(234,179,8,0.15)',   text: '#eab308' },
  ACCEPTED:   { label: 'Acceptée',       emoji: '✅', bg: 'rgba(59,130,246,0.15)',  text: '#3b82f6' },
  PREPARING:  { label: 'En préparation', emoji: '👨‍🍳', bg: 'rgba(168,85,247,0.15)', text: '#a855f7' },
  READY:      { label: 'Prête',          emoji: '📦', bg: 'rgba(34,197,94,0.15)',   text: '#22c55e' },
  DELIVERING: { label: 'En livraison',   emoji: '🚴', bg: 'rgba(249,115,22,0.15)',  text: '#f97316' },
  DELIVERED:  { label: 'Livrée',         emoji: '🏁', bg: 'rgba(16,185,129,0.15)',  text: '#10b981' },
  CANCELLED:  { label: 'Annulée',        emoji: '❌', bg: 'rgba(239,68,68,0.15)',   text: '#ef4444' },
}
const TIMELINE_STEPS: OrderStatus[] = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'DELIVERING', 'DELIVERED']

// ─── Helpers ──────────────────────────────────────────────────────────────────
const parseDescription = (raw: string | null | undefined): { calories?: number; prepTime?: number } => {
  if (!raw) return {}
  if (raw.trim().startsWith('{')) {
    try { return JSON.parse(raw) } catch { /* */ }
  }
  return {}
}

// Compte à rebours pour annulation client (2 min max)
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
    <TouchableOpacity
      style={[styles.actionBtn, styles.actionBtnRed]}
      onPress={onCancel}
      disabled={isDisabled}
    >
      <Text style={[styles.actionBtnText, { color: '#ef4444' }]}>❌ Annuler ({timeLeft}s)</Text>
    </TouchableOpacity>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function OrderHistoryScreen() {
  const navigation = useNavigation<any>()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderStatus>('ALL')
  const [showFilters, setShowFilters] = useState(false)

  // Review modal
  const [reviewOrderId, setReviewOrderId] = useState<string | null>(null)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)

  // Report modal
  const [reportOrderId, setReportOrderId] = useState<string | null>(null)
  const [reportReason, setReportReason] = useState('MISSING_ITEM')
  const [reportComment, setReportComment] = useState('')
  const [submittingReport, setSubmittingReport] = useState(false)

  // Cancellation & Invoice
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const handleCancelOrder = async (orderId: string) => {
    Alert.alert(
      'Annuler la commande',
      'Voulez-vous vraiment annuler cette commande ?',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            setCancellingId(orderId)
            try {
              await updateOrderStatus(orderId, 'CANCELLED')
              Alert.alert('Succès', 'Commande annulée avec succès.')
              fetchOrders(false)
            } catch (err: any) {
              const errMsg = err.response?.data?.error || "Erreur lors de l'annulation"
              Alert.alert('Erreur', errMsg)
            } finally {
              setCancellingId(null)
            }
          }
        }
      ]
    )
  }

  const handleDownloadInvoice = async (orderId: string) => {
    try {
      const token = await AsyncStorage.getItem('token')
      if (!token) {
        Alert.alert('Erreur', 'Vous devez être connecté.')
        return
      }
      const url = `${SOCKET_URL}/api/orders/${orderId}/invoice?token=${token}`
      const supported = await Linking.canOpenURL(url)
      if (supported) {
        await Linking.openURL(url)
      } else {
        Alert.alert('Erreur', "Impossible d'ouvrir la facture.")
      }
    } catch (err) {
      console.error('Error opening invoice:', err)
      Alert.alert('Erreur', 'Impossible de charger la facture.')
    }
  }

  const fetchOrders = useCallback(async (showIndicator = true) => {
    if (showIndicator) setLoading(true)
    try {
      const data = await getMyOrders()
      setOrders(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
    } catch (err) {
      console.error('Error fetching orders:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const onRefresh = () => { setRefreshing(true); fetchOrders(false) }

  // ─── Stats ────────────────────────────────────────────────────────────────
  const totalOrders = orders.length
  const totalSpent = orders.filter(o => o.status === 'DELIVERED').reduce((s, o) => s + o.totalAmount, 0)
  const activeCount = orders.filter(o => !['DELIVERED', 'CANCELLED'].includes(o.status)).length
  const itemCounts: Record<string, { name: string; count: number }> = {}
  orders.forEach(o => o.items.forEach(i => {
    if (!itemCounts[i.itemId]) itemCounts[i.itemId] = { name: i.item.name, count: 0 }
    itemCounts[i.itemId].count += i.quantity
  }))
  const favDish = Object.values(itemCounts).sort((a, b) => b.count - a.count)[0]?.name || '—'

  const filteredOrders = orders.filter(o => {
    const ms = statusFilter === 'ALL' || o.status === statusFilter
    const q = search.toLowerCase()
    const mq = !q || o.id.toLowerCase().includes(q) || o.items.some(i => i.item.name.toLowerCase().includes(q))
    return ms && mq
  })

  // ─── Reorder ──────────────────────────────────────────────────────────────
  const handleReorder = async (order: Order) => {
    try {
      const cartItems = order.items.map(oi => ({
        ...oi.item, price: oi.unitPrice, quantity: oi.quantity, note: oi.note || undefined,
      }))
      await AsyncStorage.setItem('cart', JSON.stringify(cartItems))
      Alert.alert('Panier mis à jour', 'Les articles ont été ajoutés à votre panier.')
      navigation.navigate('Menu')
    } catch { Alert.alert('Erreur', 'Impossible de recommander.') }
  }

  // ─── Review ───────────────────────────────────────────────────────────────
  const handleSubmitReview = async () => {
    if (!reviewOrderId) return
    setSubmittingReview(true)
    try {
      await submitReview(reviewOrderId, rating, comment)
      Alert.alert('Merci !', 'Votre avis a été soumis.')
      setReviewOrderId(null)
      fetchOrders(false)
    } catch { Alert.alert('Erreur', 'Impossible de soumettre l\'avis.') }
    finally { setSubmittingReview(false) }
  }

  // ─── Report ───────────────────────────────────────────────────────────────
  const handleSubmitReport = async () => {
    if (!reportOrderId) return
    setSubmittingReport(true)
    const labels: Record<string, string> = {
      MISSING_ITEM: 'Plat manquant / incorrect', LATE_DELIVERY: 'Retard de livraison',
      POOR_QUALITY: 'Problème de qualité', OTHER: 'Autre problème',
    }
    const msg = `⚠️ [SIGNALEMENT SUPPORT]\nType : ${labels[reportReason]}\nCommentaire : ${reportComment || 'Aucun détail'}`
    try {
      const token = await AsyncStorage.getItem('token')
      const socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket'] })
      socket.on('connect', () => {
        socket.emit('join_order', reportOrderId)
        socket.emit('send_message', { orderId: reportOrderId, content: msg })
        setTimeout(() => {
          socket.disconnect()
          setSubmittingReport(false)
          setReportOrderId(null)
          Alert.alert('Signalement envoyé', 'Votre signalement a été transmis au support via le chat.')
        }, 1000)
      })
      socket.on('connect_error', () => {
        socket.disconnect()
        setSubmittingReport(false)
        Alert.alert('Erreur', 'Impossible de se connecter au serveur de chat.')
      })
    } catch {
      setSubmittingReport(false)
      Alert.alert('Erreur', 'Impossible de transmettre le signalement.')
    }
  }

  // ─── Render order card ────────────────────────────────────────────────────
  const renderOrder = ({ item }: { item: Order }) => {
    const isExpanded = expandedId === item.id
    const statusInfo = STATUS_CONFIG[item.status]
    const currentStep = TIMELINE_STEPS.indexOf(item.status)
    const isCancelled = item.status === 'CANCELLED'
    const review = (item as any).reviews?.[0] || null

    const showConfirm = item.delivery?.status === 'DELIVERED' && !item.delivery?.confirmedByCustomer
    const showTrack = item.delivery && !['DELIVERED', 'CANCELLED'].includes(item.status)

    const formattedDate = new Date(item.createdAt).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })

    return (
      <View style={styles.card}>
        {/* Card header — always visible */}
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.cardHeader}
          onPress={() => setExpandedId(prev => prev === item.id ? null : item.id)}
        >
          <View style={styles.cardTopRow}>
            <Text style={styles.orderId}>
              Commande <Text style={styles.orderIdSpan}>#{item.id.slice(-6).toUpperCase()}</Text>
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
              <Text style={[styles.statusBadgeText, { color: statusInfo.text }]}>
                {statusInfo.emoji} {statusInfo.label}
              </Text>
            </View>
          </View>

          {/* Progress timeline */}
          {!isCancelled && (
            <View style={styles.timeline}>
              {TIMELINE_STEPS.map((step, idx) => {
                const done = idx <= currentStep
                const current = idx === currentStep
                return (
                  <View key={step} style={styles.timelineStep}>
                    <View style={[styles.timelineDot, done && styles.timelineDotDone, current && styles.timelineDotCurrent]} />
                    {idx < TIMELINE_STEPS.length - 1 && (
                      <View style={[styles.timelineLine, idx < currentStep && styles.timelineLineDone]} />
                    )}
                    <Text style={[styles.timelineLabel, done && styles.timelineLabelDone]} numberOfLines={1}>
                      {STATUS_CONFIG[step].emoji}
                    </Text>
                  </View>
                )
              })}
            </View>
          )}

          <View style={styles.cardFooterRow}>
            <Text style={styles.orderDate}>{formattedDate}</Text>
            <Text style={styles.orderTotal}>{item.totalAmount.toFixed(2)} €</Text>
          </View>
        </TouchableOpacity>

        {/* Expanded body */}
        {isExpanded && (
          <View style={styles.cardBody}>
            {/* Articles */}
            <Text style={styles.sectionLabel}>Articles commandés</Text>
            {item.items.map(oi => {
              const rich = parseDescription((oi.item as any).description)
              return (
                <View key={oi.id} style={styles.articleRow}>
                  {(oi.item as any).imageUrl ? (
                    <Image source={{ uri: (oi.item as any).imageUrl }} style={styles.articleImg} />
                  ) : (
                    <View style={[styles.articleImg, styles.articleImgPlaceholder]}>
                      <Text style={{ fontSize: 18 }}>🍽️</Text>
                    </View>
                  )}
                  <View style={styles.articleInfo}>
                    <View style={styles.articleTopRow}>
                      <Text style={styles.articleName} numberOfLines={1}>{oi.item.name}</Text>
                      <View style={styles.qtyBadge}>
                        <Text style={styles.qtyBadgeText}>×{oi.quantity}</Text>
                      </View>
                    </View>
                    <View style={styles.articlePriceRow}>
                      <Text style={styles.articleTotal}>{(oi.unitPrice * oi.quantity).toFixed(2)} €</Text>
                      <Text style={styles.articleUnit}>{oi.unitPrice.toFixed(2)} € / u</Text>
                    </View>
                    {(rich.calories || rich.prepTime) ? (
                      <View style={styles.articleMeta}>
                        {rich.calories ? <Text style={styles.articleMetaText}>🔥 {rich.calories} kcal</Text> : null}
                        {rich.prepTime ? <Text style={styles.articleMetaText}>⏱️ {rich.prepTime} min</Text> : null}
                      </View>
                    ) : null}
                    {oi.note ? <Text style={styles.articleNote}>📝 {oi.note}</Text> : null}
                  </View>
                </View>
              )
            })}

            {/* Delivery */}
            {item.delivery && (
              <View style={styles.deliveryBox}>
                <Text style={styles.sectionLabel}>Livraison</Text>
                <Text style={styles.deliveryLine}>📍 {item.delivery.deliveryAddress}</Text>
                {item.delivery.deliverer && (
                  <Text style={styles.deliveryDeliverer}>
                    🚴 {item.delivery.deliverer.name}
                    {item.delivery.deliverer.phone ? ` · ${item.delivery.deliverer.phone}` : ''}
                  </Text>
                )}
                {item.delivery.confirmedByDeliverer && !item.delivery.confirmedByCustomer && (
                  <Text style={styles.deliveryNote}>✓ Le livreur confirme le dépôt</Text>
                )}
              </View>
            )}

            {/* Order note */}
            {item.note && (
              <View style={styles.noteBox}>
                <Text style={styles.noteLabel}>Note de commande</Text>
                <Text style={styles.noteText}>{item.note}</Text>
              </View>
            )}

            {/* Existing review */}
            {review && (
              <View style={styles.reviewBox}>
                <Text style={styles.reviewTitle}>
                  {'⭐'.repeat(review.rating)} {review.rating} / 5
                </Text>
                {review.comment && <Text style={styles.reviewComment}>"{review.comment}"</Text>}
              </View>
            )}

            {/* Actions */}
            <View style={styles.actionsGrid}>
              {showTrack && (
                <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('OrderTracking', { orderId: item.id })}>
                  <Text style={styles.actionBtnText}>📍 Suivre</Text>
                </TouchableOpacity>
              )}
              {showConfirm && (
                <TouchableOpacity style={[styles.actionBtn, styles.actionBtnGreen]}
                  onPress={async () => { try { await confirmDelivery(item.id); fetchOrders(false) } catch { Alert.alert('Erreur', 'Impossible de confirmer.') } }}>
                  <Text style={[styles.actionBtnText, { color: '#22c55e' }]}>✅ Confirmer</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDark]}
                onPress={() => navigation.navigate('Chat', {
                  orderId: item.id,
                  interlocutorName: item.delivery?.deliverer?.name || 'Support / Restaurant',
                  interlocutorRole: item.delivery?.deliverer ? 'DELIVERER' : 'ADMIN',
                })}>
                <Text style={styles.actionBtnText}>
                  💬 {['DELIVERED', 'CANCELLED'].includes(item.status) ? 'Historique Chat' : 'Chat Live'}
                </Text>
              </TouchableOpacity>
              {item.status === 'PENDING' && (
                <CancelTimerButton
                  createdAt={item.createdAt}
                  onCancel={() => handleCancelOrder(item.id)}
                  isDisabled={cancellingId === item.id}
                />
              )}
              {item.status === 'DELIVERED' && (
                <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDark]}
                  onPress={() => handleDownloadInvoice(item.id)}>
                  <Text style={[styles.actionBtnText, { color: '#10b981' }]}>📄 Facture PDF</Text>
                </TouchableOpacity>
              )}
              {item.status === 'DELIVERED' && !review && (
                <TouchableOpacity style={[styles.actionBtn, styles.actionBtnAmber]}
                  onPress={() => { setReviewOrderId(item.id); setRating(5); setComment('') }}>
                  <Text style={[styles.actionBtnText, { color: '#f59e0b' }]}>⭐ Noter</Text>
                </TouchableOpacity>
              )}
              {item.status !== 'CANCELLED' && (
                <TouchableOpacity style={[styles.actionBtn, styles.actionBtnRed]}
                  onPress={() => { setReportOrderId(item.id); setReportReason('MISSING_ITEM'); setReportComment('') }}>
                  <Text style={[styles.actionBtnText, { color: '#ef4444' }]}>⚠️ Signaler</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOrange]}
                onPress={() => handleReorder(item)}>
                <Text style={[styles.actionBtnText, { color: '#f97316' }]}>🔄 Recommander</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    )
  }

  // ─── Main render ──────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mes Commandes</Text>
        <Text style={styles.headerSub}>Suivez vos commandes en temps réel</Text>
      </View>

      {/* Stats row */}
      {orders.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={styles.statsRow}
          contentContainerStyle={{ gap: 10, paddingHorizontal: 16, paddingBottom: 4 }}>
          <View style={[styles.statCard, { borderColor: 'rgba(99,102,241,0.3)', shadowColor: '#6366f1' }]}>
            <Text style={styles.statIcon}>📋</Text>
            <Text style={[styles.statValue, { color: '#818cf8' }]}>{totalOrders}</Text>
            <Text style={styles.statLabel}>Commandes</Text>
          </View>
          <View style={[styles.statCard, { borderColor: 'rgba(245,158,11,0.3)', shadowColor: '#f59e0b' }]}>
            <Text style={styles.statIcon}>🍔</Text>
            <Text style={[styles.statValue, { color: '#fbbf24', fontSize: 12 }]} numberOfLines={1}>{favDish}</Text>
            <Text style={styles.statLabel}>Plat préféré</Text>
          </View>
          <View style={[styles.statCard, { borderColor: 'rgba(16,185,129,0.3)', shadowColor: '#10b981' }]}>
            <Text style={styles.statIcon}>💶</Text>
            <Text style={[styles.statValue, { color: '#34d399' }]}>{totalSpent.toFixed(0)} €</Text>
            <Text style={styles.statLabel}>Total dépensé</Text>
          </View>
          <View style={[styles.statCard, { borderColor: 'rgba(14,165,233,0.3)', shadowColor: '#0ea5e9' }]}>
            <Text style={styles.statIcon}>⏳</Text>
            <Text style={[styles.statValue, { color: '#38bdf8' }]}>{activeCount}</Text>
            <Text style={styles.statLabel}>En cours</Text>
          </View>
        </ScrollView>
      )}

      {/* ── Collapsible filter panel ── */}
      <View style={styles.filterPanel}>
        <TouchableOpacity
          style={styles.filterPanelHeader}
          onPress={() => setShowFilters(v => !v)}
          activeOpacity={0.7}
        >
          <Text style={styles.filterPanelTitle}>
            🔍 Filtres & Recherche {search.trim() !== '' ? '(1)' : ''}
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
                placeholder="Rechercher par ID ou plat..."
                placeholderTextColor="#64748b"
              />
            </View>
            <TouchableOpacity 
              style={styles.resetFiltersBtn}
              onPress={() => setSearch('')}
            >
              <Text style={styles.resetFiltersBtnText}>Réinitialiser</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Status filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={styles.filtersRow}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
        {(['ALL', ...Object.keys(STATUS_CONFIG)] as ('ALL' | OrderStatus)[]).map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.filterChip, statusFilter === s && styles.filterChipActive]}
            onPress={() => setStatusFilter(s)}>
            <Text style={[styles.filterChipText, statusFilter === s && styles.filterChipTextActive]}>
              {s === 'ALL' ? '📋 Tout' : `${STATUS_CONFIG[s as OrderStatus].emoji} ${STATUS_CONFIG[s as OrderStatus].label}`}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#f97316" />
        </View>
      ) : filteredOrders.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>{orders.length === 0 ? '🛍️' : '🔍'}</Text>
          <Text style={styles.emptyTitle}>{orders.length === 0 ? 'Aucune commande' : 'Aucun résultat'}</Text>
          <Text style={styles.emptyText}>{orders.length === 0 ? 'Passez votre première commande !' : 'Ajustez vos filtres.'}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={i => i.id}
          renderItem={renderOrder}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />}
        />
      )}

      {/* ── Review modal ── */}
      <Modal visible={!!reviewOrderId} animationType="slide" transparent onRequestClose={() => setReviewOrderId(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>⭐ Noter la commande</Text>
              <TouchableOpacity onPress={() => setReviewOrderId(null)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>Attribuez une note de 1 à 5 étoiles :</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map(s => (
                <TouchableOpacity key={s} onPress={() => setRating(s)}>
                  <Text style={[styles.star, rating >= s && styles.starActive]}>★</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.modalTextArea}
              value={comment}
              onChangeText={setComment}
              placeholder="Commentaire optionnel..."
              placeholderTextColor="#475569"
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setReviewOrderId(null)}>
                <Text style={styles.modalBtnCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSubmit]} onPress={handleSubmitReview} disabled={submittingReview}>
                {submittingReview ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalBtnSubmitText}>Envoyer</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Report modal ── */}
      <Modal visible={!!reportOrderId} animationType="slide" transparent onRequestClose={() => setReportOrderId(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>⚠️ Signaler un problème</Text>
              <TouchableOpacity onPress={() => setReportOrderId(null)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>Sélectionnez le type de problème :</Text>
            <View style={styles.reasonsGrid}>
              {[
                { value: 'MISSING_ITEM', label: 'Plat manquant' },
                { value: 'LATE_DELIVERY', label: 'Retard' },
                { value: 'POOR_QUALITY', label: 'Mauvaise qualité' },
                { value: 'OTHER', label: 'Autre' },
              ].map(r => (
                <TouchableOpacity
                  key={r.value}
                  style={[styles.reasonChip, reportReason === r.value && styles.reasonChipActive]}
                  onPress={() => setReportReason(r.value)}>
                  <Text style={[styles.reasonChipText, reportReason === r.value && styles.reasonChipTextActive]}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.modalTextArea}
              value={reportComment}
              onChangeText={setReportComment}
              placeholder="Expliquez le problème..."
              placeholderTextColor="#475569"
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setReportOrderId(null)}>
                <Text style={styles.modalBtnCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSubmit]} onPress={handleSubmitReport} disabled={submittingReport}>
                {submittingReport ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalBtnSubmitText}>Envoyer</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0f14' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  emptyIcon: { fontSize: 56 },
  emptyTitle: { color: '#f1f5f9', fontSize: 18, fontWeight: '800' },
  emptyText: { color: '#64748b', fontSize: 14, textAlign: 'center' },

  // Header
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  headerTitle: { color: '#f1f5f9', fontSize: 26, fontWeight: '900' },
  headerSub: { color: '#64748b', fontSize: 13, marginTop: 2 },

  // Stats
  statsRow: { maxHeight: 100, marginBottom: 4 },
  statCard: {
    backgroundColor: '#151821', borderRadius: 14, padding: 12, width: 110,
    alignItems: 'center', gap: 4, borderWidth: 1,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
  statIcon: { fontSize: 18 },
  statValue: { fontSize: 16, fontWeight: '900' },
  statLabel: { color: '#64748b', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'center' },

  // Search & Filter
  searchRow: { paddingHorizontal: 16, paddingVertical: 8 },
  searchInput: {
    backgroundColor: '#151821', borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)', paddingHorizontal: 16,
    paddingVertical: 11, fontSize: 14, color: '#f1f5f9',
  },
  filtersRow: { maxHeight: 46, marginBottom: 8 },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#151821', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  filterChipActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  filterChipText: { color: '#94a3b8', fontSize: 12, fontWeight: '700' },
  filterChipTextActive: { color: '#fff' },

  list: { padding: 16, gap: 14, paddingBottom: 32 },

  // Card
  card: {
    backgroundColor: '#151821', borderRadius: 16, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)', overflow: 'hidden',
  },
  cardHeader: { padding: 16 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  orderId: { color: '#94a3b8', fontSize: 13 },
  orderIdSpan: { color: '#f1f5f9', fontWeight: '900', fontSize: 15 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusBadgeText: { fontSize: 11, fontWeight: '800' },
  cardFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  orderDate: { color: '#64748b', fontSize: 12 },
  orderTotal: { color: '#f97316', fontSize: 18, fontWeight: '900' },

  // Timeline
  timeline: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  timelineStep: { flex: 1, alignItems: 'center' },
  timelineDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#1e293b', borderWidth: 2, borderColor: '#334155',
    marginBottom: 4,
  },
  timelineDotDone: { backgroundColor: '#f97316', borderColor: '#f97316' },
  timelineDotCurrent: {
    width: 13, height: 13, borderRadius: 7,
    backgroundColor: '#f97316', borderColor: '#fed7aa', borderWidth: 2,
    shadowColor: '#f97316', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 6, elevation: 4,
  },
  timelineLine: {
    position: 'absolute', top: 5, left: '50%', right: '-50%', height: 2,
    backgroundColor: '#1e293b',
  },
  timelineLineDone: { backgroundColor: '#f97316' },
  timelineLabel: { color: '#475569', fontSize: 11 },
  timelineLabelDone: { color: '#f97316' },

  // Card body (expanded)
  cardBody: {
    padding: 16, borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(0,0,0,0.18)', gap: 14,
  },
  sectionLabel: {
    color: '#64748b', fontSize: 10, fontWeight: '800',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: -6,
  },

  // Article row
  articleRow: {
    flexDirection: 'row', gap: 12, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  articleImg: { width: 48, height: 48, borderRadius: 8, resizeMode: 'cover' },
  articleImgPlaceholder: { backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center' },
  articleInfo: { flex: 1, gap: 3 },
  articleTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  articleName: { color: '#f1f5f9', fontSize: 13, fontWeight: '700', flex: 1, marginRight: 8 },
  qtyBadge: {
    backgroundColor: 'rgba(249,115,22,0.15)', borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  qtyBadgeText: { color: '#f97316', fontSize: 11, fontWeight: '800' },
  articlePriceRow: { flexDirection: 'row', justifyContent: 'space-between' },
  articleTotal: { color: '#f97316', fontSize: 13, fontWeight: '700' },
  articleUnit: { color: '#64748b', fontSize: 11 },
  articleMeta: { flexDirection: 'row', gap: 10 },
  articleMetaText: { color: '#64748b', fontSize: 10 },
  articleNote: { color: '#94a3b8', fontSize: 11, fontStyle: 'italic' },

  // Delivery
  deliveryBox: { gap: 6 },
  deliveryLine: { color: '#f1f5f9', fontSize: 13 },
  deliveryDeliverer: { color: '#22c55e', fontSize: 13, fontWeight: '600' },
  deliveryNote: { color: '#94a3b8', fontSize: 12 },

  // Note
  noteBox: {
    backgroundColor: 'rgba(249,115,22,0.08)', borderRadius: 10,
    padding: 10, borderWidth: 1, borderColor: 'rgba(249,115,22,0.2)',
  },
  noteLabel: { color: '#f97316', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginBottom: 4 },
  noteText: { color: '#f1f5f9', fontSize: 13 },

  // Review
  reviewBox: {
    backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: 10,
    padding: 10, borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)', gap: 4,
  },
  reviewTitle: { color: '#f59e0b', fontSize: 13, fontWeight: '700' },
  reviewComment: { color: '#f1f5f9', fontSize: 13, fontStyle: 'italic' },

  // Actions grid
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: {
    backgroundColor: '#1e293b', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14, alignItems: 'center',
  },
  actionBtnGreen: { borderColor: 'rgba(34,197,94,0.3)', backgroundColor: 'rgba(34,197,94,0.08)' },
  actionBtnAmber: { borderColor: 'rgba(245,158,11,0.3)', backgroundColor: 'rgba(245,158,11,0.08)' },
  actionBtnRed: { borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.08)' },
  actionBtnOrange: { borderColor: 'rgba(249,115,22,0.4)', backgroundColor: 'rgba(249,115,22,0.08)' },
  actionBtnDark: { borderColor: 'rgba(255,255,255,0.1)', backgroundColor: '#1e293b' },
  actionBtnText: { color: '#f1f5f9', fontSize: 12, fontWeight: '800' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: {
    backgroundColor: '#151821', borderRadius: 20, padding: 24,
    width: '100%', maxWidth: 380, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 14,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { color: '#f1f5f9', fontSize: 17, fontWeight: '900' },
  closeBtn: { color: '#64748b', fontSize: 20, fontWeight: '800' },
  modalSub: { color: '#94a3b8', fontSize: 13 },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  star: { fontSize: 36, color: '#334155' },
  starActive: { color: '#f59e0b' },
  modalTextArea: {
    backgroundColor: '#0d0f14', borderRadius: 10, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)', padding: 12, color: '#f1f5f9',
    fontSize: 14, minHeight: 80, textAlignVertical: 'top',
  },
  modalBtns: { flexDirection: 'row', gap: 10 },
  modalBtn: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  modalBtnCancel: { backgroundColor: '#1e293b', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  modalBtnCancelText: { color: '#94a3b8', fontWeight: '700' },
  modalBtnSubmit: { backgroundColor: '#f97316' },
  modalBtnSubmitText: { color: '#fff', fontWeight: '800' },
  reasonsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reasonChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
    backgroundColor: '#1e293b', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  reasonChipActive: { borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,0.12)' },
  reasonChipText: { color: '#94a3b8', fontSize: 12, fontWeight: '700' },
  reasonChipTextActive: { color: '#f97316' },
  filterPanel: {
    backgroundColor: '#151821',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    marginBottom: 8,
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
