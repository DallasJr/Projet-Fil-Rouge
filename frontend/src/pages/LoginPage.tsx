import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UtensilsCrossed, Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const LoginPage = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      await login({ email, password })
      navigate('/menu')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Email ou mot de passe incorrect.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <UtensilsCrossed size={32} />
          </div>
          <h1 className="auth-title">Connexion</h1>
          <p className="auth-subtitle">Accédez à votre espace RestauApp</p>
        </div>

        {error && (
          <div className="alert alert-error" id="login-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form id="login-form" onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email</label>
            <div className="input-wrapper">
              <Mail size={16} className="input-icon" />
              <input
                id="login-email"
                type="email"
                className="form-input"
                placeholder="votre@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Mot de passe</label>
            <div className="input-wrapper">
              <Lock size={16} className="input-icon" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="input-icon-right"
                onClick={() => setShowPassword(!showPassword)}
                id="toggle-password"
                aria-label="Afficher/masquer le mot de passe"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            id="btn-login"
            type="submit"
            className="btn btn-primary btn-full"
            disabled={isLoading}
          >
            {isLoading ? <span className="btn-spinner"></span> : 'Se connecter'}
          </button>
        </form>

        <p className="auth-footer auth-footer-secondary">
          <Link to="/forgot-password" className="auth-link">
            Mot de passe oublié ?
          </Link>
        </p>

        <p className="auth-footer">
          Pas encore de compte ?{' '}
          <Link to="/register" id="link-register" className="auth-link">
            S'inscrire
          </Link>
        </p>
      </div>
    </div>
  )
}

export default LoginPage
