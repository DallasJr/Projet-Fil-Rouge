import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, TextInput, ActivityIndicator, SafeAreaView, ScrollView, Modal,
  Animated, Alert,
} from 'react-native'
import { getCategories, getItems } from '../api/menu'
import { getRestaurants } from '../api/menu'
import type { Item, Category } from '../api/menu'
import { createOrder } from '../api/orders'
import { useAuth } from '../contexts/AuthContext'

interface CartItem extends Item {
  quantity: number
  note?: string
}

const RESTAURANT_CACHE_KEY = 'restau_id'

export default function MenuScreen() {
  const { isDeliverer, isAdmin } = useAuth()
  const canOrder = !isDeliverer && !isAdmin

  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [restaurantId, setRestaurantId] = useState<string>('')

  // Cart
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartVisible, setCartVisible] = useState(false)
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [isOrdering, setIsOrdering] = useState(false)
  const [orderSuccess, setOrderSuccess] = useState(false)
  const [withDelivery, setWithDelivery] = useState(false)
  const [deliveryAddress, setDeliveryAddress] = useState('')

  const cartBadgeAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      const [cats, its, restaurants] = await Promise.all([
        getCategories(),
        getItems(),
        getRestaurants(),
      ])
      setCategories(cats)
      setItems(its.filter(i => i.isAvailable))
      if (restaurants.length > 0) setRestaurantId(restaurants[0].id)
    } catch (err) {
      console.error('Failed to load menu:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredItems = items.filter(item => {
    const matchCat = selectedCategory === 'all' || item.categoryId === selectedCategory
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const addToCart = (item: Item) => {
    Animated.sequence([
      Animated.timing(cartBadgeAnim, { toValue: 1.4, duration: 120, useNativeDriver: true }),
      Animated.timing(cartBadgeAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start()

    setCart(prev => {
      const existing = prev.find(c => c.id === item.id)
      if (existing) return prev.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
      return [...prev, { ...item, quantity: 1 }]
    })
  }

  const removeFromCart = (id: string) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === id)
      if (existing && existing.quantity > 1) return prev.map(c => c.id === id ? { ...c, quantity: c.quantity - 1 } : c)
      return prev.filter(c => c.id !== id)
    })
  }

  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)

  const handleOrder = async () => {
    if (!restaurantId) { Alert.alert('Erreur', 'Aucun restaurant disponible.'); return }
    if (withDelivery && !deliveryAddress.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir une adresse de livraison.')
      return
    }
    setIsOrdering(true)
    try {
      await createOrder({
        restaurantId,
        items: cart.map(i => ({ itemId: i.id, quantity: i.quantity, note: i.note })),
        deliveryAddress: withDelivery ? deliveryAddress : undefined,
        paymentMethod: withDelivery ? 'CREDIT_CARD' : undefined,
      })
      setCart([])
      setDeliveryAddress('')
      setOrderSuccess(true)
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error || 'Impossible de passer la commande.')
    } finally {
      setIsOrdering(false)
    }
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Chargement du menu...</Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>🍽️ Menu</Text>
          <Text style={styles.headerSub}>Découvrez nos créations</Text>
        </View>
        {canOrder && (
          <TouchableOpacity style={styles.cartBtn} onPress={() => setCartVisible(true)}>
            <Text style={styles.cartIcon}>🛒</Text>
            {cartCount > 0 && (
              <Animated.View style={[styles.cartBadge, { transform: [{ scale: cartBadgeAnim }] }]}>
                <Text style={styles.cartBadgeText}>{cartCount}</Text>
              </Animated.View>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher un plat..."
          placeholderTextColor="#475569"
        />
      </View>

      {/* Categories */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catsRow} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
        <TouchableOpacity
          style={[styles.catChip, selectedCategory === 'all' && styles.catChipActive]}
          onPress={() => setSelectedCategory('all')}
        >
          <Text style={[styles.catChipText, selectedCategory === 'all' && styles.catChipTextActive]}>
            Tout
          </Text>
        </TouchableOpacity>
        {categories.map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.catChip, selectedCategory === cat.id && styles.catChipActive]}
            onPress={() => setSelectedCategory(cat.id)}
          >
            <Text style={[styles.catChipText, selectedCategory === cat.id && styles.catChipTextActive]}>
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Items grid */}
      <FlatList
        data={filteredItems}
        keyExtractor={i => i.id}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={{ gap: 12 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🍳</Text>
            <Text style={styles.emptyText}>Aucun plat trouvé</Text>
          </View>
        }
        renderItem={({ item }) => {
          const inCart = cart.find(c => c.id === item.id)
          return (
            <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => setSelectedItem(item)}>
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.cardImg} />
              ) : (
                <View style={[styles.cardImg, styles.cardImgPlaceholder]}>
                  <Text style={{ fontSize: 36 }}>🍔</Text>
                </View>
              )}
              <View style={styles.cardBody}>
                <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
                <View style={styles.cardFooter}>
                  <Text style={styles.cardPrice}>{item.price.toFixed(2)} €</Text>
                  {canOrder && (
                    <TouchableOpacity
                      style={[styles.addBtn, inCart && styles.addBtnActive]}
                      onPress={() => addToCart(item)}
                    >
                      <Text style={styles.addBtnText}>{inCart ? `+1 (${inCart.quantity})` : '+'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )
        }}
      />

      {/* Cart Modal */}
      <Modal visible={cartVisible} animationType="slide" onRequestClose={() => setCartVisible(false)}>
        <SafeAreaView style={styles.cartModal}>
          <View style={styles.cartHeader}>
            <Text style={styles.cartTitle}>🛒 Mon Panier</Text>
            <TouchableOpacity onPress={() => setCartVisible(false)}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {orderSuccess ? (
            <View style={styles.successContainer}>
              <Text style={styles.successIcon}>✅</Text>
              <Text style={styles.successTitle}>Commande passée !</Text>
              <Text style={styles.successSub}>Votre commande est en cours de traitement.</Text>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => { setOrderSuccess(false); setCartVisible(false) }}
              >
                <Text style={styles.primaryBtnText}>Super !</Text>
              </TouchableOpacity>
            </View>
          ) : cart.length === 0 ? (
            <View style={styles.successContainer}>
              <Text style={styles.successIcon}>🛒</Text>
              <Text style={styles.successTitle}>Votre panier est vide</Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => setCartVisible(false)}>
                <Text style={styles.primaryBtnText}>Voir le menu</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView style={styles.cartList}>
              {cart.map(item => (
                <View key={item.id} style={styles.cartItem}>
                  <View style={styles.cartItemInfo}>
                    <Text style={styles.cartItemName}>{item.name}</Text>
                    <Text style={styles.cartItemPrice}>{(item.price * item.quantity).toFixed(2)} €</Text>
                  </View>
                  <View style={styles.cartItemQty}>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => removeFromCart(item.id)}>
                      <Text style={styles.qtyBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{item.quantity}</Text>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => addToCart(item)}>
                      <Text style={styles.qtyBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              {/* Delivery option */}
              <View style={styles.deliverySection}>
                <TouchableOpacity
                  style={styles.deliveryToggle}
                  onPress={() => setWithDelivery(v => !v)}
                >
                  <View style={[styles.checkbox, withDelivery && styles.checkboxChecked]}>
                    {withDelivery && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.deliveryLabel}>Livraison à domicile</Text>
                </TouchableOpacity>

                {withDelivery && (
                  <TextInput
                    style={styles.addressInput}
                    value={deliveryAddress}
                    onChangeText={setDeliveryAddress}
                    placeholder="Adresse de livraison..."
                    placeholderTextColor="#475569"
                    multiline
                  />
                )}
              </View>

              {/* Total & Order */}
              <View style={styles.cartFooter}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalAmount}>{cartTotal.toFixed(2)} €</Text>
                </View>
                <TouchableOpacity
                  style={[styles.primaryBtn, isOrdering && { opacity: 0.6 }]}
                  onPress={handleOrder}
                  disabled={isOrdering}
                >
                  {isOrdering
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.primaryBtnText}>Commander — {cartTotal.toFixed(2)} €</Text>
                  }
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Item detail Modal */}
      <Modal visible={!!selectedItem} animationType="slide" transparent onRequestClose={() => setSelectedItem(null)}>
        <View style={styles.detailOverlay}>
          <View style={styles.detailCard}>
            {selectedItem?.imageUrl && (
              <Image source={{ uri: selectedItem.imageUrl }} style={styles.detailImg} />
            )}
            <TouchableOpacity style={styles.detailClose} onPress={() => setSelectedItem(null)}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
            <View style={styles.detailBody}>
              <Text style={styles.detailName}>{selectedItem?.name}</Text>
              <Text style={styles.detailPrice}>{selectedItem?.price.toFixed(2)} €</Text>
              {selectedItem?.description && (
                <Text style={styles.detailDesc}>{selectedItem.description}</Text>
              )}
              {canOrder && (
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => { addToCart(selectedItem!); setSelectedItem(null) }}
                >
                  <Text style={styles.primaryBtnText}>Ajouter au panier</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  loadingContainer: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadingText: { color: '#94a3b8', fontSize: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#f8fafc' },
  headerSub: { fontSize: 13, color: '#64748b', marginTop: 2 },
  cartBtn: { position: 'relative', padding: 8 },
  cartIcon: { fontSize: 28 },
  cartBadge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: '#6366f1', borderRadius: 10, minWidth: 20, height: 20,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4,
  },
  cartBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  searchRow: { paddingHorizontal: 16, marginBottom: 12 },
  searchInput: {
    backgroundColor: '#1e293b', borderRadius: 12, borderWidth: 1, borderColor: '#334155',
    paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: '#f8fafc',
  },
  catsRow: { marginBottom: 12, maxHeight: 44 },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155',
  },
  catChipActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  catChipText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  catChipTextActive: { color: '#fff' },
  listContent: { padding: 16, paddingTop: 4 },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyIcon: { fontSize: 56 },
  emptyText: { color: '#64748b', fontSize: 16 },
  card: {
    flex: 1, backgroundColor: '#1e293b', borderRadius: 16,
    overflow: 'hidden', borderWidth: 1, borderColor: '#334155',
  },
  cardImg: { width: '100%', height: 140, resizeMode: 'cover' },
  cardImgPlaceholder: { backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
  cardBody: { padding: 12, gap: 8 },
  cardName: { color: '#f1f5f9', fontSize: 13, fontWeight: '700', lineHeight: 18 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardPrice: { color: '#6366f1', fontSize: 14, fontWeight: '800' },
  addBtn: {
    backgroundColor: '#1e293b', borderWidth: 1.5, borderColor: '#6366f1',
    borderRadius: 20, width: 32, height: 32, justifyContent: 'center', alignItems: 'center',
  },
  addBtnActive: { backgroundColor: '#6366f1' },
  addBtnText: { color: '#6366f1', fontSize: 16, fontWeight: '800' },
  // Cart modal
  cartModal: { flex: 1, backgroundColor: '#0f172a' },
  cartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  cartTitle: { fontSize: 20, fontWeight: '800', color: '#f8fafc' },
  closeBtn: { fontSize: 20, color: '#64748b' },
  cartList: { flex: 1, padding: 16 },
  cartItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#1e293b', borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#334155',
  },
  cartItemInfo: { flex: 1, gap: 4 },
  cartItemName: { color: '#f1f5f9', fontSize: 14, fontWeight: '700' },
  cartItemPrice: { color: '#6366f1', fontSize: 13, fontWeight: '700' },
  cartItemQty: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyBtn: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: '#0f172a',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#334155',
  },
  qtyBtnText: { color: '#f1f5f9', fontSize: 18, fontWeight: '700' },
  qtyText: { color: '#f8fafc', fontSize: 16, fontWeight: '800', minWidth: 20, textAlign: 'center' },
  deliverySection: { marginVertical: 16, gap: 12 },
  deliveryToggle: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#6366f1',
    justifyContent: 'center', alignItems: 'center',
  },
  checkboxChecked: { backgroundColor: '#6366f1' },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '800' },
  deliveryLabel: { color: '#f1f5f9', fontSize: 15, fontWeight: '600' },
  addressInput: {
    backgroundColor: '#1e293b', borderRadius: 12, borderWidth: 1, borderColor: '#334155',
    padding: 14, fontSize: 14, color: '#f8fafc', minHeight: 60,
  },
  cartFooter: { borderTopWidth: 1, borderTopColor: '#1e293b', paddingTop: 16, gap: 14 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { color: '#94a3b8', fontSize: 16 },
  totalAmount: { color: '#f8fafc', fontSize: 22, fontWeight: '900' },
  primaryBtn: {
    backgroundColor: '#6366f1', borderRadius: 12, paddingVertical: 15, alignItems: 'center',
    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 16 },
  successIcon: { fontSize: 72 },
  successTitle: { color: '#f8fafc', fontSize: 22, fontWeight: '800' },
  successSub: { color: '#64748b', fontSize: 14, textAlign: 'center' },
  // Item detail
  detailOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  detailCard: { backgroundColor: '#1e293b', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', maxHeight: '85%' },
  detailImg: { width: '100%', height: 220, resizeMode: 'cover' },
  detailClose: { position: 'absolute', top: 16, right: 16, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 8 },
  detailBody: { padding: 24, gap: 12 },
  detailName: { color: '#f8fafc', fontSize: 22, fontWeight: '900' },
  detailPrice: { color: '#6366f1', fontSize: 20, fontWeight: '800' },
  detailDesc: { color: '#94a3b8', fontSize: 14, lineHeight: 22 },
})
