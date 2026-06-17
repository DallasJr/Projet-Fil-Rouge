import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Mail, AlertCircle, ArrowLeft } from 'lucide-react'
import { forgotPassword } from '../api/auth.api'

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setIsLoading(true)

    try {
      const res = await forgotPassword({ email })
      setMessage(res.message || 'Si cette adresse est enregistrée, un e-mail de réinitialisation a été envoyé.')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Impossible d\'envoyer le mail de réinitialisation. Essayez de nouveau.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <Mail size={32} />
          </div>
          <h1 className="auth-title">Mot de passe oublié</h1>
          <p className="auth-subtitle">Recevez un lien pour réinitialiser votre mot de passe.</p>
        </div>

        {error && (
          <div className="alert alert-error" id="forgot-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="alert alert-success" id="forgot-success">
            <span>{message}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label" htmlFor="forgot-email">Email</label>
            <div className="input-wrapper">
              <Mail size={16} className="input-icon" />
              <input
                id="forgot-email"
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

          <button type="submit" className="btn btn-primary btn-full" disabled={isLoading}>
            {isLoading ? <span className="btn-spinner"></span> : 'Envoyer le lien'}
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

export default ForgotPasswordPage
