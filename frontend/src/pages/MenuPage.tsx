import { useState, useEffect, useRef, useCallback } from 'react'
import {
  ShoppingCart, Plus, Minus, Trash2, Tag, Search,
  AlertCircle, MapPin, CreditCard, ChevronDown, Heart,
  Grid3X3, List, Truck, UtensilsCrossed, Star, Clock,
  Flame, X, Check, Zap, Filter
} from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getCategories, getItems } from '../api/menu.api'
import { createOrder } from '../api/orders.api'
import type { Category, Item } from '../api/menu.api'
import type { OrderItemPayload } from '../api/orders.api'

const RESTAURANT_ID = import.meta.env.VITE_RESTAURANT_ID || ''
const FREE_DELIVERY_THRESHOLD = 30

interface CartItem extends Item {
  quantity: number
  itemNote?: string
}

interface RichDescription {
  desc?: string
  calories?: string
  prepTime?: string
  allergens?: string
  rating?: string
  spice?: number
  isVeg?: boolean
}

const parseDescription = (rawDesc: string | null): RichDescription => {
  if (!rawDesc) return {}
  if (rawDesc.trim().startsWith('{')) {
    try { return JSON.parse(rawDesc) } catch { /* ignore */ }
  }
  return { desc: rawDesc }
}

// ── Icône de flammes pour le niveau d'épice ──
const SpiceIndicator = ({ level }: { level: number }) => (
  <span style={{ display: 'inline-flex', gap: '2px' }}>
    {[1, 2, 3].map(i => (
      <Flame key={i} size={10} style={{ color: i <= level ? '#ef4444' : 'var(--color-border)', fill: i <= level ? '#ef4444' : 'transparent' }} />
    ))}
  </span>
)

// ── Chip de catégorie sticky ──
const CategoryNav = ({
  categories,
  selectedCategory,
  setSelectedCategory,
}: {
  categories: Category[]
  selectedCategory: string
  setSelectedCategory: (id: string) => void
}) => (
  <div className="menu-category-nav">
    <button
      className={`menu-cat-btn ${selectedCategory === '' ? 'active' : ''}`}
      onClick={() => setSelectedCategory('')}
    >
      <Tag size={13} /> Tous
    </button>
    {categories.map(cat => (
      <button
        key={cat.id}
        className={`menu-cat-btn ${selectedCategory === cat.id ? 'active' : ''}`}
        onClick={() => setSelectedCategory(cat.id)}
        id={`cat-nav-${cat.id}`}
      >
        {cat.name}
      </button>
    ))}
  </div>
)

