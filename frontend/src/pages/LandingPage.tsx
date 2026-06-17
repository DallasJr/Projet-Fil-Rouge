import { Link } from 'react-router-dom'
import { UtensilsCrossed, ShoppingBag, Clock, Star, ArrowRight, MapPin, Zap, Heart, ChefHat, Truck, Shield } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import Navbar from '../components/Navbar'

const highlights = [
  { icon: <Zap size={20} />, title: 'Commande en 2 min', desc: 'Interface ultra-rapide conçue pour commander sans friction, en quelques clics seulement.' },
  { icon: <MapPin size={20} />, title: 'Livraison à domicile', desc: 'Suivez votre livreur en temps réel sur la carte. Zéro surprise sur le délai.' },
  { icon: <ChefHat size={20} />, title: 'Recettes du chef', desc: 'Des plats élaborés quotidiennement par nos cuisiniers passionnés avec des produits frais.' },
  { icon: <Shield size={20} />, title: 'Paiement sécurisé', desc: 'Carte bancaire, PayPal ou espèces à la livraison — à vous de choisir.' },
]

const reviews = [
  { name: 'Camille B.', rating: 5, text: 'Livraison ultra rapide, le burger était encore chaud ! Je recommande vraiment.', avatar: '👩‍💼' },
  { name: 'Thomas L.', rating: 5, text: 'La pizza truffe est à tomber. Le suivi en temps réel c\'est un vrai plus.', avatar: '👨‍🎓' },
  { name: 'Sofia M.', rating: 5, text: 'Poke bowl frais et généreux. Service impeccable, je commande plusieurs fois par semaine !', avatar: '👩‍🍳' },
]

const chefDishes = [
  {
    id: 'sug-1',
    name: 'Burger Gourmet',
    price: 14.90,
    rating: 4.9,
    reviews: 120,
    desc: 'Double steak Black Angus, cheddar affiné, oignons caramélisés & notre sauce secrète maison.',
    tag: '🔥 Populaire',
    tagColor: '#ef4444',
    tagBg: '#fef2f2',
    image: '/burger.png',
    calories: '780 kcal',
  },
  {
    id: 'sug-2',
    name: 'Pizza Truffe & Prosciutto',
    price: 16.50,
    rating: 4.8,
    reviews: 85,
    desc: 'Base crème truffe blanche, mozzarella di bufala, prosciutto crudo & roquette fraîche.',
    tag: '💎 Signature',
    tagColor: '#7c3aed',
    tagBg: '#f5f3ff',
    image: '/pizza.png',
    calories: '650 kcal',
  },
  {
    id: 'sug-3',
    name: 'Poke Bowl Saumon Avocat',
    price: 13.90,
    rating: 4.7,
    reviews: 95,
    desc: 'Saumon mariné premium, avocat crémeux, riz vinaigré, mangue fraîche & sésame grillé.',
    tag: '🌿 Healthy',
    tagColor: '#059669',
    tagBg: '#f0fdf4',
    image: '/poke.png',
    calories: '520 kcal',
  }
]

const steps = [
  { emoji: '🍽️', title: 'Parcourez le menu', desc: 'Filtrez par catégorie, découvrez les suggestions du chef et composez votre repas.' },
  { emoji: '📍', title: 'Choisissez la livraison', desc: 'Renseignez votre adresse et choisissez votre mode de paiement préféré.' },
  { emoji: '⚡', title: 'Régalez-vous', desc: 'Suivez votre commande en live et recevez vos plats chauds directement chez vous.' },
]

