import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, TextInput, ActivityIndicator, ScrollView, Modal,
  Animated, Alert, Dimensions, Switch,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getCategories, getItems } from '../api/menu'
import type { Item, Category } from '../api/menu'
import { createOrder } from '../api/orders'
import { useAuth } from '../contexts/AuthContext'
import { getMyNotifications, markAsRead, markAllAsRead } from '../api/notifications'
import type { NotificationDetail } from '../api/notifications'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const CARD_WIDTH = (SCREEN_WIDTH - 16 * 2 - 12) / 2

interface CartItem extends Item {
  quantity: number
  note?: string
}

interface RichDescription {
  desc?: string
  calories?: number
  prepTime?: number
  allergens?: string
  spice?: number
  isVeg?: boolean
  rating?: number
}

const parseDescription = (rawDesc: string | null): RichDescription => {
  if (!rawDesc) return {}
  const trimmed = rawDesc.trim()
  if (trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed)
    } catch {
      /* ignore */
    }
  }
  return { desc: rawDesc }
}

export default function MenuScreen() {
  const { isDeliverer } = useAuth()
  const canOrder = !isDeliverer

  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [restaurantId, setRestaurantId] = useState<string>('')

  // Favorites
  const [favorites, setFavorites] = useState<string[]>([])

  // Filters state
  const [filterVegetarian, setFilterVegetarian] = useState(false)
  const [filterGlutenFree, setFilterGlutenFree] = useState(false)
  const [filterSpicy, setFilterSpicy] = useState(false)
  const [filterPriceMax, setFilterPriceMax] = useState('')
  const [filterFavoritesOnly, setFilterFavoritesOnly] = useState(false)
  const [excludedAllergens, setExcludedAllergens] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)

  // Notifications
  const [notifications, setNotifications] = useState<NotificationDetail[]>([])
  const [notifVisible, setNotifVisible] = useState(false)
  const unreadCount = notifications.filter(n => !n.isRead).length

  // Cart
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartVisible, setCartVisible] = useState(false)
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [itemNote, setItemNote] = useState('')
  const [isOrdering, setIsOrdering] = useState(false)
  const [orderSuccess, setOrderSuccess] = useState(false)
  const [withDelivery, setWithDelivery] = useState(false)
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'CREDIT_CARD' | 'PAYPAL' | 'CASH'>('CREDIT_CARD')

  const cartBadgeAnim = useRef(new Animated.Value(1)).current

  // Load favorites and cart from AsyncStorage
  const loadStoredData = async () => {
    try {
      const storedFavs = await AsyncStorage.getItem('favorites')
      if (storedFavs) {
        setFavorites(JSON.parse(storedFavs))
      }
      const storedCart = await AsyncStorage.getItem('cart')
      if (storedCart) {
        setCart(JSON.parse(storedCart))
      }
    } catch (err) {
      console.error('Failed to load storage data:', err)
    }
  }

  useEffect(() => {
    load()
    loadNotifications()
    loadStoredData()
  }, [])

  // Auto-save cart to storage when it changes
  useEffect(() => {
    if (!isLoading) {
      AsyncStorage.setItem('cart', JSON.stringify(cart)).catch(err => console.error(err))
    }
  }, [cart, isLoading])

  // Reload cart whenever Menu is focused (handles Reorder navigation)
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem('cart').then(storedCart => {
        if (storedCart) {
          setCart(JSON.parse(storedCart))
        }
      }).catch(err => console.error(err))
    }, [])
  )

  const load = async () => {
    try {
      const [cats, its] = await Promise.all([
        getCategories(),
        getItems(),
      ])
      setCategories(cats)
      setItems(its.filter(i => i.isAvailable))
      if (cats.length > 0) {
        setRestaurantId(cats[0].restaurantId)
      }
    } catch (err) {
      console.error('Failed to load menu:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const loadNotifications = async () => {
    try {
      const data = await getMyNotifications()
      setNotifications(data)
    } catch {
      // silently fail
    }
  }

  const handleMarkAsRead = async (id: string) => {
    try {
      await markAsRead(id)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
    } catch { }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead()
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
    } catch { }
  }

  const toggleFavorite = async (itemId: string) => {
    const nextFavs = favorites.includes(itemId)
      ? favorites.filter(id => id !== itemId)
      : [...favorites, itemId]
    setFavorites(nextFavs)
    await AsyncStorage.setItem('favorites', JSON.stringify(nextFavs))
  }

  // Apply search, category, and advanced filters
  const filteredItems = items.filter(item => {
    const matchCat = selectedCategory === 'all' || item.categoryId === selectedCategory
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase())

    // Parse description for rich metadata
    const rich = parseDescription(item.description)
    const matchVeg = !filterVegetarian || !!rich.isVeg
    const matchGlutenFree = !filterGlutenFree || !!(item as any).isGlutenFree
    const matchSpicy = !filterSpicy || !!(rich.spice && rich.spice > 0)

    // Price Max filter
    const maxPrice = parseFloat(filterPriceMax)
    const matchPrice = isNaN(maxPrice) || item.price <= maxPrice

    // Favorites filter
    const matchFav = !filterFavoritesOnly || favorites.includes(item.id)

    // Allergen exclusion filter
    const itemAllergens = (rich.allergens || '').toLowerCase()
    const matchAllergens = excludedAllergens.length === 0 ||
      !excludedAllergens.some(a => itemAllergens.includes(a.toLowerCase()))

    return matchCat && matchSearch && matchVeg && matchGlutenFree && matchSpicy && matchPrice && matchFav && matchAllergens
  })

  const addToCart = (item: Item, note?: string) => {
    Animated.sequence([
      Animated.timing(cartBadgeAnim, { toValue: 1.4, duration: 120, useNativeDriver: true }),
      Animated.timing(cartBadgeAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start()

    setCart(prev => {
      const existing = prev.find(c => c.id === item.id)
      if (existing) return prev.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1, note: note || c.note } : c)
      return [...prev, { ...item, quantity: 1, note }]
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
        paymentMethod: withDelivery ? paymentMethod : undefined,
      })
      setCart([])
      await AsyncStorage.removeItem('cart')
      setDeliveryAddress('')
      setOrderSuccess(true)
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error || 'Impossible de passer la commande.')
    } finally {
      setIsOrdering(false)
    }
  }

  const getCategoryName = (catId: string) => {
    return categories.find(c => c.id === catId)?.name || 'Menu'
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>🍽️ Menu</Text>
            <Text style={styles.headerSub}>Chargement...</Text>
          </View>
        </View>
        <View style={{ padding: 16, gap: 12 }}>
          {[1, 2, 3, 4].map(i => (
            <View key={i} style={styles.skeletonCard}>
              <View style={styles.skeletonImg} />
              <View style={{ flex: 1, gap: 8 }}>
                <View style={[styles.skeletonLine, { width: '60%' }]} />
                <View style={[styles.skeletonLine, { width: '40%', height: 10 }]} />
                <View style={[styles.skeletonLine, { width: '30%', height: 10 }]} />
              </View>
            </View>
          ))}
        </View>
      </SafeAreaView>
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
        <View style={styles.headerRight}>
          {/* Bell notification */}
          <TouchableOpacity style={styles.bellBtn} onPress={() => { setNotifVisible(true); loadNotifications() }}>
            <Text style={styles.bellIcon}>🔔</Text>
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
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
      </View>

      {/* ── Collapsible filter panel ── */}
      {(() => {
        const activeFiltersCount = [
          search.trim() !== '',
          filterVegetarian,
          filterGlutenFree,
          filterSpicy,
          filterFavoritesOnly,
          filterPriceMax.trim() !== '',
          excludedAllergens.length > 0,
        ].filter(Boolean).length

        return (
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
                {/* Search */}
                <View style={styles.filterInputRow}>
                  <TextInput
                    style={styles.filterInputSearch}
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Rechercher un plat..."
                    placeholderTextColor="#64748b"
                  />
                </View>

                {/* Switches row 1 */}
                <View style={styles.filterSwitchesRow}>
                  <View style={styles.filterSwitchContainer}>
                    <Text style={styles.filterSwitchLabel}>🌿 Végé</Text>
                    <Switch
                      value={filterVegetarian}
                      onValueChange={setFilterVegetarian}
                      trackColor={{ false: '#334155', true: '#22c55e' }}
                      thumbColor={filterVegetarian ? '#fff' : '#94a3b8'}
                    />
                  </View>
                  <View style={styles.filterSwitchContainer}>
                    <Text style={styles.filterSwitchLabel}>🌾 Sans Gluten</Text>
                    <Switch
                      value={filterGlutenFree}
                      onValueChange={setFilterGlutenFree}
                      trackColor={{ false: '#334155', true: '#eab308' }}
                      thumbColor={filterGlutenFree ? '#fff' : '#94a3b8'}
                    />
                  </View>
                </View>

                {/* Switches row 2 */}
                <View style={styles.filterSwitchesRow}>
                  <View style={styles.filterSwitchContainer}>
                    <Text style={styles.filterSwitchLabel}>🌶️ Épicé</Text>
                    <Switch
                      value={filterSpicy}
                      onValueChange={setFilterSpicy}
                      trackColor={{ false: '#334155', true: '#ef4444' }}
                      thumbColor={filterSpicy ? '#fff' : '#94a3b8'}
                    />
                  </View>
                  <View style={styles.filterSwitchContainer}>
                    <Text style={styles.filterSwitchLabel}>❤️ Favoris</Text>
                    <Switch
                      value={filterFavoritesOnly}
                      onValueChange={setFilterFavoritesOnly}
                      trackColor={{ false: '#334155', true: '#f97316' }}
                      thumbColor={filterFavoritesOnly ? '#fff' : '#94a3b8'}
                    />
                  </View>
                </View>

                {/* Max Price */}
                <View style={styles.filterInputRow}>
                  <TextInput
                    style={styles.filterInputSearch}
                    value={filterPriceMax}
                    onChangeText={setFilterPriceMax}
                    keyboardType="numeric"
                    placeholder="Prix maximum (€)..."
                    placeholderTextColor="#64748b"
                  />
                </View>

                {/* Allergen exclusion */}
                <Text style={styles.filterSectionLabel}>Exclure les allergènes</Text>
                <View style={styles.allergenChipsRow}>
                  {['Gluten', 'Lactose', 'Arachides', 'Oeufs', 'Soja', 'Fruits à coque'].map(allergen => {
                    const isExcluded = excludedAllergens.includes(allergen)
                    return (
                      <TouchableOpacity
                        key={allergen}
                        style={[styles.allergenChip, isExcluded && styles.allergenChipActive]}
                        onPress={() => setExcludedAllergens(prev =>
                          isExcluded ? prev.filter(a => a !== allergen) : [...prev, allergen]
                        )}
                      >
                        <Text style={[styles.allergenChipText, isExcluded && styles.allergenChipTextActive]}>
                          {isExcluded ? '✗ ' : ''}{allergen}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>

                <TouchableOpacity
                  style={styles.resetFiltersBtn}
                  onPress={() => {
                    setSearch('')
                    setFilterVegetarian(false)
                    setFilterGlutenFree(false)
                    setFilterSpicy(false)
                    setFilterFavoritesOnly(false)
                    setFilterPriceMax('')
                    setExcludedAllergens([])
                  }}
                >
                  <Text style={styles.resetFiltersBtnText}>Réinitialiser tous les filtres</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )
      })()}

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
          const isFav = favorites.includes(item.id)
          const rich = parseDescription(item.description)
          return (
            <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => { setSelectedItem(item); setItemNote('') }}>
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.cardImg} />
              ) : (
                <View style={[styles.cardImg, styles.cardImgPlaceholder]}>
                  <Text style={{ fontSize: 36 }}>🍔</Text>
                </View>
              )}

              {/* Heart Icon / Favorite */}
              <TouchableOpacity style={styles.favBtn} onPress={() => toggleFavorite(item.id)}>
                <Text style={styles.favIcon}>{isFav ? '❤️' : '🤍'}</Text>
              </TouchableOpacity>

              {/* Végé badge */}
              {rich.isVeg && <View style={styles.vegBadge}><Text style={styles.vegBadgeText}>🌿</Text></View>}

              <View style={styles.cardBody}>
                <View style={styles.categoryBadgeContainer}>
                  <Text style={styles.cardCategoryName}>{getCategoryName(item.categoryId)}</Text>
                </View>
                <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                
                {/* Description snippet */}
                {rich.desc && <Text style={styles.cardDescText} numberOfLines={1}>{rich.desc}</Text>}

                {/* Metadata chips */}
                <View style={styles.metaChipsContainer}>
                  {rich.prepTime && <Text style={styles.metaChipText}>⏱️ {rich.prepTime}m</Text>}
                  {rich.calories && <Text style={styles.metaChipText}>🔥 {rich.calories}kcal</Text>}
                  {rich.rating && <Text style={styles.metaChipText}>⭐ {rich.rating}</Text>}
                </View>

                {/* Allergens warning */}
                {rich.allergens && (
                  <Text style={styles.allergenTagText} numberOfLines={1}>⚠️ {rich.allergens}</Text>
                )}

                <View style={styles.cardFooter}>
                  <Text style={styles.cardPrice}>{item.price.toFixed(2)} €</Text>
                  {canOrder && (
                    inCart ? (
                      <View style={styles.qtyControlsOnCard}>
                        <TouchableOpacity style={styles.qtyCardBtn} onPress={() => removeFromCart(item.id)}>
                          <Text style={styles.qtyCardBtnText}>−</Text>
                        </TouchableOpacity>
                        <Text style={styles.qtyCardText}>{inCart.quantity}</Text>
                        <TouchableOpacity style={styles.qtyCardBtn} onPress={() => addToCart(item)}>
                          <Text style={styles.qtyCardBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.addBtn}
                        onPress={() => addToCart(item)}
                      >
                        <Text style={styles.addBtnText}>+ Ajouter</Text>
                      </TouchableOpacity>
                    )
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )
        }}
      />

      {/* Advanced Filters Modal Removed */}

      {/* Notifications Modal */}
      <Modal visible={notifVisible} animationType="slide" onRequestClose={() => setNotifVisible(false)}>
        <SafeAreaView style={styles.cartModal}>
          <View style={styles.cartHeader}>
            <Text style={styles.cartTitle}>🔔 Notifications</Text>
            <TouchableOpacity onPress={() => setNotifVisible(false)}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView style={styles.cartList}>
            <TouchableOpacity style={styles.markAllReadBtn} onPress={handleMarkAllAsRead}>
              <Text style={styles.markAllReadText}>Tout marquer comme lu</Text>
            </TouchableOpacity>
            {notifications.map(n => (
              <TouchableOpacity key={n.id} style={[styles.cartItem, !n.isRead && { borderColor: '#f97316' }]} onPress={() => handleMarkAsRead(n.id)}>
                <Text style={styles.cartItemName}>{n.message}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

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
                <View key={item.id} style={styles.cartItemWrapper}>
                  <View style={styles.cartItem}>
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
                  <TextInput
                    style={styles.cartItemNoteInput}
                    value={item.note || ''}
                    onChangeText={(text) => {
                      setCart(prev => prev.map(c => c.id === item.id ? { ...c, note: text } : c))
                    }}
                    placeholder="Ajouter une note..."
                    placeholderTextColor="#64748b"
                  />
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
                  <>
                    <TextInput
                      style={styles.addressInput}
                      value={deliveryAddress}
                      onChangeText={setDeliveryAddress}
                      placeholder="Adresse de livraison..."
                      placeholderTextColor="#475569"
                      multiline
                    />
                    
                    {/* Payment Method Selector */}
                    <Text style={styles.sectionSubTitle}>Moyen de paiement</Text>
                    <View style={styles.paymentSelector}>
                      {(['CREDIT_CARD', 'PAYPAL', 'CASH'] as const).map((method) => (
                        <TouchableOpacity
                          key={method}
                          style={[styles.paymentBtn, paymentMethod === method && styles.paymentBtnActive]}
                          onPress={() => setPaymentMethod(method)}
                        >
                          <Text style={[styles.paymentText, paymentMethod === method && styles.paymentTextActive]}>
                            {method === 'CREDIT_CARD' ? '💳 CB' : method === 'PAYPAL' ? '🅿️ PayPal' : '💵 Espèces'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
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
              <Text style={styles.detailCategoryName}>{getCategoryName(selectedItem?.categoryId || '')}</Text>
              <Text style={styles.detailName}>{selectedItem?.name}</Text>
              <Text style={styles.detailPrice}>{selectedItem?.price.toFixed(2)} €</Text>
              
              {/* Parse detailed metadata for the modal */}
              {(() => {
                const rich = parseDescription(selectedItem?.description || null)
                return (
                  <View style={styles.detailMetaSection}>
                    {rich.desc && <Text style={styles.detailDesc}>{rich.desc}</Text>}
                    
                    <View style={styles.detailChipsRow}>
                      {rich.isVeg && <Text style={styles.detailVegBadge}>🌿 Végétarien</Text>}
                      {rich.prepTime && <Text style={styles.detailMetaChip}>⏱️ Prêt en {rich.prepTime} min</Text>}
                      {rich.calories && <Text style={styles.detailMetaChip}>🔥 {rich.calories} kcal</Text>}
                      {rich.rating && <Text style={styles.detailMetaChip}>⭐ {rich.rating} / 5</Text>}
                    </View>

                    {rich.allergens && (
                      <Text style={styles.detailAllergens}>⚠️ Allergènes : {rich.allergens}</Text>
                    )}
                  </View>
                )
              })()}

              {canOrder && (
                <>
                  <TextInput
                    style={styles.detailNoteInput}
                    value={itemNote}
                    onChangeText={setItemNote}
                    placeholder="Instructions particulières (sans oignons, etc.)..."
                    placeholderTextColor="#64748b"
                  />
                  <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={() => { addToCart(selectedItem!, itemNote); setSelectedItem(null) }}
                  >
                    <Text style={styles.primaryBtnText}>Ajouter au panier</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0f14' },
  loadingContainer: { flex: 1, backgroundColor: '#0d0f14', justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadingText: { color: '#94a3b8', fontSize: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#f1f5f9' },
  headerSub: { fontSize: 13, color: '#64748b', marginTop: 2 },
  cartBtn: { position: 'relative', padding: 8 },
  cartIcon: { fontSize: 28 },
  cartBadge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: '#f97316', borderRadius: 10, minWidth: 20, height: 20,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4,
  },
  cartBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bellBtn: { position: 'relative', padding: 8 },
  bellIcon: { fontSize: 24 },
  bellBadge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: '#ef4444', borderRadius: 10, minWidth: 18, height: 18,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3,
  },
  bellBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  searchRow: { paddingHorizontal: 16, marginBottom: 12, flexDirection: 'row', gap: 8 },
  searchInput: {
    flex: 1,
    backgroundColor: '#151821', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: '#f1f5f9',
  },
  filterTriggerBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#151821',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  filterTriggerText: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 13,
  },
  catsRow: { marginBottom: 12, maxHeight: 44 },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#151821', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  catChipActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  catChipText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  catChipTextActive: { color: '#fff' },
  listContent: { padding: 16, paddingTop: 4 },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyIcon: { fontSize: 56 },
  emptyText: { color: '#64748b', fontSize: 16 },
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#151821', borderRadius: 16,
    overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    position: 'relative',
  },
  favBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  favIcon: {
    fontSize: 16,
  },
  vegBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(34,197,94,0.2)',
    borderColor: 'rgba(34,197,94,0.4)',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 10,
  },
  vegBadgeText: {
    fontSize: 12,
  },
  cardImg: { width: '100%', height: 110, resizeMode: 'cover' },
  cardImgPlaceholder: { backgroundColor: '#0d0f14', justifyContent: 'center', alignItems: 'center' },
  cardBody: { padding: 12, gap: 4 },
  categoryBadgeContainer: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
    borderColor: 'rgba(249, 115, 22, 0.3)',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  cardCategoryName: {
    color: '#f97316',
    fontSize: 9,
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardName: { color: '#f1f5f9', fontSize: 13, fontWeight: '800', marginTop: 2 },
  cardDescText: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 14,
  },
  metaChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginVertical: 4,
  },
  metaChipText: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    fontSize: 9,
    color: '#94a3b8',
  },
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
  filterSwitchesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  filterSwitchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d0f14',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flex: 1,
    justifyContent: 'space-between',
  },
  filterSwitchLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
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
  filterSectionLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 6,
  },
  allergenChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  allergenChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  allergenChipActive: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: 'rgba(239,68,68,0.35)',
  },
  allergenChipText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  allergenChipTextActive: {
    color: '#ef4444',
  },
  skeletonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#151821',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  skeletonImg: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#1e2333',
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#1e2333',
  },
  allergenTagText: {
    color: '#e11d48',
    fontSize: 10,
    fontWeight: '600',
    marginVertical: 2,
  },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  cardPrice: { color: '#f97316', fontSize: 14, fontWeight: '800' },
  addBtn: {
    backgroundColor: '#f97316',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  qtyControlsOnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d0f14',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    paddingHorizontal: 4,
    height: 32,
  },
  qtyCardBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyCardBtnText: {
    color: '#f1f5f9',
    fontWeight: '800',
    fontSize: 14,
  },
  qtyCardText: {
    color: '#f97316',
    fontSize: 12,
    fontWeight: '900',
    paddingHorizontal: 6,
  },
  // Filters Modal
  filterModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  filterModalContent: {
    backgroundColor: '#151821',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    width: '100%',
    maxWidth: 340,
    overflow: 'hidden',
  },
  filterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  filterModalTitle: {
    color: '#f1f5f9',
    fontSize: 18,
    fontWeight: '900',
  },
  filterModalBody: {
    padding: 18,
    gap: 16,
  },
  filterRowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  filterLabel: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: '600',
  },
  filterFieldGroup: {
    gap: 8,
  },
  filterInput: {
    backgroundColor: '#0d0f14',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 10,
    color: '#f1f5f9',
    fontSize: 14,
  },
  applyFiltersBtn: {
    backgroundColor: '#f97316',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  applyFiltersText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  // Cart modal
  cartModal: { flex: 1, backgroundColor: '#0d0f14' },
  cartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  cartTitle: { fontSize: 20, fontWeight: '800', color: '#f1f5f9' },
  closeBtn: { fontSize: 22, color: '#64748b', fontWeight: '900', padding: 4 },
  cartList: { flex: 1, padding: 16 },
  cartItemWrapper: {
    backgroundColor: '#151821', borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    gap: 10,
  },
  cartItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  cartItemInfo: { flex: 1, gap: 4 },
  cartItemName: { color: '#f1f5f9', fontSize: 14, fontWeight: '700' },
  cartItemPrice: { color: '#f97316', fontSize: 13, fontWeight: '700' },
  cartItemQty: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyBtn: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: '#0d0f14',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  qtyBtnText: { color: '#f1f5f9', fontSize: 18, fontWeight: '700' },
  qtyText: { color: '#f1f5f9', fontSize: 16, fontWeight: '800', minWidth: 20, textAlign: 'center' },
  cartItemNoteInput: {
    backgroundColor: '#0d0f14',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: '#f1f5f9',
    fontSize: 12,
  },
  deliverySection: { marginVertical: 16, gap: 12 },
  deliveryToggle: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#f97316',
    justifyContent: 'center', alignItems: 'center',
  },
  checkboxChecked: { backgroundColor: '#f97316' },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '800' },
  deliveryLabel: { color: '#f1f5f9', fontSize: 15, fontWeight: '600' },
  addressInput: {
    backgroundColor: '#151821', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    padding: 14, fontSize: 14, color: '#f1f5f9', minHeight: 60,
  },
  sectionSubTitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginTop: 10,
  },
  paymentSelector: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  paymentBtn: {
    flex: 1,
    backgroundColor: '#151821',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  paymentBtnActive: {
    borderColor: '#f97316',
    backgroundColor: 'rgba(249,115,22,0.1)',
  },
  paymentText: {
    color: '#94a3b8',
    fontWeight: '600',
    fontSize: 12,
  },
  paymentTextActive: {
    color: '#f97316',
    fontWeight: '800',
  },
  cartFooter: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', paddingTop: 16, gap: 14 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { color: '#94a3b8', fontSize: 16 },
  totalAmount: { color: '#f1f5f9', fontSize: 22, fontWeight: '900' },
  primaryBtn: {
    backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 15, alignItems: 'center',
    shadowColor: '#f97316', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 16 },
  successIcon: { fontSize: 72 },
  successTitle: { color: '#f1f5f9', fontSize: 22, fontWeight: '800' },
  successSub: { color: '#64748b', fontSize: 14, textAlign: 'center' },
  markAllReadBtn: {
    backgroundColor: '#151821',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  markAllReadText: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 13,
  },
  // Item detail
  detailOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  detailCard: { backgroundColor: '#151821', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', maxHeight: '85%' },
  detailImg: { width: '100%', height: 220, resizeMode: 'cover' },
  detailClose: { position: 'absolute', top: 16, right: 16, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 8 },
  detailBody: { padding: 24, gap: 10 },
  detailCategoryName: {
    color: '#64748b',
    fontSize: 12,
    textTransform: 'uppercase',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  detailName: { color: '#f1f5f9', fontSize: 22, fontWeight: '900' },
  detailPrice: { color: '#f97316', fontSize: 20, fontWeight: '800' },
  detailMetaSection: {
    gap: 12,
    marginVertical: 8,
  },
  detailDesc: { color: '#94a3b8', fontSize: 14, lineHeight: 22 },
  detailChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailVegBadge: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderColor: 'rgba(34,197,94,0.4)',
    borderWidth: 1,
    borderRadius: 8,
    color: '#22c55e',
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
  },
  detailMetaChip: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderRadius: 8,
    color: '#94a3b8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
  },
  detailAllergens: {
    color: '#ef4444',
    fontWeight: '600',
    fontSize: 13,
    marginTop: 4,
  },
  detailNoteInput: {
    backgroundColor: '#0d0f14',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 14,
    color: '#f1f5f9',
    fontSize: 14,
    marginVertical: 10,
  },
})
