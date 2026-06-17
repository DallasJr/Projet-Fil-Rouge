import { useState, useEffect, type FormEvent } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { Lock, AlertCircle, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { resetPassword } from '../api/auth.api'

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const queryToken = searchParams.get('token') || ''
    setToken(queryToken)
    if (!queryToken) {
      setError('Jeton de réinitialisation manquant. Vérifiez le lien reçu par email.')
    }
  }, [searchParams])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!token) return

    setError('')
    setMessage('')

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{6,}$/
    if (!passwordRegex.test(password)) {
      setError('Le mot de passe doit contenir au moins 6 caractères, une majuscule, un chiffre et un caractère spécial.')
      return
    }

    setIsLoading(true)

    try {
      const res = await resetPassword({ token, newPassword: password })
      setMessage(res.message || 'Votre mot de passe a bien été mis à jour.')
      setTimeout(() => navigate('/login'), 1500)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Impossible de réinitialiser le mot de passe. Vérifiez le lien.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <Lock size={32} />
          </div>
          <h1 className="auth-title">Réinitialiser le mot de passe</h1>
          <p className="auth-subtitle">Choisissez un nouveau mot de passe sécurisé.</p>
        </div>

        {error && (
          <div className="alert alert-error" id="reset-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="alert alert-success" id="reset-success">
            <span>{message}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label" htmlFor="reset-password">Nouveau mot de passe</label>
            <div className="input-wrapper">
              <Lock size={16} className="input-icon" />
              <input
                id="reset-password"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="input-icon-right"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Afficher ou masquer le mot de passe"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={isLoading || !token}>
            {isLoading ? <span className="btn-spinner"></span> : 'Réinitialiser'}
          </button>
        </form>

        <p className="auth-footer">
          <Link to="/login" className="auth-link">
            <ArrowLeft size={14} /> Retour à la connexion
          </Link>
        </p>
      </div>
    </div>
  )
}

export default ResetPasswordPage
