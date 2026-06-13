import { useState, useEffect } from 'react'
import { User, Mail, Phone, Shield, Calendar, AlertCircle } from 'lucide-react'
import { getProfile } from '../api/auth.api'
import type { AuthUser } from '../api/auth.api'
import { useAuth } from '../contexts/AuthContext'

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  ADMIN:     { label: 'Administrateur', color: 'var(--color-primary)' },
  CLIENT:    { label: 'Client',         color: 'var(--color-secondary)' },
  DELIVERER: { label: 'Livreur',        color: '#22c55e' },
}

const ProfilePage = () => {
  const { user: authUser, logout, setAvailability } = useAuth()
  const [profile, setProfile] = useState<AuthUser & { createdAt?: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await getProfile()
        setProfile(data)
      } catch {
        // Fallback sur les données du contexte
        setProfile(authUser)
        setError('Impossible de charger le profil depuis le serveur.')
      } finally {
        setIsLoading(false)
      }
    }
    fetchProfile()
  }, [authUser])

  if (isLoading) return <div className="loading-screen"><div className="loading-spinner"></div></div>

  const roleInfo = ROLE_LABELS[profile?.role || 'CLIENT']

  return (
    <div className="profile-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Mon Profil</h1>
          <p className="page-subtitle">Vos informations personnelles</p>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={16} /><span>{error}</span>
        </div>
      )}

      <div className="profile-layout">
        {/* Carte profil principale */}
        <div className="profile-card">
          <div className="profile-avatar">
            <User size={40} />
          </div>
          <div className="profile-name">{profile?.name}</div>
          <div className="profile-role-badge" style={{ background: roleInfo.color }}>
            <Shield size={13} /> {roleInfo.label}
          </div>
        </div>

        {/* Infos détaillées */}
        <div className="profile-details">
          <div className="profile-section">
            <h2 className="profile-section-title">Informations du compte</h2>

            <div className="profile-field">
              <div className="profile-field-icon"><User size={16} /></div>
              <div className="profile-field-content">
                <div className="profile-field-label">Nom complet</div>
                <div className="profile-field-value">{profile?.name || '—'}</div>
              </div>
            </div>

            <div className="profile-field">
              <div className="profile-field-icon"><Mail size={16} /></div>
              <div className="profile-field-content">
                <div className="profile-field-label">Adresse email</div>
                <div className="profile-field-value">{profile?.email || '—'}</div>
              </div>
            </div>

            <div className="profile-field">
              <div className="profile-field-icon"><Phone size={16} /></div>
              <div className="profile-field-content">
                <div className="profile-field-label">Téléphone</div>
                <div className="profile-field-value">{profile?.phone || <span className="text-muted">Non renseigné</span>}</div>
              </div>
            </div>

            <div className="profile-field">
              <div className="profile-field-icon"><Shield size={16} /></div>
              <div className="profile-field-content">
                <div className="profile-field-label">Rôle</div>
                <div className="profile-field-value" style={{ color: roleInfo.color }}>{roleInfo.label}</div>
              </div>
            </div>

            {(profile as any)?.createdAt && (
              <div className="profile-field">
                <div className="profile-field-icon"><Calendar size={16} /></div>
                <div className="profile-field-content">
                  <div className="profile-field-label">Membre depuis</div>
                  <div className="profile-field-value">
                    {new Date((profile as any).createdAt).toLocaleDateString('fr-FR', {
                      day: '2-digit', month: 'long', year: 'numeric'
                    })}
                  </div>
                </div>
              </div>
            )}

            {profile?.role === 'DELIVERER' && (
              <div className="profile-field" style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1rem', marginTop: '1rem' }}>
                <div className="profile-field-icon" style={{ color: profile?.isAvailable ? '#22c55e' : '#ef4444' }}>
                  <Shield size={16} />
                </div>
                <div className="profile-field-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '12px' }}>
                  <div>
                    <div className="profile-field-label">Statut de disponibilité</div>
                    <div className="profile-field-value" style={{ color: profile?.isAvailable ? '#22c55e' : '#ef4444', fontWeight: 'bold' }}>
                      {profile?.isAvailable ? '🟢 En ligne (Disponible)' : '🔴 Hors ligne'}
                    </div>
                  </div>
                  <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '40px', height: '22px', flexShrink: 0 }}>
                    <input
                      id="deliverer-availability-toggle"
                      type="checkbox"
                      checked={!!profile?.isAvailable}
                      onChange={async (e) => {
                        try {
                          await setAvailability(e.target.checked)
                          setProfile(prev => prev ? { ...prev, isAvailable: e.target.checked } : null)
                        } catch (err) {
                          setError('Impossible de mettre à jour le statut de disponibilité.')
                        }
                      }}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span className="slider" style={{
                      position: 'absolute',
                      cursor: 'pointer',
                      top: 0, left: 0, right: 0, bottom: 0,
                      backgroundColor: profile?.isAvailable ? '#22c55e' : '#ccc',
                      transition: '.4s',
                      borderRadius: '34px'
                    }}>
                      <span style={{
                        position: 'absolute',
                        content: '""',
                        height: '16px', width: '16px',
                        left: profile?.isAvailable ? '21px' : '3px',
                        bottom: '3px',
                        backgroundColor: 'white',
                        transition: '.4s',
                        borderRadius: '50%'
                      }} />
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Bouton déconnexion */}
          <div className="profile-actions">
            <button
              id="btn-logout-profile"
              className="btn btn-danger"
              onClick={logout}
            >
              Se déconnecter
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProfilePage
