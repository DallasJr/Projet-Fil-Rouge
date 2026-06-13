import { useState, useEffect } from 'react'
import { ShoppingCart, Plus, Minus, Trash2, Send, Tag, Search, AlertCircle, MapPin, CreditCard } from 'lucide-react'
import { getCategories, getItems } from '../api/menu.api'
import { createOrder } from '../api/orders.api'
import type { Category, Item } from '../api/menu.api'
import type { OrderItemPayload } from '../api/orders.api'

// ID du restaurant — en production, vient d'un contexte ou d'une sélection
const RESTAURANT_ID = import.meta.env.VITE_RESTAURANT_ID || ''

interface CartItem extends Item {
  quantity: number
}

const MenuPage = () => {
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [notes, setNotes] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [withDelivery, setWithDelivery] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'CREDIT_CARD' | 'PAYPAL' | 'CASH'>('CREDIT_CARD')
  const [isCartOpen, setIsCartOpen] = useState(false)
  
  // Simulation de paiement
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [paymentStep, setPaymentStep] = useState<'FORM' | 'PROCESSING' | 'SUCCESS'>('FORM')
  const [cardHolder, setCardHolder] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCvv, setCardCvv] = useState('')
  const [paypalEmail, setPaypalEmail] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isOrdering, setIsOrdering] = useState(false)
  const [orderSuccess, setOrderSuccess] = useState(false)
  const [error, setError] = useState('')
  const [restaurantId, setRestaurantId] = useState(RESTAURANT_ID)

  // Address validation suggestions states
  const [suggestions, setSuggestions] = useState<{ label: string }[]>([])
  const [isValidatingAddress, setIsValidatingAddress] = useState(false)
  const [addressStatus, setAddressStatus] = useState<'UNCHECKED' | 'VALID' | 'FORCED'>('UNCHECKED')

  const handleAddressChange = async (val: string) => {
    setDeliveryAddress(val)
    setAddressStatus('UNCHECKED')
    
    if (val.trim().length < 5) {
      setSuggestions([])
      return
    }
    
    setIsValidatingAddress(true)
    try {
      const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(val)}&limit=5`)
      const data = await res.json()
      if (data.features) {
        setSuggestions(data.features.map((f: any) => ({
          label: f.properties.label
        })))
      }
    } catch (err) {
      console.error("Erreur de recherche d'adresse", err)
    } finally {
      setIsValidatingAddress(false)
    }
  }

  const selectSuggestion = (label: string) => {
    setDeliveryAddress(label)
    setSuggestions([])
    setAddressStatus('VALID')
  }

  const forceManualValidation = () => {
    setSuggestions([])
    setAddressStatus('FORCED')
  }

  useEffect(() => {
    // Si pas d'ID en env, on essaie de le récupérer via l'API
    const fetchData = async () => {
      try {
        const [cats, its] = await Promise.all([getCategories(), getItems()])
        setCategories(cats)
        setItems(its)
        // Récupérer le restaurantId depuis la première catégorie
        if (cats.length > 0 && !restaurantId) {
          setRestaurantId(cats[0].restaurantId)
        }
      } catch {
        setError('Impossible de charger le menu. Vérifiez que le backend est démarré.')
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  const filteredItems = items.filter(
    (item) =>
      item.isAvailable &&
      (selectedCategory === '' || item.categoryId === selectedCategory) &&
      item.name.toLowerCase().includes(search.toLowerCase())
  )

  const addToCart = (item: Item) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id)
      if (existing) return prev.map((i) => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { ...item, quantity: 1 }]
    })
  }

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev.map((i) => i.id === id ? { ...i, quantity: i.quantity + delta } : i).filter((i) => i.quantity > 0)
    )
  }

  const removeFromCart = (id: string) => setCart((prev) => prev.filter((i) => i.id !== id))

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0)

  const startPaymentProcess = () => {
    setPaymentStep('FORM')
    setIsPaymentModalOpen(true)
  }

  const handleConfirmMockPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    setPaymentStep('PROCESSING')
    
    // Simulation du temps de traitement bancaire / PayPal / Espèces
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setPaymentStep('SUCCESS')
    await new Promise((resolve) => setTimeout(resolve, 1000))
    
    await handleOrder()
    setIsPaymentModalOpen(false)
  }

  const handleOrder = async () => {
    if (cart.length === 0) return
    if (!restaurantId) {
      setError("Aucun restaurant disponible. Demandez à l'admin de créer un restaurant.")
      return
    }
    setIsOrdering(true)
    setError('')
    try {
      const orderItems: OrderItemPayload[] = cart.map((i) => ({ itemId: i.id, quantity: i.quantity }))
      await createOrder({
        restaurantId,
        items: orderItems,
        note: notes || undefined,
        deliveryAddress: withDelivery && deliveryAddress ? deliveryAddress : undefined,
        paymentMethod: withDelivery ? paymentMethod : undefined,
      })
      setCart([])
      setNotes('')
      setDeliveryAddress('')
      setSuggestions([])
      setAddressStatus('UNCHECKED')
      setIsCartOpen(false)
      setOrderSuccess(true)
      setTimeout(() => setOrderSuccess(false), 5000)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de la commande.')
    } finally {
      setIsOrdering(false)
    }
  }

  if (isLoading) return <div className="loading-screen"><div className="loading-spinner"></div></div>

  return (
    <div className="menu-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Notre Menu</h1>
          <p className="page-subtitle">Découvrez nos plats et passez votre commande</p>
        </div>
      </div>

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

      {/* Contrôles */}
      <div className="menu-controls">
        <div className="search-wrapper">
          <Search size={16} className="input-icon" />
          <input
            id="menu-search"
            type="text"
            className="form-input search-input"
            placeholder="Rechercher un plat..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="category-filters">
          <button id="filter-all" className={`filter-chip ${selectedCategory === '' ? 'active' : ''}`} onClick={() => setSelectedCategory('')}>
            <Tag size={13} /> Tous
          </button>
          {categories.map((cat) => (
            <button key={cat.id} id={`filter-${cat.id}`} className={`filter-chip ${selectedCategory === cat.id ? 'active' : ''}`} onClick={() => setSelectedCategory(cat.id)}>
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Grille produits */}
      <div className="products-grid">
        {filteredItems.length === 0 ? (
          <div className="empty-state" style={{ gridColumn: '1/-1' }}>
            <div className="empty-state-icon">🍽️</div>
            <h2>Aucun plat trouvé</h2>
            <p>Essayez une autre catégorie ou un autre terme de recherche.</p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const cartItem = cart.find((i) => i.id === item.id)
            return (
              <div key={item.id} id={`product-${item.id}`} className="product-card">
                {item.imageUrl
                  ? <img src={item.imageUrl} alt={item.name} className="product-image" />
                  : <div className="product-image-placeholder">🍽️</div>
                }
                <div className="product-info">
                  <span className="product-category">{item.category?.name}</span>
                  <h3 className="product-name">{item.name}</h3>
                  {item.description && <p className="product-description">{item.description}</p>}
                  <div className="product-footer">
                    <span className="product-price">{item.price.toFixed(2)} €</span>
                    {cartItem ? (
                      <div className="quantity-controls">
                        <button className="qty-btn" onClick={() => updateQuantity(item.id, -1)} id={`qty-minus-${item.id}`}><Minus size={13} /></button>
                        <span className="qty-value">{cartItem.quantity}</span>
                        <button className="qty-btn" onClick={() => updateQuantity(item.id, 1)} id={`qty-plus-${item.id}`}><Plus size={13} /></button>
                      </div>
                    ) : (
                      <button id={`add-${item.id}`} className="btn btn-primary btn-sm" onClick={() => addToCart(item)}>
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

      {/* FAB Panier */}
      {cartCount > 0 && (
        <button id="btn-open-cart" className="cart-fab" onClick={() => setIsCartOpen(true)}>
          <ShoppingCart size={20} />
          <span className="cart-fab-label">Panier</span>
          <span className="cart-fab-badge">{cartCount}</span>
          <span className="cart-fab-total">{cartTotal.toFixed(2)} €</span>
        </button>
      )}

      {/* Panneau Panier */}
      {isCartOpen && (
        <div className="cart-overlay" onClick={() => setIsCartOpen(false)}>
          <div className="cart-panel" onClick={(e) => e.stopPropagation()}>
            <div className="cart-header">
              <h2 className="cart-title"><ShoppingCart size={19} /> Mon Panier</h2>
              <button className="btn-icon" onClick={() => setIsCartOpen(false)} id="btn-close-cart">✕</button>
            </div>

            <div className="cart-items">
              {cart.map((item) => (
                <div key={item.id} className="cart-item">
                  <div className="cart-item-info">
                    <span className="cart-item-name">{item.name}</span>
                    <span className="cart-item-price">{(item.price * item.quantity).toFixed(2)} €</span>
                  </div>
                  <div className="cart-item-controls">
                    <button className="qty-btn" onClick={() => updateQuantity(item.id, -1)}><Minus size={12} /></button>
                    <span className="qty-value">{item.quantity}</span>
                    <button className="qty-btn" onClick={() => updateQuantity(item.id, 1)}><Plus size={12} /></button>
                    <button className="btn-icon btn-danger" onClick={() => removeFromCart(item.id)} id={`remove-${item.id}`}><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>

            {/* Options livraison */}
            <div className="cart-options">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  id="with-delivery"
                  checked={withDelivery}
                  onChange={(e) => setWithDelivery(e.target.checked)}
                />
                <span className="toggle-text"><MapPin size={14} /> Livraison à domicile</span>
              </label>
              {withDelivery && (
                <div className="form-group" style={{ marginTop: '0.5rem', position: 'relative' }}>
                  <label className="form-label" htmlFor="delivery-address" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Adresse de livraison</span>
                    {addressStatus === 'VALID' && (
                      <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 'bold' }}>✓ Validée</span>
                    )}
                    {addressStatus === 'FORCED' && (
                      <span style={{ fontSize: '11px', color: '#ea580c', fontWeight: 'bold' }}>⚠️ Validation forcée</span>
                    )}
                    {addressStatus === 'UNCHECKED' && deliveryAddress.trim().length >= 5 && (
                      <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 'bold' }}>✗ Non validée</span>
                    )}
                  </label>
                  <input
                    id="delivery-address"
                    type="text"
                    className="form-input"
                    placeholder="Entrez votre adresse..."
                    value={deliveryAddress}
                    onChange={(e) => handleAddressChange(e.target.value)}
                    autoComplete="off"
                  />

                  {isValidatingAddress && (
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                      Recherche de l'adresse...
                    </div>
                  )}

                  {suggestions.length > 0 && (
                    <div style={{
                      backgroundColor: 'white',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      marginTop: '4px',
                      maxHeight: '150px',
                      overflowY: 'auto',
                      position: 'absolute',
                      zIndex: 100,
                      width: '100%',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)'
                    }}>
                      {suggestions.map((s, idx) => (
                        <div
                          key={idx}
                          onClick={() => selectSuggestion(s.label)}
                          style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            borderBottom: idx < suggestions.length - 1 ? '1px solid #f1f5f9' : 'none',
                            color: '#1e293b'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          📍 {s.label}
                        </div>
                      ))}
                    </div>
                  )}

                  {addressStatus === 'UNCHECKED' && deliveryAddress.trim().length >= 5 && !isValidatingAddress && (
                    <div style={{
                      marginTop: '8px',
                      padding: '8px',
                      backgroundColor: '#fef2f2',
                      border: '1px solid #fee2e2',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: '#991b1b',
                      lineHeight: '1.4'
                    }}>
                      <div style={{ fontWeight: '600', marginBottom: '4px' }}>⚠️ Adresse non répertoriée</div>
                      <div>Veuillez sélectionner une suggestion dans la liste ou :</div>
                      <button
                        type="button"
                        onClick={forceManualValidation}
                        style={{
                          marginTop: '6px',
                          padding: '4px 8px',
                          fontSize: '11px',
                          backgroundColor: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: '600'
                        }}
                      >
                        Utiliser cette adresse quand même
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Mode de paiement */}
            {withDelivery && (
              <div className="payment-method-section" style={{ marginTop: '1.2rem', padding: '0 1rem' }}>
                <label className="form-label" style={{ fontWeight: '600', color: '#334155' }}>Mode de paiement</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '6px' }}>
                  <button
                    type="button"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '10px 4px',
                      borderRadius: '8px',
                      border: paymentMethod === 'CREDIT_CARD' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                      backgroundColor: paymentMethod === 'CREDIT_CARD' ? '#f0f9ff' : '#fff',
                      color: paymentMethod === 'CREDIT_CARD' ? '#0284c7' : '#475569',
                      cursor: 'pointer',
                      fontWeight: '600',
                      transition: 'all 0.2s',
                      fontSize: '11px',
                      gap: '4px'
                    }}
                    onClick={() => setPaymentMethod('CREDIT_CARD')}
                  >
                    <CreditCard size={16} />
                    <span>Carte</span>
                  </button>
                  <button
                    type="button"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '10px 4px',
                      borderRadius: '8px',
                      border: paymentMethod === 'PAYPAL' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                      backgroundColor: paymentMethod === 'PAYPAL' ? '#f0f9ff' : '#fff',
                      color: paymentMethod === 'PAYPAL' ? '#0284c7' : '#475569',
                      cursor: 'pointer',
                      fontWeight: '600',
                      transition: 'all 0.2s',
                      fontSize: '11px',
                      gap: '4px'
                    }}
                    onClick={() => setPaymentMethod('PAYPAL')}
                  >
                    <span style={{ fontSize: '15px', fontWeight: 'bold', lineHeight: '16px' }}>P</span>
                    <span>PayPal</span>
                  </button>
                  <button
                    type="button"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '10px 4px',
                      borderRadius: '8px',
                      border: paymentMethod === 'CASH' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                      backgroundColor: paymentMethod === 'CASH' ? '#f0f9ff' : '#fff',
                      color: paymentMethod === 'CASH' ? '#0284c7' : '#475569',
                      cursor: 'pointer',
                      fontWeight: '600',
                      transition: 'all 0.2s',
                      fontSize: '11px',
                      gap: '4px'
                    }}
                    onClick={() => setPaymentMethod('CASH')}
                  >
                    <span style={{ fontSize: '15px', lineHeight: '16px' }}>💵</span>
                    <span>Espèces</span>
                  </button>
                </div>
              </div>
            )}

            <div className="cart-notes">
              <label className="form-label" htmlFor="cart-notes">Notes (optionnel)</label>
              <textarea
                id="cart-notes"
                className="form-input"
                placeholder="Allergies, instructions spéciales..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            <div className="cart-footer">
              <div className="cart-total">
                <span>Total</span>
                <span className="cart-total-amount">{cartTotal.toFixed(2)} €</span>
              </div>
              {withDelivery && <div className="cart-delivery-fee"><CreditCard size={13} /> +2.50 € de frais de livraison</div>}
              <button id="btn-confirm-order" className="btn btn-primary btn-full" onClick={startPaymentProcess} disabled={isOrdering || (withDelivery && (!deliveryAddress || addressStatus === 'UNCHECKED'))}>
                <Send size={15} /> Passer au paiement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Simulation de Paiement Premium */}
      {isPaymentModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '16px'
        }} onClick={() => paymentStep !== 'PROCESSING' && setIsPaymentModalOpen(false)}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '460px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            padding: '28px',
            position: 'relative',
            overflow: 'hidden'
          }} onClick={(e) => e.stopPropagation()}>
            
            {paymentStep === 'FORM' && (
              <form onSubmit={handleConfirmMockPayment}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ margin: 0, fontSize: '19px', fontWeight: '800', color: '#0f172a' }}>
                    💰 Validation du paiement
                  </h3>
                  <button type="button" onClick={() => setIsPaymentModalOpen(false)} style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>✕</button>
                </div>

                {paymentMethod === 'CREDIT_CARD' && (
                  <div>
                    {/* Visual Card Preview */}
                    <div style={{
                      background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
                      borderRadius: '16px',
                      padding: '20px',
                      color: 'white',
                      fontFamily: '"Courier New", Courier, monospace',
                      boxShadow: '0 10px 15px -3px rgba(6, 182, 212, 0.4)',
                      marginBottom: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      height: '160px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px' }}>SECURE CARD</span>
                        <span style={{ fontSize: '20px', fontStyle: 'italic', fontWeight: 'bold' }}>Visa</span>
                      </div>
                      <div style={{ fontSize: '18px', letterSpacing: '3px', margin: '15px 0 10px', textAlign: 'center' }}>
                        {cardNumber ? cardNumber.replace(/(\d{4})/g, '$1 ').trim() : '•••• •••• •••• ••••'}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                        <div>
                          <div style={{ opacity: 0.7, fontSize: '8px', marginBottom: '2px' }}>CARDHOLDER</div>
                          <div style={{ textTransform: 'uppercase', letterSpacing: '1px' }}>{cardHolder || 'NOM PRENOM'}</div>
                        </div>
                        <div>
                          <div style={{ opacity: 0.7, fontSize: '8px', marginBottom: '2px' }}>EXPIRES</div>
                          <div>{cardExpiry || 'MM/YY'}</div>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '12px', fontWeight: '600' }}>Nom du titulaire</label>
                        <input
                          type="text"
                          required
                          className="form-input"
                          placeholder="Jean Dupont"
                          value={cardHolder}
                          onChange={(e) => setCardHolder(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '12px', fontWeight: '600' }}>Numéro de carte</label>
                        <input
                          type="text"
                          required
                          maxLength={16}
                          pattern="\d{16}"
                          className="form-input"
                          placeholder="1234567890123456"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, ''))}
                        />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '12px', fontWeight: '600' }}>Date d'expiration</label>
                          <input
                            type="text"
                            required
                            maxLength={5}
                            placeholder="MM/YY"
                            className="form-input"
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '12px', fontWeight: '600' }}>CVV</label>
                          <input
                            type="password"
                            required
                            maxLength={3}
                            pattern="\d{3}"
                            placeholder="123"
                            className="form-input"
                            value={cardCvv}
                            onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {paymentMethod === 'PAYPAL' && (
                  <div style={{ textAlign: 'center', padding: '10px 0' }}>
                    <div style={{ fontSize: '48px', marginBottom: '12px' }}>💳</div>
                    <p style={{ fontSize: '14px', color: '#475569', marginBottom: '20px' }}>
                      Vous allez être connecté au service sécurisé de PayPal pour autoriser le paiement de <strong>{cartTotal.toFixed(2)} €</strong>.
                    </p>
                    <div className="form-group" style={{ textAlign: 'left' }}>
                      <label className="form-label" style={{ fontSize: '12px', fontWeight: '600' }}>Adresse email PayPal</label>
                      <input
                        type="email"
                        required
                        className="form-input"
                        placeholder="nom@exemple.com"
                        value={paypalEmail}
                        onChange={(e) => setPaypalEmail(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {paymentMethod === 'CASH' && (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <div style={{ fontSize: '48px', marginBottom: '12px' }}>💵</div>
                    <p style={{ fontSize: '15px', color: '#334155', fontWeight: '500' }}>
                      Règlement en espèces à la livraison.
                    </p>
                    <p style={{ fontSize: '13px', color: '#64748b', marginTop: '8px' }}>
                      Vous paierez un total de <strong>{(cartTotal + 2.50).toFixed(2)} €</strong> (incluant les frais de livraison) directement au livreur.
                    </p>
                  </div>
                )}

                <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
                  <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="btn btn-secondary" style={{ flex: 1 }}>
                    Annuler
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 2, background: 'linear-gradient(to right, #0284c7, #0369a1)', border: 'none' }}>
                    Confirmer & Payer {(cartTotal + (withDelivery ? 2.50 : 0)).toFixed(2)} €
                  </button>
                </div>
              </form>
            )}

            {paymentStep === 'PROCESSING' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', textAlign: 'center' }}>
                <div className="loading-spinner" style={{ width: '45px', height: '45px', border: '4px solid #f3f3f3', borderTop: '4px solid #0284c7', marginBottom: '24px' }}></div>
                <h4 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: '#0f172a' }}>Traitement de la transaction...</h4>
                <p style={{ fontSize: '13px', color: '#64748b', marginTop: '8px', maxWidth: '300px' }}>
                  Connexion sécurisée en cours. Veuillez ne pas fermer cette fenêtre.
                </p>
              </div>
            )}

            {paymentStep === 'SUCCESS' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', textAlign: 'center' }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: '#dcfce7',
                  color: '#15803d',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '28px',
                  marginBottom: '20px',
                  boxShadow: '0 4px 12px rgba(21, 128, 61, 0.2)'
                }}>✓</div>
                <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#16a34a' }}>Paiement approuvé !</h4>
                <p style={{ fontSize: '13px', color: '#64748b', marginTop: '6px' }}>
                  Votre commande a bien été enregistrée et est en cours de traitement.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default MenuPage
