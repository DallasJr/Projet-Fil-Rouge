import { Link, Navigate } from 'react-router-dom'
import { UtensilsCrossed, ShoppingBag, Clock, Star, ArrowRight, MapPin, Zap, Heart } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const steps = [
  {
    emoji: '🍽️',
    title: 'Choisissez vos plats',
    desc: 'Parcourez notre carte et ajoutez vos plats préférés au panier en quelques clics.',
  },
  {
    emoji: '📍',
    title: 'Commandez',
    desc: 'Passez votre commande sur place ou faites-vous livrer directement à votre adresse.',
  },
  {
    emoji: '⚡',
    title: 'Régalez-vous',
    desc: 'Suivez votre commande en temps réel et recevez vos plats chauds et frais.',
  },
]

const highlights = [
  { icon: <Zap size={22} />, title: 'Commande rapide', desc: 'Passez votre commande en moins de 2 minutes, sans attente.' },
  { icon: <MapPin size={22} />, title: 'Livraison à domicile', desc: 'Faites-vous livrer partout en ville, directement à votre porte.' },
  { icon: <Clock size={22} />, title: 'Suivi en temps réel', desc: 'Suivez l\'état de votre commande étape par étape.' },
  { icon: <Heart size={22} />, title: 'Plats de qualité', desc: 'Des recettes soigneusement élaborées par nos cuisiniers passionnés.' },
]

const LandingPage = () => {
  const { isAuthenticated } = useAuth()

  if (isAuthenticated) return <Navigate to="/menu" replace />

  return (
    <div className="landing-page">
      {/* Header */}
      <header className="landing-header">
        <div className="landing-header-inner">
          <div className="landing-logo">
            <UtensilsCrossed size={22} />
            <span>RestauApp</span>
          </div>
          <div className="landing-header-actions">
            <Link to="/login" id="header-login" className="btn btn-secondary btn-sm">Se connecter</Link>
            <Link to="/register" id="header-register" className="btn btn-primary btn-sm">Commander</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-hero-bg">
          <div className="hero-orb hero-orb-1"></div>
          <div className="hero-orb hero-orb-2"></div>
          <div className="hero-orb hero-orb-3"></div>
        </div>
        <div className="landing-hero-content">
          <div className="landing-badge">
            <Star size={13} />
            Commandez, on s'occupe du reste
          </div>
          <h1 className="landing-title">
            De bons plats,<br />
            <span className="landing-title-accent">livrés chez vous.</span>
          </h1>
          <p className="landing-subtitle">
            Découvrez notre menu, commandez en ligne et faites-vous livrer —<br />
            ou venez récupérer votre commande directement au restaurant.
          </p>
          <div className="landing-cta">
            <Link to="/register" id="hero-cta-order" className="btn btn-primary btn-lg">
              <ShoppingBag size={18} />
              Voir le menu et commander
            </Link>
            <Link to="/login" id="hero-cta-login" className="btn btn-ghost btn-lg">
              Déjà un compte
            </Link>
          </div>

          {/* Badges de confiance */}
          <div className="landing-trust">
            <div className="trust-badge"><Clock size={14} /> Livraison rapide</div>
            <div className="trust-badge"><MapPin size={14} /> À emporter aussi</div>
            <div className="trust-badge"><Star size={14} /> Plats frais du jour</div>
          </div>
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="landing-how">
        <div className="landing-how-inner">
          <div className="landing-section-header">
            <h2 className="landing-section-title">Comment ça marche ?</h2>
            <p className="landing-section-subtitle">Trois étapes simples pour savourer nos plats</p>
          </div>
          <div className="steps-row">
            {steps.map((step, i) => (
              <div key={i} className="step-card">
                <div className="step-number">{i + 1}</div>
                <div className="step-emoji">{step.emoji}</div>
                <h3 className="step-title">{step.title}</h3>
                <p className="step-desc">{step.desc}</p>
                {i < steps.length - 1 && <div className="step-arrow"><ArrowRight size={20} /></div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Avantages */}
      <section className="landing-highlights">
        <div className="landing-highlights-inner">
          <div className="landing-section-header">
            <h2 className="landing-section-title">Pourquoi choisir RestauApp ?</h2>
            <p className="landing-section-subtitle">L'expérience restaurant, à votre façon</p>
          </div>
          <div className="highlights-grid">
            {highlights.map((h, i) => (
              <div key={i} className="highlight-card">
                <div className="highlight-icon">{h.icon}</div>
                <h3 className="highlight-title">{h.title}</h3>
                <p className="highlight-desc">{h.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="landing-cta-section">
        <div className="cta-card">
          <div className="cta-icons">🍕</div>
          <h2 className="cta-title">Prêt à commander ?</h2>
          <p className="cta-subtitle">
            Créez votre compte en 30 secondes et accédez à notre menu complet. 
            Livraison disponible 7j/7.
          </p>
          <div className="cta-actions">
            <Link to="/register" id="final-cta" className="btn btn-primary btn-lg">
              Créer mon compte
              <ArrowRight size={18} />
            </Link>
          </div>
          <p className="cta-already">
            Déjà inscrit ?{' '}
            <Link to="/login" id="final-login" className="auth-link">Se connecter</Link>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-logo">
            <UtensilsCrossed size={16} />
            <span>RestauApp</span>
          </div>
          <p className="landing-footer-text">Projet Fil Rouge — B3 DEV Ynov 2025-2026</p>
          <div className="landing-footer-links">
            <Link to="/login">Connexion</Link>
            <Link to="/register">S'inscrire</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
