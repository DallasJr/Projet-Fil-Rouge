import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UtensilsCrossed, Mail, Lock, User, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const RegisterPage = () => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const { register } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    if (password.length < 6) {
      setError('Le mot de passe doit faire au moins 6 caractères.')
      return
    }
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{6,}$/
    if (!passwordRegex.test(password)) {
      setError('Le mot de passe doit contenir au moins 6 caractères, une majuscule, un chiffre et un caractère spécial.')
      return
    }

    setIsLoading(true)
    try {
      await register({ name, email, password })
      navigate('/menu')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Une erreur est survenue lors de l\'inscription.')
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
          <h1 className="auth-title">Créer un compte</h1>
          <p className="auth-subtitle">Rejoignez RestauApp dès maintenant</p>
        </div>

        {error && (
          <div className="alert alert-error" id="register-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form id="register-form" onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label" htmlFor="register-name">Nom complet</label>
            <div className="input-wrapper">
              <User size={16} className="input-icon" />
              <input
                id="register-name"
                type="text"
                className="form-input"
                placeholder="Jean Dupont"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="register-email">Email</label>
            <div className="input-wrapper">
              <Mail size={16} className="input-icon" />
              <input
                id="register-email"
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
            <label className="form-label" htmlFor="register-password">Mot de passe</label>
            <div className="input-wrapper">
              <Lock size={16} className="input-icon" />
              <input
                id="register-password"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="Minimum 6 caractères"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                className="input-icon-right"
                onClick={() => setShowPassword(!showPassword)}
                id="toggle-register-password"
                aria-label="Afficher/masquer le mot de passe"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="register-confirm">Confirmer le mot de passe</label>
            <div className="input-wrapper">
              <Lock size={16} className="input-icon" />
              <input
                id="register-confirm"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="Répétez votre mot de passe"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
          </div>

          <button
            id="btn-register"
            type="submit"
            className="btn btn-primary btn-full"
            disabled={isLoading}
          >
            {isLoading ? <span className="btn-spinner"></span> : 'Créer mon compte'}
          </button>
        </form>

        <p className="auth-footer">
          Déjà un compte ?{' '}
          <Link to="/login" id="link-login" className="auth-link">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  )
}

export default RegisterPage