const MenuPage = () => {
  const { isDeliverer } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // ── Data ──
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isOrdering, setIsOrdering] = useState(false)
  const [error, setError] = useState('')
  const [restaurantId, setRestaurantId] = useState(RESTAURANT_ID)

  // ── Cart ──
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('restau_cart')
    return saved ? JSON.parse(saved) : []
  })
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [cartStep, setCartStep] = useState<number>(1)
  const [withDelivery, setWithDelivery] = useState(false)
  const [notes, setNotes] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'CREDIT_CARD' | 'PAYPAL' | 'CASH'>('CREDIT_CARD')

  const [orderSuccess, setOrderSuccess] = useState(false)

  // ── Delivery address ──
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [suggestions, setSuggestions] = useState<{ label: string }[]>([])
  const [isValidatingAddress, setIsValidatingAddress] = useState(false)
  const [addressStatus, setAddressStatus] = useState<'UNCHECKED' | 'VALID' | 'FORCED'>('UNCHECKED')

  // ── Payment modal ──

  const [paymentStep, setPaymentStep] = useState<'FORM' | 'PROCESSING' | 'SUCCESS'>('FORM')
  const [cardHolder, setCardHolder] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCvv, setCardCvv] = useState('')
  const [paypalEmail, setPaypalEmail] = useState('')

  // ── UI state ──
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('restau_favorites')
    return saved ? JSON.parse(saved) : []
  })
  const [showFavOnly, setShowFavOnly] = useState(false)
  const [selectedItemDetail, setSelectedItemDetail] = useState<Item | null>(null)
  
  // ── Collapsible Filters ──
  const [showFiltersPanel, setShowFiltersPanel] = useState(false)
  const [filterVegOnly, setFilterVegOnly] = useState(false)
  const [filterGlutenFree, setFilterGlutenFree] = useState(false)
  const [filterSpicy, setFilterSpicy] = useState(false)
  const [filterMaxPrice, setFilterMaxPrice] = useState<number>(50)
  const [filterMinSpice, setFilterMinSpice] = useState<number>(0)
  const [excludedAllergens, setExcludedAllergens] = useState<string[]>([])

  const [searchQuery, setSearchQuery] = useState('')
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [flyingItem, setFlyingItem] = useState<{ id: string; x: number; y: number } | null>(null)
  const cartBtnRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  // ── Persist cart ──
  useEffect(() => {
    localStorage.setItem('restau_cart', JSON.stringify(cart))
  }, [cart])

  // ── Persist favorites ──
  useEffect(() => {
    localStorage.setItem('restau_favorites', JSON.stringify(favorites))
  }, [favorites])

  // ── Fetch data ──
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [cats, its] = await Promise.all([getCategories(), getItems()])
        setCategories(cats)
        setItems(its)
        if (cats.length > 0 && !restaurantId) setRestaurantId(cats[0].restaurantId)
      } catch {
        setError('Impossible de charger le menu. Vérifiez que le backend est démarré.')
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  // ── Reorder from orders page ──
  useEffect(() => {
    const savedReorder = localStorage.getItem('reorder_items')
    if (savedReorder && items.length > 0) {
      try {
        const decoded = JSON.parse(savedReorder) as { id: string; qty: number }[]
        const newCart: CartItem[] = []
        decoded.forEach(entry => {
          const found = items.find(it => it.id === entry.id)
          if (found) newCart.push({ ...found, quantity: entry.qty })
        })
        if (newCart.length > 0) { setCart(newCart); setIsCartOpen(true) }
      } catch (e) { console.error(e) }
      finally { localStorage.removeItem('reorder_items') }
    }
  }, [items])

  // ── URL search param ──
  useEffect(() => {
    const p = searchParams.get('search')
    if (p) { setSearch(p); setSearchQuery(p) }
  }, [searchParams])

  // ── Close search dropdown on click outside ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Derived ──
  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)
  const deliveryFee = withDelivery ? 2.5 : 0
  const remainingForFreeDelivery = Math.max(0, FREE_DELIVERY_THRESHOLD - cartTotal)
  const freeDeliveryProgress = Math.min(100, (cartTotal / FREE_DELIVERY_THRESHOLD) * 100)

  const filteredItems = items.filter(item => {
    if (!item.isAvailable) return false
    if (selectedCategory && item.categoryId !== selectedCategory) return false
    const q = (search || searchQuery).toLowerCase()
    if (q && !item.name.toLowerCase().includes(q)) return false
    if (showFavOnly && !favorites.includes(item.id)) return false

    // Advanced Filters
    const rich = parseDescription(item.description)
    if (filterVegOnly && !item.isVegetarian && !rich.isVeg) return false
    if (filterGlutenFree && !item.isGlutenFree) return false
    if (filterSpicy && !item.isSpicy && !(rich.spice && rich.spice > 0)) return false
    if (filterMaxPrice !== null && item.price > filterMaxPrice) return false
    if (filterMinSpice > 0 && (rich.spice || 0) < filterMinSpice) return false
    if (excludedAllergens.length > 0 && rich.allergens) {
      const itemAllergens = rich.allergens.toLowerCase()
      const hasExcluded = excludedAllergens.some(a => itemAllergens.includes(a.toLowerCase()))
      if (hasExcluded) return false
    }

    return true
  })

  // Quick search dropdown suggestions (max 5)
  const searchSuggestions = searchQuery.trim().length >= 2
    ? items.filter(it => it.isAvailable && it.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 5)
    : []

  // ── Handlers ──
  const addToCart = useCallback((item: Item, e?: React.MouseEvent) => {
    if (isDeliverer) return
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id)
      if (existing) return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { ...item, quantity: 1 }]
    })
    // Flying animation
    if (e && cartBtnRef.current) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      setFlyingItem({ id: item.id, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
      setTimeout(() => setFlyingItem(null), 700)
    }
  }, [isDeliverer])

  const updateQuantity = (id: string, delta: number) => {
    if (isDeliverer) return
    setCart(prev => prev.map(i => i.id === id ? { ...i, quantity: i.quantity + delta } : i).filter(i => i.quantity > 0))
  }

  const removeFromCart = (id: string) => setCart(prev => prev.filter(i => i.id !== id))

  const updateItemNote = (id: string, note: string) => {
    setCart(prev => prev.map(i => i.id === id ? { ...i, itemNote: note } : i))
  }

  const toggleFavorite = (id: string) => {
    setFavorites(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id])
  }

  const handleAddressChange = async (val: string) => {
    setDeliveryAddress(val); setAddressStatus('UNCHECKED')
    if (val.trim().length < 5) { setSuggestions([]); return }
    setIsValidatingAddress(true)
    try {
      const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(val)}&limit=5`)
      const data = await res.json()
      if (data.features) setSuggestions(data.features.map((f: { properties: { label: string } }) => ({ label: f.properties.label })))
    } catch { /* ignore */ }
    finally { setIsValidatingAddress(false) }
  }

  const selectSuggestion = (label: string) => { setDeliveryAddress(label); setSuggestions([]); setAddressStatus('VALID') }
  const forceManualValidation = () => { setSuggestions([]); setAddressStatus('FORCED') }



  const handleConfirmMockPayment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setPaymentStep('PROCESSING')
    await new Promise(r => setTimeout(r, 2000))
    setPaymentStep('SUCCESS')
    await new Promise(r => setTimeout(r, 1000))
    await handleOrder()
  }

  const handleOrder = async () => {
    if (cart.length === 0) return
    if (!restaurantId) { setError("Aucun restaurant disponible."); return }
    setIsOrdering(true); setError('')
    try {
      const orderItems: OrderItemPayload[] = cart.map(i => ({ itemId: i.id, quantity: i.quantity, note: i.itemNote || undefined }))
      await createOrder({
        restaurantId, items: orderItems,
        note: notes || undefined,
        deliveryAddress: withDelivery && deliveryAddress ? deliveryAddress : undefined,
        paymentMethod: withDelivery ? paymentMethod : undefined,
      })
      setCart([]); setNotes(''); setDeliveryAddress(''); setSuggestions([])
      setAddressStatus('UNCHECKED')
      setOrderSuccess(true)
      setCartStep(4)
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: string } } }
      setError(apiErr.response?.data?.error || 'Erreur lors de la commande.')
      setPaymentStep('FORM')
      setCartStep(3)
    } finally { setIsOrdering(false) }
  }

  // ── Cross-sell suggestions (items not in cart, up to 3) ──
  const crossSellItems = items
    .filter(it => it.isAvailable && !cart.find(c => c.id === it.id))
    .slice(0, 3)

  if (isLoading) {
    return (
      <div className="menu-page">
        <div className="menu-hero-header">
          <div className="menu-hero-content" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="skeleton" style={{ height: '36px', width: '250px' }}></div>
            <div className="skeleton" style={{ height: '20px', width: '400px' }}></div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', margin: '24px 0', overflowX: 'hidden' }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="skeleton" style={{ height: '34px', width: '90px', borderRadius: '17px' }}></div>
          ))}
        </div>
        <div className="products-grid">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="product-card" style={{ height: '340px', display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px' }}>
              <div className="skeleton" style={{ height: '160px', width: '100%', borderRadius: '12px' }}></div>
              <div className="skeleton" style={{ height: '14px', width: '60px' }}></div>
              <div className="skeleton" style={{ height: '20px', width: '80%' }}></div>
              <div className="skeleton" style={{ height: '14px', width: '100%' }}></div>
              <div className="skeleton" style={{ height: '14px', width: '90%' }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                <div className="skeleton" style={{ height: '24px', width: '60px' }}></div>
                <div className="skeleton" style={{ height: '32px', width: '80px', borderRadius: '16px' }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="menu-page">
      {/* Flying animation */}
      {flyingItem && (
        <div
          className="cart-fly-anim"
          style={{ left: flyingItem.x, top: flyingItem.y }}
        >🍽️</div>
      )}

      {/* ── Header ── */}
      <div className="menu-hero-header">
        <div className="menu-hero-content">
          <div>
            <h1 className="page-title">Notre Menu</h1>
            <p className="page-subtitle">Découvrez nos créations et passez commande en quelques clics</p>
          </div>
          <div className="menu-hero-actions">
            {/* View mode toggle */}
            <div className="view-toggle">
              <button
                className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grille"
              ><Grid3X3 size={15} /></button>
              <button
                className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                title="Liste"
              ><List size={15} /></button>
            </div>
            {/* Favorites toggle */}
            <button
              className={`fav-toggle-btn ${showFavOnly ? 'active' : ''}`}
              onClick={() => setShowFavOnly(v => !v)}
            >
              <Heart size={14} fill={showFavOnly ? 'currentColor' : 'none'} />
              <span>Favoris {favorites.length > 0 && `(${favorites.length})`}</span>
            </button>
          </div>
        </div>

        {/* ── Instant Search ── */}
        <div className="menu-search-bar-container" style={{ display: 'flex', gap: '10px', alignItems: 'center', width: '100%', maxWidth: '600px', margin: '0 auto' }}>
          <div className="menu-search-bar" ref={searchRef} style={{ flex: 1, margin: 0 }}>
            <Search size={16} className="menu-search-icon" />
            <input
              type="text"
              className="menu-search-input"
              placeholder="Rechercher un plat, ingrédient..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setSearch(e.target.value); setShowSearchDropdown(true) }}
              onFocus={() => searchQuery.length >= 2 && setShowSearchDropdown(true)}
              id="menu-search"
            />
            {searchQuery && (
              <button className="menu-search-clear" onClick={() => { setSearchQuery(''); setSearch(''); setShowSearchDropdown(false) }}>
                <X size={14} />
              </button>
            )}
            {/* Search dropdown */}
            {showSearchDropdown && searchSuggestions.length > 0 && (
              <div className="search-dropdown">
                {searchSuggestions.map(item => {
                  const rich = parseDescription(item.description)
                  return (
                    <div
                      key={item.id}
                      className="search-dropdown-item"
                      onClick={() => {
                        setSearch(item.name); setSearchQuery(item.name); setShowSearchDropdown(false)
                      }}
                    >
                      {item.imageUrl
                        ? <img src={item.imageUrl} alt={item.name} className="search-dropdown-thumb" />
                        : <div className="search-dropdown-thumb-ph">🍽️</div>
                      }
                      <div className="search-dropdown-info">
                        <span className="search-dropdown-name">{item.name}</span>
                        {rich.desc && <span className="search-dropdown-desc">{rich.desc}</span>}
                      </div>
                      <span className="search-dropdown-price">{item.price.toFixed(2)} €</span>
                      <button
                        className="search-dropdown-add"
                        onClick={e => { e.stopPropagation(); addToCart(item, e) }}
                      ><Plus size={13} /></button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          <button
            type="button"
            className={`fav-toggle-btn filter-btn ${showFiltersPanel ? 'active' : ''}`}
            onClick={() => setShowFiltersPanel(v => !v)}
            style={{ height: '44px', display: 'flex', alignItems: 'center', gap: '8px', padding: '0 16px', borderRadius: '12px', background: showFiltersPanel ? 'var(--color-primary)' : 'var(--color-surface-2)', border: '1px solid var(--color-border)', cursor: 'pointer', color: showFiltersPanel ? '#fff' : 'var(--color-text)', transition: 'all 0.2s', fontWeight: '600' }}
          >
            <Filter size={15} />
            <span>Filtres</span>
          </button>
        </div>

        {/* ── Collapsible Filters Panel (Pattern uniforme) ── */}
        <div className="filter-panel" style={{ width: '100%', maxWidth: '600px', margin: '12px auto 0' }}>
          <div className="filter-panel-header" onClick={() => setShowFiltersPanel(v => !v)}>
            <span className="filter-panel-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={13} style={{ color: 'var(--color-primary)' }} /> Filtres avancés
              {(filterMaxPrice !== 50 || excludedAllergens.length > 0 || filterVegOnly || filterGlutenFree || filterSpicy) && (
                <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '10px', background: 'var(--color-primary)', color: '#fff', fontWeight: '700', marginLeft: '6px' }}>
                  {[filterMaxPrice !== 50 && '1', excludedAllergens.length > 0 && '1', filterVegOnly && '1', filterGlutenFree && '1', filterSpicy && '1'].filter(Boolean).length}
                </span>
              )}
            </span>
            <span className={`filter-panel-toggle ${showFiltersPanel ? 'open' : ''}`} style={{ display: 'flex', alignItems: 'center' }}>
              {showFiltersPanel ? 'Masquer' : 'Afficher'} <ChevronDown size={13} style={{ marginLeft: '4px' }} />
            </span>
          </div>
          {showFiltersPanel && (
            <div className="filter-panel-body" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', background: 'var(--color-surface-2)', borderRadius: '0 0 12px 12px', borderTop: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <div className="form-group" style={{ margin: 0, flex: '1', minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label className="form-label" style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-dim)' }}>Prix max : {filterMaxPrice} €</label>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    step="1"
                    value={filterMaxPrice}
                    onChange={e => setFilterMaxPrice(Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                  />
                </div>
              </div>

              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px', margin: 0 }}>
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-dim)' }}>Préférences de filtrage</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setFilterVegOnly(v => !v)}
                    style={{ padding: '6px 12px', border: '1px solid var(--color-border)', borderRadius: '20px', background: filterVegOnly ? 'rgba(34,197,94,0.1)' : 'var(--color-surface)', color: filterVegOnly ? '#22c55e' : 'var(--color-text)', cursor: 'pointer', fontSize: '11px', fontWeight: '600', transition: 'all 0.15s' }}
                  >
                    🌿 Végétarien
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterGlutenFree(v => !v)}
                    style={{ padding: '6px 12px', border: '1px solid var(--color-border)', borderRadius: '20px', background: filterGlutenFree ? 'rgba(234,179,8,0.1)' : 'var(--color-surface)', color: filterGlutenFree ? '#eab308' : 'var(--color-text)', cursor: 'pointer', fontSize: '11px', fontWeight: '600', transition: 'all 0.15s' }}
                  >
                    🌾 Sans gluten
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterSpicy(v => !v)}
                    style={{ padding: '6px 12px', border: '1px solid var(--color-border)', borderRadius: '20px', background: filterSpicy ? 'rgba(239,68,68,0.1)' : 'var(--color-surface)', color: filterSpicy ? '#ef4444' : 'var(--color-text)', cursor: 'pointer', fontSize: '11px', fontWeight: '600', transition: 'all 0.15s' }}
                  >
                    🌶️ Épicé
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px', margin: 0 }}>
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-dim)' }}>Exclure les allergènes</label>
                <div className="allergens-selector" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {['Gluten', 'Lactose', 'Arachides', 'Fruits à coque', 'Oeufs', 'Soja'].map(allergen => {
                    const isExcluded = excludedAllergens.includes(allergen)
                    return (
                      <button
                        key={allergen}
                        type="button"
                        onClick={() => setExcludedAllergens(prev => isExcluded ? prev.filter(a => a !== allergen) : [...prev, allergen])}
                        style={{ padding: '6px 12px', border: '1px solid var(--color-border)', borderRadius: '20px', background: isExcluded ? 'rgba(239,68,68,0.1)' : 'var(--color-surface)', color: isExcluded ? '#ef4444' : 'var(--color-text)', cursor: 'pointer', fontSize: '11px', fontWeight: '600', transition: 'all 0.15s' }}
                      >
                        {isExcluded ? '✗ ' : ''}{allergen}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setFilterVegOnly(false)
                    setFilterGlutenFree(false)
                    setFilterSpicy(false)
                    setFilterMaxPrice(50)
                    setFilterMinSpice(0)
                    setExcludedAllergens([])
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Réinitialiser
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Alerts */}
      {orderSuccess && (
        <div className="alert alert-success" id="order-success">
          🎉 Commande passée avec succès ! Nous la préparons dès maintenant.
        </div>
      )}
      {error && (
        <div className="alert alert-error">
          <AlertCircle size={16} /><span>{error}</span>
        </div>
      )}

      {/* ── Sticky category nav ── */}
      <div className="menu-sticky-nav">
        <CategoryNav
          categories={categories}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
        />
      </div>

      {/* ── Products Grid / List ── */}
      <div className={viewMode === 'grid' ? 'products-grid menu-grid-enhanced' : 'products-list-view'}>
        {filteredItems.length === 0 ? (
          <div className="empty-state" style={{
            gridColumn: '1/-1',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-xl)',
            padding: '4rem 2rem',
            textAlign: 'center',
            boxShadow: 'var(--shadow-md)',
            maxWidth: '500px',
            margin: '2rem auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div className="empty-state-icon" style={{
              fontSize: '4rem',
              lineHeight: 1,
              animation: 'bounce 2s infinite',
              marginBottom: '10px'
            }}>{showFavOnly ? '💔' : '🍽️'}</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800' }}>
              {showFavOnly ? 'Aucun favori' : 'Aucun plat trouvé'}
            </h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', maxWidth: '360px', margin: '0 auto 10px' }}>
              {showFavOnly 
                ? 'Ajoutez des plats à vos favoris avec le ❤️' 
                : 'Essayez de réinitialiser vos filtres ou de modifier votre recherche.'
              }
            </p>
            {showFavOnly ? (
              <button className="btn btn-secondary btn-sm" style={{ marginTop: '0.5rem' }} onClick={() => setShowFavOnly(false)}>
                Voir tous les plats
              </button>
            ) : (
              <button className="btn btn-secondary btn-sm" style={{ marginTop: '0.5rem' }} onClick={() => {
                setSearchQuery('')
                setSearch('')
                setFilterVegOnly(false)
                setFilterGlutenFree(false)
                setFilterSpicy(false)
                setFilterMaxPrice(50)
                setFilterMinSpice(0)
                setExcludedAllergens([])
              }}>
                Réinitialiser les filtres
              </button>
            )}
          </div>
        ) : (
          filteredItems.map(item => {
            const cartItem = cart.find(i => i.id === item.id)
            const rich = parseDescription(item.description)
            const isFav = favorites.includes(item.id)

            if (viewMode === 'list') {
              return (
                <div key={item.id} id={`product-${item.id}`} className="product-list-item">
                  {item.imageUrl
                    ? <img src={item.imageUrl} alt={item.name} className="product-list-img" />
                    : <div className="product-list-img-ph">🍽️</div>
                  }
                  <div className="product-list-body">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span className="product-category">{item.category?.name}</span>
                      {(item.isVegetarian || rich.isVeg) && <span className="badge-veg" style={{ background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold' }}>🌿 Végé</span>}
                      {item.isGlutenFree && <span className="badge-gf" style={{ background: '#fef9c3', color: '#854d0e', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold' }}>🌾 Sans Gluten</span>}
                      {(item.isSpicy || (rich.spice && rich.spice > 0)) && <span className="badge-spicy" style={{ background: '#fee2e2', color: '#b91c1c', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold' }}>🌶️ Épicé</span>}
                    </div>
                    <h3 className="product-name" style={{ marginTop: '4px' }}>{item.name}</h3>
                    {rich.desc && <p className="product-description">{rich.desc}</p>}
                    <div className="product-meta-chips">
                      {rich.prepTime && <span className="meta-chip"><Clock size={11} />{rich.prepTime} min</span>}
                      {rich.calories && <span className="meta-chip calorie"><Flame size={11} />{rich.calories} kcal</span>}
                      {rich.spice && <span className="meta-chip spice">Épice <SpiceIndicator level={rich.spice} /></span>}
                      {rich.allergens && (
                        <span
                          className="meta-chip allergen"
                          title={rich.allergens}
                          style={{
                            textOverflow: 'ellipsis',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            maxWidth: '150px',
                            display: 'inline-block',
                            verticalAlign: 'middle'
                          }}
                        >
                          ⚠️ {rich.allergens}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="product-list-actions">
                    <span className="product-price">{item.price.toFixed(2)} €</span>
                    <button
                      className={`fav-btn ${isFav ? 'active' : ''}`}
                      onClick={() => toggleFavorite(item.id)}
                      title={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                    ><Heart size={14} fill={isFav ? 'currentColor' : 'none'} /></button>
                    {isDeliverer ? (
                      <span className="badge-consult">Consultation</span>
                    ) : cartItem ? (
                      <div className="quantity-controls">
                        <button className="qty-btn" onClick={() => updateQuantity(item.id, -1)}><Minus size={13} /></button>
                        <span className="qty-value">{cartItem.quantity}</span>
                        <button className="qty-btn" onClick={() => updateQuantity(item.id, 1)}><Plus size={13} /></button>
                      </div>
                    ) : (
                      <button id={`add-${item.id}`} className="btn btn-primary btn-sm" onClick={e => addToCart(item, e)}>
                        <Plus size={13} /> Ajouter
                      </button>
                    )}
                  </div>
                </div>
              )
            }

            // Grid card
            return (
              <div key={item.id} id={`product-${item.id}`} className="product-card product-card-premium">
                <div className="product-card-image-wrap">
                  {item.imageUrl
                    ? <img src={item.imageUrl} alt={item.name} className="product-image" />
                    : <div className="product-image-placeholder">🍽️</div>
                  }
                  <button
                    className={`fav-btn fav-btn-overlay ${isFav ? 'active' : ''}`}
                    onClick={() => toggleFavorite(item.id)}
                    title={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  ><Heart size={15} fill={isFav ? 'currentColor' : 'none'} /></button>
                </div>
                <div className="product-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                    <span className="product-category">{item.category?.name}</span>
                    {(item.isVegetarian || rich.isVeg) && <span style={{ fontSize: '12px' }} title="Végétarien">🌿</span>}
                    {item.isGlutenFree && <span style={{ fontSize: '12px' }} title="Sans Gluten">🌾</span>}
                    {(item.isSpicy || (rich.spice && rich.spice > 0)) && <span style={{ fontSize: '12px' }} title="Épicé">🌶️</span>}
                  </div>
                  <h3 className="product-name" style={{ marginTop: 0 }}>{item.name}</h3>
                  {rich.desc && <p className="product-description">{rich.desc}</p>}
                  <div className="product-meta-chips">
                    {rich.prepTime && <span className="meta-chip"><Clock size={10} />{rich.prepTime}min</span>}
                    {rich.calories && <span className="meta-chip calorie"><Flame size={10} />{rich.calories}kcal</span>}
                    {rich.spice && <SpiceIndicator level={rich.spice} />}
                    {rich.rating && <span className="meta-chip rating"><Star size={10} fill="#f59e0b" color="#f59e0b" />{rich.rating}</span>}
                  </div>
                  {rich.allergens && (
                    <div
                      className="allergen-tag"
                      title={rich.allergens}
                      style={{
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        maxWidth: '100%',
                        display: 'block'
                      }}
                    >
                      ⚠️ {rich.allergens}
                    </div>
                  )}
                  <div className="product-footer">
                    <span className="product-price">{item.price.toFixed(2)} €</span>
                    {isDeliverer ? (
                      <span className="badge-consult">Consultation</span>
                    ) : cartItem ? (
                      <div className="quantity-controls">
                        <button className="qty-btn" onClick={() => updateQuantity(item.id, -1)} id={`qty-minus-${item.id}`}><Minus size={13} /></button>
                        <span className="qty-value">{cartItem.quantity}</span>
                        <button className="qty-btn" onClick={() => updateQuantity(item.id, 1)} id={`qty-plus-${item.id}`}><Plus size={13} /></button>
                      </div>
                    ) : (
                      <button id={`add-${item.id}`} className="btn btn-primary btn-sm" onClick={e => addToCart(item, e)}>
                        <Plus size={13} /> Ajouter
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ── Cart FAB ── */}
      {cartCount > 0 && !isDeliverer && (
        <button id="btn-open-cart" className="cart-fab" onClick={() => setIsCartOpen(true)} ref={cartBtnRef}>
          <ShoppingCart size={20} />
          <span className="cart-fab-label">Panier</span>
          <span className="cart-fab-badge">{cartCount}</span>
          <span className="cart-fab-total">{cartTotal.toFixed(2)} €</span>
        </button>
      )}

      {/* ── Cart Modal (Multi-step) ── */}
      {isCartOpen && (
        <div className="modal-overlay" onClick={() => { if (cartStep !== 4 && paymentStep !== 'PROCESSING') setIsCartOpen(false) }}>
          <div className="modal cart-modal-steps" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            
            {/* Modal Header */}
            <div className="modal-header" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', fontWeight: '800' }}>
                <ShoppingCart size={19} />
                <span> {cartStep === 4 ? 'Commande Réussie !' : `Mon Panier — Étape ${cartStep} / 3`}</span>
              </h3>
              {cartStep !== 4 && paymentStep !== 'PROCESSING' && (
                <button className="btn-icon" onClick={() => setIsCartOpen(false)}><X size={18} /></button>
              )}
            </div>

            {/* Step indicator */}
            {cartStep < 4 && (
              <div className="cart-steps-progress" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                <div className={`step-dot-wrapper ${cartStep >= 1 ? 'active' : ''}`} onClick={() => cartStep > 1 && setCartStep(1)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: cartStep > 1 ? 'pointer' : 'default', flex: 1 }}>
                  <div className="step-dot" style={{ width: '24px', height: '24px', borderRadius: '50%', background: cartStep >= 1 ? 'var(--color-primary)' : 'var(--color-border)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold' }}>1</div>
                  <span className="step-label" style={{ fontSize: '10px', fontWeight: '600', color: cartStep >= 1 ? 'var(--color-text)' : 'var(--color-text-dim)' }}>Panier</span>
                </div>
                <div className="step-line" style={{ height: '2px', background: cartStep >= 2 ? 'var(--color-primary)' : 'var(--color-border)', flex: 1, margin: '0 8px', transform: 'translateY(-10px)' }} />
                <div className={`step-dot-wrapper ${cartStep >= 2 ? 'active' : ''}`} onClick={() => cartStep > 2 && setCartStep(2)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: cartStep > 2 ? 'pointer' : 'default', flex: 1 }}>
                  <div className="step-dot" style={{ width: '24px', height: '24px', borderRadius: '50%', background: cartStep >= 2 ? 'var(--color-primary)' : 'var(--color-border)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold' }}>2</div>
                  <span className="step-label" style={{ fontSize: '10px', fontWeight: '600', color: cartStep >= 2 ? 'var(--color-text)' : 'var(--color-text-dim)' }}>Livraison</span>
                </div>
                <div className="step-line" style={{ height: '2px', background: cartStep >= 3 ? 'var(--color-primary)' : 'var(--color-border)', flex: 1, margin: '0 8px', transform: 'translateY(-10px)' }} />
                <div className={`step-dot-wrapper ${cartStep >= 3 ? 'active' : ''}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1 }}>
                  <div className="step-dot" style={{ width: '24px', height: '24px', borderRadius: '50%', background: cartStep >= 3 ? 'var(--color-primary)' : 'var(--color-border)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold' }}>3</div>
                  <span className="step-label" style={{ fontSize: '10px', fontWeight: '600', color: cartStep >= 3 ? 'var(--color-text)' : 'var(--color-text-dim)' }}>Paiement</span>
                </div>
              </div>
            )}

            {/* Modal Body */}
            <div className="modal-body cart-modal-body" style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {cartStep === 1 && (
                <div className="cart-step-content" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {cart.length === 0 ? (
                    <div className="cart-empty" style={{ padding: '2rem 0', textAlign: 'center' }}>
                      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛒</div>
                      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Votre panier est vide</p>
                      {crossSellItems.length > 0 && (
                        <div style={{ marginTop: '1.5rem', width: '100%', textAlign: 'left' }}>
                          <p style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-dim)', marginBottom: '0.75rem' }}>
                            🌟 Nos suggestions
                          </p>
                          {crossSellItems.map(item => (
                            <div key={item.id} className="cross-sell-item">
                              {item.imageUrl
                                ? <img src={item.imageUrl} alt={item.name} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                                : <div style={{ width: 40, height: 40, background: 'var(--color-surface-3)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>🍽️</div>
                              }
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: '600' }}>{item.name}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)' }}>{item.price.toFixed(2)} €</div>
                              </div>
                              <button className="btn btn-primary btn-sm" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={e => addToCart(item, e)}>
                                <Plus size={11} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--color-text-dim)' }}>{cartCount} {cartCount > 1 ? 'articles' : 'article'}</span>
                        <button className="btn btn-danger btn-sm" onClick={() => setCart([])} style={{ fontSize: '11px', padding: '4px 8px' }}>
                          <Trash2 size={11} /> Vider
                        </button>
                      </div>
                      <div className="cart-items-list-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {cart.map(item => {
                          const isFav = favorites.includes(item.id)
                          const itemRich = parseDescription(item.description)
                          return (
                            <div key={item.id} className="cart-item" style={{ display: 'flex', gap: '12px', padding: '12px', background: 'var(--color-surface-2)', borderRadius: '10px', border: '1px solid var(--color-border)', alignItems: 'center' }}>
                              {item.imageUrl ? (
                                <img src={item.imageUrl} alt={item.name} className="cart-item-thumb" onClick={() => setSelectedItemDetail(item)} style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--color-border)', cursor: 'pointer' }} />
                              ) : (
                                <div className="cart-item-thumb-ph" onClick={() => setSelectedItemDetail(item)} style={{ width: '50px', height: '50px', background: 'var(--color-surface-3)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>🍽️</div>
                              )}
                              
                              <div className="cart-item-info" style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span className="cart-item-name" onClick={() => setSelectedItemDetail(item)} style={{ fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer' }}>{item.name}</span>
                                  <button
                                    type="button"
                                    className={`fav-btn-inline ${isFav ? 'active' : ''}`}
                                    onClick={() => toggleFavorite(item.id)}
                                    title={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: isFav ? '#ef4444' : 'var(--color-text-dim)', padding: '2px', display: 'inline-flex', alignItems: 'center' }}
                                  >
                                    <Heart size={13} fill={isFav ? 'currentColor' : 'none'} />
                                  </button>
                                </div>
                                <span className="cart-item-price" style={{ color: 'var(--color-primary)', fontWeight: '700', fontSize: '0.85rem' }}>{(item.price * item.quantity).toFixed(2)} €</span>
                                
                                <div className="cart-item-meta" style={{ display: 'flex', gap: '8px', fontSize: '10px', color: 'var(--color-text-dim)', marginTop: '2px' }}>
                                  {itemRich.calories && <span>🔥 {itemRich.calories} kcal</span>}
                                  {itemRich.prepTime && <span>⏱️ {itemRich.prepTime} min</span>}
                                </div>

                                {editingNoteId === item.id ? (
                                  <div style={{ marginTop: '6px' }}>
                                    <input
                                      type="text"
                                      className="form-input"
                                      style={{ fontSize: '11px', padding: '4px 8px' }}
                                      placeholder="Note (ex: sans sel, sauce à part...)"
                                      value={item.itemNote || ''}
                                      onChange={e => updateItemNote(item.id, e.target.value)}
                                      onBlur={() => setEditingNoteId(null)}
                                      autoFocus
                                    />
                                  </div>
                                ) : (
                                  <button
                                    className="item-note-btn"
                                    onClick={() => setEditingNoteId(item.id)}
                                    style={{ display: 'block', marginTop: '4px', background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '10px', cursor: 'pointer', padding: 0 }}
                                  >
                                    {item.itemNote ? `📝 ${item.itemNote}` : '+ Ajouter une note'}
                                  </button>
                                )}
                              </div>
                              <div className="cart-item-controls" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                                <div className="quantity-controls" style={{ display: 'flex', alignItems: 'center', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '20px', padding: '2px' }}>
                                  <button className="qty-btn" onClick={() => updateQuantity(item.id, -1)} style={{ background: 'none', border: 'none', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Minus size={11} /></button>
                                  <span className="qty-value" style={{ minWidth: '16px', textAlign: 'center', fontSize: '11px', fontWeight: 'bold' }}>{item.quantity}</span>
                                  <button className="qty-btn" onClick={() => updateQuantity(item.id, 1)} style={{ background: 'none', border: 'none', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Plus size={11} /></button>
                                </div>
                                <button className="btn-icon btn-danger" onClick={() => removeFromCart(item.id)} style={{ padding: '4px' }}><Trash2 size={13} /></button>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Suggestions list (cross-sell) styled as cart-items */}
                      {crossSellItems.length > 0 && (
                        <div className="cross-sell-section" style={{ marginTop: '16px', borderTop: '1px dashed var(--color-border)', paddingTop: '16px' }}>
                          <p className="cross-sell-title" style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text)', marginBottom: '12px' }}>
                            <Star size={14} style={{ color: '#f59e0b', fill: '#f59e0b' }} /> Vous aimerez aussi
                          </p>
                          <div className="cross-sell-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {crossSellItems.map(item => {
                              const itemRich = parseDescription(item.description)
                              const isFav = favorites.includes(item.id)
                              return (
                                <div key={item.id} className="cart-item" style={{ display: 'flex', gap: '12px', padding: '12px', background: 'var(--color-surface-2)', borderRadius: '10px', border: '1px solid var(--color-border)', alignItems: 'center' }}>
                                  {item.imageUrl ? (
                                    <img src={item.imageUrl} alt={item.name} className="cart-item-thumb" onClick={() => setSelectedItemDetail(item)} style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--color-border)', cursor: 'pointer' }} />
                                  ) : (
                                    <div className="cart-item-thumb-ph" onClick={() => setSelectedItemDetail(item)} style={{ width: '50px', height: '50px', background: 'var(--color-surface-3)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>🍽️</div>
                                  )}
                                  
                                  <div className="cart-item-info" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span className="cart-item-name" onClick={() => setSelectedItemDetail(item)} style={{ fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer' }}>{item.name}</span>
                                      <button
                                        type="button"
                                        onClick={() => toggleFavorite(item.id)}
                                        title={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: isFav ? '#ef4444' : 'var(--color-text-dim)', padding: '2px', display: 'inline-flex', alignItems: 'center' }}
                                      >
                                        <Heart size={13} fill={isFav ? 'currentColor' : 'none'} />
                                      </button>
                                    </div>
                                    <span className="cart-item-price" style={{ color: 'var(--color-primary)', fontWeight: '700', fontSize: '0.85rem' }}>{item.price.toFixed(2)} €</span>
                                    
                                    {(itemRich.calories || itemRich.prepTime) && (
                                      <div className="cart-item-meta" style={{ display: 'flex', gap: '8px', fontSize: '10px', color: 'var(--color-text-dim)', marginTop: '2px' }}>
                                        {itemRich.calories && <span>🔥 {itemRich.calories} kcal</span>}
                                        {itemRich.prepTime && <span>⏱️ {itemRich.prepTime} min</span>}
                                      </div>
                                    )}
                                  </div>

                                  <button
                                    className="btn btn-primary"
                                    onClick={e => addToCart(item, e)}
                                    style={{ padding: '6px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '20px' }}
                                  >
                                    <Plus size={13} /> Ajouter
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {cartStep === 2 && (
                <div className="cart-step-content" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Delivery / Pickup toggle */}
                  <div className="delivery-toggle-section" style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className={`delivery-mode-btn ${!withDelivery ? 'active' : ''}`}
                      onClick={() => setWithDelivery(false)}
                      style={{ flex: 1, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '10px', border: '1px solid var(--color-border)', background: !withDelivery ? 'var(--color-primary)' : 'var(--color-surface-2)', color: !withDelivery ? '#fff' : 'var(--color-text)', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      <UtensilsCrossed size={15} /> À emporter
                    </button>
                    <button
                      className={`delivery-mode-btn ${withDelivery ? 'active' : ''}`}
                      onClick={() => setWithDelivery(true)}
                      style={{ flex: 1, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '10px', border: '1px solid var(--color-border)', background: withDelivery ? 'var(--color-primary)' : 'var(--color-surface-2)', color: withDelivery ? '#fff' : 'var(--color-text)', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      <Truck size={15} /> Livraison
                    </button>
                  </div>

                  {/* Free delivery progress */}
                  {withDelivery && cartTotal < FREE_DELIVERY_THRESHOLD && (
                    <div className="free-delivery-bar" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div className="free-delivery-text" style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Zap size={13} style={{ color: '#f59e0b' }} />
                        <span>Plus que <strong>{remainingForFreeDelivery.toFixed(2)} €</strong> pour la livraison gratuite !</span>
                      </div>
                      <div className="free-delivery-progress" style={{ height: '6px', background: 'var(--color-surface-3)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div className="free-delivery-fill" style={{ height: '100%', background: 'var(--color-primary)', width: `${freeDeliveryProgress}%`, transition: 'width 0.3s' }} />
                      </div>
                    </div>
                  )}
                  {withDelivery && cartTotal >= FREE_DELIVERY_THRESHOLD && (
                    <div className="free-delivery-bar free-delivery-achieved" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(34,197,94,0.2)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Check size={13} /> <strong>Livraison gratuite débloquée ! 🎉</strong>
                    </div>
                  )}

                  {/* Delivery address */}
                  {withDelivery && (
                    <div className="cart-address-section" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', fontWeight: 'bold' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={12} />Adresse de livraison</span>
                        {addressStatus === 'VALID' && <span style={{ color: '#22c55e' }}>✓ Validée</span>}
                        {addressStatus === 'FORCED' && <span style={{ color: '#f59e0b' }}>⚠️ Forcée</span>}
                        {addressStatus === 'UNCHECKED' && deliveryAddress.length >= 5 && <span style={{ color: '#ef4444' }}>✗ Non validée</span>}
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          id="delivery-address"
                          type="text"
                          className="form-input"
                          placeholder="Entrez votre adresse..."
                          value={deliveryAddress}
                          onChange={e => handleAddressChange(e.target.value)}
                          autoComplete="off"
                        />
                        {isValidatingAddress && <div style={{ fontSize: '11px', color: 'var(--color-text-dim)', marginTop: '4px' }}>Recherche…</div>}
                        {suggestions.length > 0 && (
                          <div className="address-suggestions" style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', zIndex: 200, maxHeight: '160px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                            {suggestions.map((s, idx) => (
                              <div key={idx} className="address-suggestion-item" onClick={() => selectSuggestion(s.label)} style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--color-border)', fontSize: '12px' }}>
                                <MapPin size={12} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                                {s.label}
                              </div>
                            ))}
                          </div>
                        )}
                        {addressStatus === 'UNCHECKED' && deliveryAddress.length >= 5 && !isValidatingAddress && (
                          <div className="address-warning" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', padding: '10px', borderRadius: '8px', marginTop: '8px' }}>
                            <div style={{ fontWeight: '600', marginBottom: '4px', fontSize: '11px', color: '#f59e0b' }}>⚠️ Adresse non répertoriée</div>
                            <button type="button" onClick={forceManualValidation} className="btn btn-danger btn-sm" style={{ fontSize: '11px', padding: '4px 8px' }}>
                              Utiliser quand même
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* General Notes */}
                  <div className="cart-notes" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label className="form-label" htmlFor="cart-notes" style={{ fontSize: '11px', fontWeight: 'bold' }}>Notes de commande (optionnel)</label>
                    <textarea
                      id="cart-notes"
                      className="form-input"
                      placeholder="Allergies, instructions spéciales de livraison..."
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
              )}

              {cartStep === 3 && (
                <div className="cart-step-content" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Payment method selection */}
                  <div className="payment-methods">
                    <label className="form-label" style={{ marginBottom: '8px', display: 'block', fontSize: '11px', fontWeight: 'bold' }}>Mode de paiement</label>
                    <div className="payment-method-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      {([
                        { id: 'CREDIT_CARD', icon: <CreditCard size={16} />, label: 'Carte' },
                        { id: 'PAYPAL', icon: <span style={{ fontSize: '14px', fontWeight: 'bold' }}>P</span>, label: 'PayPal' },
                        { id: 'CASH', icon: <span style={{ fontSize: '14px' }}>💵</span>, label: 'Espèces' },
                      ] as const).map(m => (
                        <button
                          key={m.id}
                          type="button"
                          className={`payment-method-btn ${paymentMethod === m.id ? 'active' : ''}`}
                          onClick={() => setPaymentMethod(m.id)}
                          style={{ padding: '10px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', borderRadius: '8px', border: '1px solid var(--color-border)', background: paymentMethod === m.id ? 'var(--color-primary)' : 'var(--color-surface-2)', color: paymentMethod === m.id ? '#fff' : 'var(--color-text)', cursor: 'pointer', transition: 'all 0.15s' }}
                        >
                          {m.icon}
                          <span style={{ fontSize: '11px' }}>{m.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Payment Forms */}
                  {paymentStep === 'FORM' && (
                    <div className="payment-form-inputs">
                      {paymentMethod === 'CREDIT_CARD' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {/* Visual card */}
                          <div className="payment-card-preview" style={{ background: 'linear-gradient(135deg, var(--color-primary), #d97706)', padding: '16px', borderRadius: '12px', color: '#fff', boxShadow: '0 4px 15px rgba(249,115,22,0.3)', marginBottom: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <span style={{ fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px' }}>SECURE CARD</span>
                              <span style={{ fontSize: '16px', fontStyle: 'italic', fontWeight: 'bold' }}>Visa</span>
                            </div>
                            <div style={{ fontSize: '15px', letterSpacing: '2px', margin: '14px 0 8px', textAlign: 'center', fontFamily: 'monospace' }}>
                              {cardNumber ? cardNumber.replace(/(\d{4})/g, '$1 ').trim() : '•••• •••• •••• ••••'}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                              <div><div style={{ opacity: 0.7, marginBottom: '2px' }}>CARDHOLDER</div><div style={{ textTransform: 'uppercase', letterSpacing: '1px' }}>{cardHolder || 'NOM PRENOM'}</div></div>
                              <div><div style={{ opacity: 0.7, marginBottom: '2px' }}>EXPIRES</div><div>{cardExpiry || 'MM/YY'}</div></div>
                            </div>
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: '11px' }}>Nom du titulaire</label>
                            <input type="text" className="form-input" placeholder="Jean Dupont" value={cardHolder} onChange={e => setCardHolder(e.target.value)} />
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: '11px' }}>Numéro de carte</label>
                            <input type="text" maxLength={16} className="form-input" placeholder="1234567890123456" value={cardNumber} onChange={e => setCardNumber(e.target.value.replace(/\D/g, ''))} />
                          </div>
                          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div className="form-group" style={{ margin: 0 }}>
                              <label className="form-label" style={{ fontSize: '11px' }}>Expiration</label>
                              <input type="text" maxLength={5} placeholder="MM/YY" className="form-input" value={cardExpiry} onChange={e => setCardExpiry(e.target.value)} />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                              <label className="form-label" style={{ fontSize: '11px' }}>CVV</label>
                              <input type="password" maxLength={3} placeholder="123" className="form-input" value={cardCvv} onChange={e => setCardCvv(e.target.value.replace(/\D/g, ''))} />
                            </div>
                          </div>
                        </div>
                      )}

                      {paymentMethod === 'PAYPAL' && (
                        <div style={{ textAlign: 'center', padding: '10px 0' }}>
                          <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>💳</div>
                          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '12px' }}>Paiement via PayPal pour <strong style={{ color: 'var(--color-primary)' }}>{cartTotal.toFixed(2)} €</strong></p>
                          <div className="form-group" style={{ textAlign: 'left', margin: 0 }}>
                            <label className="form-label">Email PayPal</label>
                            <input type="email" className="form-input" placeholder="nom@exemple.com" value={paypalEmail} onChange={e => setPaypalEmail(e.target.value)} />
                          </div>
                        </div>
                      )}

                      {paymentMethod === 'CASH' && (
                        <div style={{ textAlign: 'center', padding: '15px 0' }}>
                          <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>💵</div>
                          <p style={{ color: 'var(--color-text)', fontWeight: '500', fontSize: '0.9rem' }}>Règlement en espèces à la livraison.</p>
                          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: '6px' }}>
                            Total à payer : <strong style={{ color: 'var(--color-primary)' }}>{(cartTotal + (withDelivery ? deliveryFee : 0)).toFixed(2)} €</strong>
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {paymentStep === 'PROCESSING' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '2rem 0' }}>
                      <div className="loading-spinner" style={{ marginBottom: '1rem' }}></div>
                      <h4 style={{ fontWeight: '700', marginBottom: '6px' }}>Traitement de la transaction…</h4>
                      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Connexion sécurisée en cours. Veuillez ne pas fermer cette fenêtre.</p>
                    </div>
                  )}
                </div>
              )}

              {cartStep === 4 && (
                <div className="cart-step-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '2.5rem 1rem' }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(34,197,94,0.1)', color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', marginBottom: '1rem', fontWeight: 'bold' }}>✓</div>
                  <h4 style={{ fontWeight: '800', color: '#22c55e', marginBottom: '8px', fontSize: '1.2rem' }}>Paiement approuvé !</h4>
                  <p style={{ color: 'var(--color-text)', fontSize: '0.875rem', fontWeight: '600', marginBottom: '4px' }}>Merci pour votre commande.</p>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginBottom: '20px' }}>Votre commande est enregistrée et en cours de préparation. Vous pouvez suivre son évolution sur votre espace commandes.</p>
                  
                  <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                    <button
                      onClick={() => {
                        setIsCartOpen(false)
                        setCartStep(1)
                        setOrderSuccess(false)
                      }}
                      className="btn btn-secondary"
                      style={{ flex: 1 }}
                    >
                      Fermer
                    </button>
                    <button
                      onClick={() => {
                        setIsCartOpen(false)
                        setCartStep(1)
                        setOrderSuccess(false)
                        navigate('/orders')
                      }}
                      className="btn btn-primary"
                      style={{ flex: 1 }}
                    >
                      Mes Commandes
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            {cartStep < 4 && (
              <div className="modal-footer cart-modal-footer" style={{ borderTop: '1px solid var(--color-border)', paddingTop: '14px', display: 'flex', gap: '8px' }}>
                {withDelivery && cartStep === 2 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '0.75rem', color: 'var(--color-text-dim)', marginBottom: '8px', gridColumn: '1 / -1' }}>
                    <span>Frais de livraison</span>
                    <span style={{ fontWeight: 'bold' }}>
                      {cartTotal >= FREE_DELIVERY_THRESHOLD ? '🎉 Gratuit' : `+${deliveryFee.toFixed(2)} €`}
                    </span>
                  </div>
                )}
                
                {cartStep > 1 && paymentStep !== 'PROCESSING' && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setCartStep(prev => prev - 1)}
                    style={{ flex: 1 }}
                  >
                    Retour
                  </button>
                )}
                
                {cartStep === 1 && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setCartStep(2)}
                    disabled={cart.length === 0}
                    style={{ flex: 2 }}
                  >
                    Continuer (Livraison) — {cartTotal.toFixed(2)} €
                  </button>
                )}

                {cartStep === 2 && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setCartStep(3)}
                    disabled={withDelivery && (!deliveryAddress || addressStatus === 'UNCHECKED')}
                    style={{ flex: 2 }}
                  >
                    Paiement — {(cartTotal + (withDelivery && cartTotal < FREE_DELIVERY_THRESHOLD ? deliveryFee : 0)).toFixed(2)} €
                  </button>
                )}

                {cartStep === 3 && paymentStep === 'FORM' && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleConfirmMockPayment()}
                    disabled={isOrdering}
                    style={{ flex: 2 }}
                  >
                    {isOrdering ? 'Paiement en cours...' : `Confirmer & Payer — ${(cartTotal + (withDelivery && cartTotal < FREE_DELIVERY_THRESHOLD ? deliveryFee : 0)).toFixed(2)} €`}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Détails du Plat */}
      {selectedItemDetail && (() => {
        const rich = parseDescription(selectedItemDetail.description)
        const isFav = favorites.includes(selectedItemDetail.id)
        return (
          <div className="modal-overlay" onClick={() => setSelectedItemDetail(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px', overflow: 'hidden', padding: 0, position: 'relative' }}>
              
              {/* Heart button in the top right corner */}
              <button
                type="button"
                onClick={() => toggleFavorite(selectedItemDetail.id)}
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  zIndex: 50,
                  background: 'rgba(0, 0, 0, 0.5)',
                  border: 'none',
                  cursor: 'pointer',
                  color: isFav ? '#ef4444' : '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px',
                  borderRadius: '50%',
                  backdropFilter: 'blur(4px)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  transition: 'transform 0.2s',
                }}
                title={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              >
                <Heart size={18} fill={isFav ? 'currentColor' : 'none'} />
              </button>

              {/* Hero image */}
              {selectedItemDetail.imageUrl ? (
                <div style={{ position: 'relative', height: '240px', overflow: 'hidden' }}>
                  <img
                    src={selectedItemDetail.imageUrl}
                    alt={selectedItemDetail.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 50%)' }} />
                  <div style={{ position: 'absolute', bottom: '16px', left: '20px', right: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <h3 style={{ margin: 0, fontWeight: '900', fontSize: '1.4rem', color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>{selectedItemDetail.name}</h3>
                    <span style={{ fontSize: '1.3rem', fontWeight: '900', color: '#fff', background: 'var(--color-primary)', padding: '4px 12px', borderRadius: '20px', flexShrink: 0, marginLeft: '12px' }}>
                      {selectedItemDetail.price.toFixed(2)} €
                    </span>
                  </div>
                </div>
              ) : (
                <div style={{ height: '160px', background: 'linear-gradient(135deg, var(--color-surface-2), var(--color-border))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '56px' }}>
                  🍔
                </div>
              )}

              <div style={{ padding: '20px 24px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontWeight: '800', fontSize: '1.2rem', color: 'var(--color-text)' }}>{selectedItemDetail.name}</h3>
                  {!selectedItemDetail.imageUrl && <span style={{ fontSize: '1.2rem', fontWeight: '900', color: 'var(--color-primary)' }}>{selectedItemDetail.price.toFixed(2)} €</span>}
                </div>

                {rich.desc && (
                  <p style={{ fontSize: '13.5px', color: 'var(--color-text-muted)', margin: '0 0 16px', lineHeight: 1.6 }}>{rich.desc}</p>
                )}

                {(rich.prepTime || rich.calories || rich.allergens) && (
                  <div style={{ display: 'flex', gap: '8px', fontSize: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
                    {rich.prepTime && (
                      <span style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-dim)', padding: '5px 10px', borderRadius: '8px', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}>
                        ⏱️ {rich.prepTime} min
                      </span>
                    )}
                    {rich.calories && (
                      <span style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-dim)', padding: '5px 10px', borderRadius: '8px', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}>
                        🔥 {rich.calories} kcal
                      </span>
                    )}
                    {rich.allergens && (
                      <span style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '5px 10px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)', fontWeight: '600' }}>
                        ⚠️ Allergènes : {rich.allergens}
                      </span>
                    )}
                  </div>
                )}

                {selectedItemDetail.category && (
                  <div style={{ marginBottom: '16px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-dim)', background: 'var(--color-surface-2)', padding: '3px 10px', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
                      {typeof selectedItemDetail.category === 'object' ? selectedItemDetail.category.name : selectedItemDetail.category}
                    </span>
                  </div>
                )}

                <button className="btn btn-secondary btn-full" onClick={() => setSelectedItemDetail(null)} style={{ marginTop: '4px' }}>
                   Fermer
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

export default MenuPage