const LandingPage = () => {
  const { isAuthenticated, isAdmin, isDeliverer } = useAuth()

  const getAppHomePath = () => {
    if (isAdmin) return '/dashboard'
    if (isDeliverer) return '/deliveries'
    return '/menu'
  }

  const getAppHomeLabel = () => {
    if (isAdmin) return 'Dashboard Admin'
    if (isDeliverer) return 'Espace Livreur'
    return 'Accéder au Menu'
  }

  return (
    <div style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif", background: '#fff', overflowX: 'hidden' }}>

      <Navbar />

      {/* ── HERO ── */}
      <section style={{ position: 'relative', overflow: 'hidden', minHeight: '92vh', display: 'flex', alignItems: 'center' }}>
        {/* Gradient background */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)',
        }} />
        {/* Animated orbs */}
        <div style={{ position: 'absolute', top: '-100px', right: '-80px', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(249,115,22,0.18) 0%, transparent 70%)', borderRadius: '50%', animation: 'orbFloat 8s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', bottom: '-120px', left: '-60px', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(239,68,68,0.15) 0%, transparent 70%)', borderRadius: '50%', animation: 'orbFloat 10s ease-in-out 2s infinite' }} />

        <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '80px 24px', position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', alignItems: 'center', width: '100%' }}>
          {/* Left content */}
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)',
              padding: '6px 14px', borderRadius: '20px', marginBottom: '28px',
            }}>
              <Star size={13} color="#f97316" fill="#f97316" />
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#fb923c' }}>
                +500 commandes livrées ce mois
              </span>
            </div>
            <h1 style={{ fontSize: 'clamp(36px, 5vw, 62px)', fontWeight: '900', color: '#fff', lineHeight: 1.1, margin: '0 0 20px', letterSpacing: '-2px' }}>
              La bonne cuisine,<br />
              <span style={{ background: 'linear-gradient(90deg, #f97316, #ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                livrée chez vous.
              </span>
            </h1>
            <p style={{ fontSize: '18px', color: '#94a3b8', lineHeight: 1.7, margin: '0 0 36px', maxWidth: '480px' }}>
              Commandez en ligne, suivez votre livreur en temps réel et savourez des plats du chef. Simple, rapide, délicieux.
            </p>
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '40px' }}>
              {isAuthenticated ? (
                <Link to={getAppHomePath()} id="hero-cta-app" style={{
                  display: 'inline-flex', alignItems: 'center', gap: '10px',
                  padding: '14px 28px', borderRadius: '12px',
                  background: 'linear-gradient(135deg, #f97316, #ef4444)',
                  color: '#fff', textDecoration: 'none', fontWeight: '800', fontSize: '16px',
                  boxShadow: '0 8px 24px rgba(249,115,22,0.4)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(249,115,22,0.5)' }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(249,115,22,0.4)' }}
                >
                  <ShoppingBag size={18} /> {getAppHomeLabel()} <ArrowRight size={16} />
                </Link>
              ) : (
                <>
                  <Link to="/menu" id="hero-cta-order" style={{
                    display: 'inline-flex', alignItems: 'center', gap: '10px',
                    padding: '14px 28px', borderRadius: '12px',
                    background: 'linear-gradient(135deg, #f97316, #ef4444)',
                    color: '#fff', textDecoration: 'none', fontWeight: '800', fontSize: '16px',
                    boxShadow: '0 8px 24px rgba(249,115,22,0.4)',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(249,115,22,0.5)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(249,115,22,0.4)' }}
                  >
                    <ShoppingBag size={18} /> Voir le menu <ArrowRight size={16} />
                  </Link>
                  <Link to="/login" id="hero-cta-login" style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    padding: '14px 22px', borderRadius: '12px',
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                    color: '#e2e8f0', textDecoration: 'none', fontWeight: '600', fontSize: '15px',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                  >
                    Déjà client ?
                  </Link>
                </>
              )}
            </div>

            {/* Trust badges */}
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              {[{ icon: <Clock size={13} />, label: 'Livraison ~30 min' }, { icon: <Truck size={13} />, label: 'Livraison 7j/7' }, { icon: <Star size={13} fill="#f97316" color="#f97316" />, label: '4.9 / 5 ★' }].map((b, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '13px', fontWeight: '500' }}>
                  <span style={{ color: '#f97316' }}>{b.icon}</span> {b.label}
                </div>
              ))}
            </div>
          </div>

          {/* Right: dish card stack */}
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {/* Main image */}
            <div style={{
              borderRadius: '24px', overflow: 'hidden',
              width: '100%', maxWidth: '440px',
              boxShadow: '0 40px 80px rgba(0,0,0,0.5)',
              border: '1px solid rgba(255,255,255,0.08)',
              position: 'relative',
              animation: 'heroFloat 6s ease-in-out infinite',
            }}>
              <img
                src="/burger.png"
                alt="Burger Gourmet RestauApp"
                style={{ width: '100%', height: '320px', objectFit: 'cover', display: 'block' }}
              />
              {/* Price overlay */}
              <div style={{
                position: 'absolute', bottom: '0', left: '0', right: '0',
                background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
                padding: '24px 20px 20px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
              }}>
                <div>
                  <div style={{ color: '#fff', fontWeight: '800', fontSize: '20px', marginBottom: '2px' }}>Burger Gourmet</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#fbbf24', fontSize: '12px' }}>★★★★★</span>
                    <span style={{ color: '#cbd5e1', fontSize: '12px' }}>4.9 (120 avis)</span>
                  </div>
                </div>
                <div style={{ background: 'linear-gradient(135deg, #f97316, #ef4444)', padding: '8px 16px', borderRadius: '20px', color: '#fff', fontWeight: '800', fontSize: '18px' }}>
                  14,90 €
                </div>
              </div>
              {/* Hot badge */}
              <div style={{ position: 'absolute', top: '16px', left: '16px', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', padding: '6px 12px', borderRadius: '20px', color: '#fb923c', fontSize: '12px', fontWeight: '700', border: '1px solid rgba(249,115,22,0.3)' }}>
                🔥 Populaire
              </div>
            </div>

            {/* Floating card: ETA */}
            <div style={{
              position: 'absolute', bottom: '-20px', left: '-20px',
              background: '#fff', borderRadius: '16px', padding: '12px 18px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              display: 'flex', alignItems: 'center', gap: '12px',
              animation: 'heroFloat 6s ease-in-out 1s infinite',
            }}>
              <div style={{ width: '40px', height: '40px', background: '#fff7ed', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Truck size={20} color="#f97316" />
              </div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '14px', color: '#0f172a' }}>En route</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Arrivée dans ~28 min</div>
              </div>
            </div>

            {/* Floating card: Rating */}
            <div style={{
              position: 'absolute', top: '-20px', right: '-15px',
              background: '#fff', borderRadius: '16px', padding: '12px 18px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              animation: 'heroFloat 6s ease-in-out 2.5s infinite',
            }}>
              <div style={{ display: 'flex', gap: '2px', marginBottom: '2px' }}>
                {[...Array(5)].map((_, i) => <span key={i} style={{ color: '#fbbf24', fontSize: '14px' }}>★</span>)}
              </div>
              <div style={{ fontSize: '12px', color: '#374151', fontWeight: '600' }}>+500 clients satisfaits</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION PLATS DU CHEF ── */}
      <section style={{ padding: '100px 24px', background: '#fafafa' }}>
        <div style={{ maxWidth: '1180px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#fff7ed', border: '1px solid #fed7aa', padding: '6px 16px', borderRadius: '20px', marginBottom: '16px' }}>
              <ChefHat size={14} color="#f97316" />
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#f97316' }}>Suggestions du Chef</span>
            </div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: '900', color: '#0f172a', margin: '0 0 12px', letterSpacing: '-1px' }}>
              Nos plats incontournables
            </h2>
            <p style={{ fontSize: '17px', color: '#64748b', margin: 0, maxWidth: '520px', marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
              Sélectionnés chaque semaine par notre chef selon les arrivages et saisons.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '32px' }}>
            {chefDishes.map((dish) => (
              <div key={dish.id} style={{
                background: '#fff', borderRadius: '20px', overflow: 'hidden',
                boxShadow: '0 4px 24px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9',
                transition: 'transform 0.3s, box-shadow 0.3s',
                display: 'flex', flexDirection: 'column',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-8px)'; e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.12)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.06)' }}
              >
                {/* Image */}
                <div style={{ position: 'relative', overflow: 'hidden' }}>
                  <img
                    src={dish.image}
                    alt={dish.name}
                    style={{ width: '100%', height: '220px', objectFit: 'cover', display: 'block', transition: 'transform 0.4s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                  />
                  <span style={{
                    position: 'absolute', top: '14px', left: '14px',
                    background: dish.tagBg, color: dish.tagColor,
                    fontSize: '12px', fontWeight: '700', padding: '5px 12px', borderRadius: '20px',
                    border: `1px solid ${dish.tagColor}30`,
                  }}>
                    {dish.tag}
                  </span>
                  <span style={{
                    position: 'absolute', top: '14px', right: '14px',
                    background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
                    color: '#e2e8f0', fontSize: '11px', fontWeight: '600', padding: '4px 10px', borderRadius: '12px',
                  }}>
                    🔥 {dish.calories}
                  </span>
                </div>

                {/* Content */}
                <div style={{ padding: '22px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '19px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.5px' }}>{dish.name}</h3>
                    <span style={{ fontSize: '20px', fontWeight: '900', color: '#f97316', whiteSpace: 'nowrap', marginLeft: '10px' }}>{dish.price.toFixed(2)} €</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                    <span style={{ color: '#fbbf24', fontSize: '13px' }}>★</span>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>{dish.rating}</span>
                    <span style={{ fontSize: '13px', color: '#94a3b8' }}>({dish.reviews} avis)</span>
                    <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: 'auto' }}>• Livraison ~30 min</span>
                  </div>
                  <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#475569', lineHeight: 1.65, flex: 1 }}>{dish.desc}</p>

                  {isDeliverer || isAdmin ? (
                    <Link
                      to={`/menu?search=${encodeURIComponent(dish.name)}`}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        padding: '12px', borderRadius: '12px',
                        background: 'linear-gradient(135deg, #f97316, #ef4444)',
                        color: '#fff', textDecoration: 'none', fontWeight: '700', fontSize: '14px',
                        boxShadow: '0 4px 12px rgba(249,115,22,0.3)',
                        transition: 'box-shadow 0.2s, transform 0.2s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 8px 20px rgba(249,115,22,0.45)'; e.currentTarget.style.transform = 'scale(1.02)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(249,115,22,0.3)'; e.currentTarget.style.transform = 'scale(1)' }}
                    >
                      👁️ Voir le plat <ArrowRight size={14} />
                    </Link>
                  ) : (
                    <Link
                      to={`/menu?search=${encodeURIComponent(dish.name)}`}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        padding: '12px', borderRadius: '12px',
                        background: 'linear-gradient(135deg, #f97316, #ef4444)',
                        color: '#fff', textDecoration: 'none', fontWeight: '700', fontSize: '14px',
                        boxShadow: '0 4px 12px rgba(249,115,22,0.3)',
                        transition: 'box-shadow 0.2s, transform 0.2s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 8px 20px rgba(249,115,22,0.45)'; e.currentTarget.style.transform = 'scale(1.02)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(249,115,22,0.3)'; e.currentTarget.style.transform = 'scale(1)' }}
                    >
                      Commander ce plat <ArrowRight size={14} />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMMENT ÇA MARCHE ── */}
      <section style={{ padding: '100px 24px', background: '#0f172a', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(249,115,22,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: '1180px', margin: '0 auto', position: 'relative' }}>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: '900', color: '#fff', margin: '0 0 12px', letterSpacing: '-1px' }}>
              Comment ça marche ?
            </h2>
            <p style={{ fontSize: '17px', color: '#64748b', margin: 0 }}>Trois étapes simples pour savourer</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '40px', position: 'relative' }}>
            {steps.map((step, i) => (
              <div key={i} style={{ textAlign: 'center', position: 'relative' }}>
                <div style={{
                  width: '72px', height: '72px', margin: '0 auto 20px',
                  background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.25)',
                  borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px',
                }}>
                  {step.emoji}
                </div>
                <div style={{
                  position: 'absolute', top: '0', left: 'calc(50% + 36px)',
                  width: '28px', height: '28px', background: '#f97316', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: '800', fontSize: '13px',
                  transform: i === steps.length - 1 ? 'scale(0)' : 'scale(1)',
                  boxShadow: '0 0 0 4px rgba(249,115,22,0.2)',
                }}>
                  {i + 1}
                </div>
                <h3 style={{ color: '#f8fafc', fontWeight: '800', fontSize: '19px', margin: '0 0 10px', letterSpacing: '-0.3px' }}>{step.title}</h3>
                <p style={{ color: '#64748b', fontSize: '15px', lineHeight: 1.65, margin: 0 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AVANTAGES ── */}
      <section style={{ padding: '100px 24px', background: '#fff' }}>
        <div style={{ maxWidth: '1180px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: '900', color: '#0f172a', margin: '0 0 12px', letterSpacing: '-1px' }}>
              Pourquoi choisir RestauApp ?
            </h2>
            <p style={{ fontSize: '17px', color: '#64748b', margin: 0 }}>L'expérience restaurant, à votre façon</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '28px' }}>
            {highlights.map((h, i) => (
              <div key={i} style={{
                padding: '28px', borderRadius: '18px', background: '#fafafa',
                border: '1px solid #f1f5f9', transition: 'background 0.2s, transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#fff7ed'; e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 28px rgba(249,115,22,0.1)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#fafafa'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
              >
                <div style={{ width: '48px', height: '48px', background: '#fff7ed', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f97316', marginBottom: '16px', border: '1px solid #fed7aa' }}>
                  {h.icon}
                </div>
                <h3 style={{ fontWeight: '800', fontSize: '17px', color: '#0f172a', margin: '0 0 8px' }}>{h.title}</h3>
                <p style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.65, margin: 0 }}>{h.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AVIS CLIENTS ── */}
      <section style={{ padding: '100px 24px', background: '#fafafa' }}>
        <div style={{ maxWidth: '1180px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '14px', background: '#fef9c3', border: '1px solid #fde68a', padding: '5px 14px', borderRadius: '20px' }}>
              <Heart size={12} color="#f59e0b" fill="#f59e0b" />
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#d97706' }}>Ce que disent nos clients</span>
            </div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: '900', color: '#0f172a', margin: 0, letterSpacing: '-1px' }}>
              Ils adorent RestauApp ❤️
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            {reviews.map((r, i) => (
              <div key={i} style={{
                background: '#fff', borderRadius: '18px', padding: '28px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 28px rgba(0,0,0,0.1)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.05)' }}
              >
                <div style={{ display: 'flex', gap: '2px', marginBottom: '14px' }}>
                  {[...Array(r.rating)].map((_, j) => <span key={j} style={{ color: '#fbbf24', fontSize: '16px' }}>★</span>)}
                </div>
                <p style={{ fontSize: '15px', color: '#334155', lineHeight: 1.7, margin: '0 0 20px', fontStyle: 'italic' }}>
                  "{r.text}"
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '28px' }}>{r.avatar}</span>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '14px', color: '#0f172a' }}>{r.name}</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>Client fidèle</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section style={{ padding: '100px 24px', background: '#0f172a', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-100px', right: '-100px', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(249,115,22,0.12) 0%, transparent 60%)', borderRadius: '50%' }} />
        <div style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <div style={{ fontSize: '52px', marginBottom: '20px' }}>🍕</div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 46px)', fontWeight: '900', color: '#fff', margin: '0 0 16px', letterSpacing: '-1px' }}>
            Prêt à vous régaler ?
          </h2>
          <p style={{ fontSize: '18px', color: '#64748b', lineHeight: 1.7, margin: '0 0 40px' }}>
            {isAuthenticated
              ? 'Notre menu vous attend. Commandez en quelques clics et faites-vous livrer rapidement.'
              : 'Rejoignez plus de 500 clients satisfaits. Inscription gratuite et commande en 2 minutes.'}
          </p>
          {isAuthenticated ? (
            <Link to={getAppHomePath()} id="final-cta" style={{
              display: 'inline-flex', alignItems: 'center', gap: '12px',
              padding: '16px 36px', borderRadius: '14px',
              background: 'linear-gradient(135deg, #f97316, #ef4444)',
              color: '#fff', textDecoration: 'none', fontWeight: '800', fontSize: '17px',
              boxShadow: '0 8px 28px rgba(249,115,22,0.5)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 14px 36px rgba(249,115,22,0.6)' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(249,115,22,0.5)' }}
            >
              {getAppHomeLabel()} <ArrowRight size={18} />
            </Link>
          ) : (
            <>
              <Link to="/register" id="final-cta" style={{
                display: 'inline-flex', alignItems: 'center', gap: '12px',
                padding: '16px 36px', borderRadius: '14px',
                background: 'linear-gradient(135deg, #f97316, #ef4444)',
                color: '#fff', textDecoration: 'none', fontWeight: '800', fontSize: '17px',
                boxShadow: '0 8px 28px rgba(249,115,22,0.5)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 14px 36px rgba(249,115,22,0.6)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(249,115,22,0.5)' }}
              >
                <ShoppingBag size={18} /> Créer mon compte <ArrowRight size={18} />
              </Link>
              <p style={{ marginTop: '20px', color: '#475569', fontSize: '14px' }}>
                Déjà inscrit ?{' '}
                <Link to="/login" id="final-login" style={{ color: '#fb923c', fontWeight: '600', textDecoration: 'none' }}>
                  Se connecter →
                </Link>
              </p>
            </>
          )}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: '#020617', padding: '40px 24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: '1180px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <div style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, #f97316, #ef4444)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UtensilsCrossed size={16} color="#fff" />
            </div>
            <span style={{ fontWeight: '800', color: '#94a3b8', fontSize: '15px' }}>RestauApp</span>
          </Link>
          <p style={{ color: '#475569', fontSize: '13px', margin: 0 }}>Projet Fil Rouge — B3 DEV Ynov 2025-2026</p>
          <div style={{ display: 'flex', gap: '20px' }}>
            {isAuthenticated ? (
              <Link to={getAppHomePath()} style={{ color: '#64748b', textDecoration: 'none', fontSize: '13px', fontWeight: '500', transition: 'color 0.2s' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#f97316' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#64748b' }}
              >Accéder à l'app</Link>
            ) : (
              <>
                <Link to="/login" style={{ color: '#64748b', textDecoration: 'none', fontSize: '13px', fontWeight: '500' }}>Connexion</Link>
                <Link to="/register" style={{ color: '#64748b', textDecoration: 'none', fontSize: '13px', fontWeight: '500' }}>S'inscrire</Link>
              </>
            )}
          </div>
        </div>
      </footer>

      {/* Animations CSS */}
      <style>{`
        @keyframes orbFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%       { transform: translate(20px, -30px) scale(1.05); }
        }
        @keyframes heroFloat {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-12px); }
        }
        @media (max-width: 768px) {
          section > div[style*="grid-template-columns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
          section > div[style*="grid-template-columns: repeat(3, 1fr)"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}

export default LandingPage
