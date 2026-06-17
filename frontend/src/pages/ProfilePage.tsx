import { useState, useEffect } from 'react'
import { User, Mail, Phone, Shield, Calendar, AlertCircle, Camera, Check, X } from 'lucide-react'
import { getProfile } from '../api/auth.api'
import type { AuthUser } from '../api/auth.api'
import { useAuth } from '../contexts/AuthContext'
import { uploadImage } from '../api/uploads.api'

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  ADMIN:     { label: 'Administrateur', color: 'var(--color-primary)' },
  CLIENT:    { label: 'Client',         color: 'var(--color-secondary)' },
  DELIVERER: { label: 'Livreur',        color: '#22c55e' },
}

const ProfilePage = () => {
  const { user: authUser, logout, setAvailability, updateUserProfile } = useAuth()
  const [profile, setProfile] = useState<AuthUser & { createdAt?: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Edit states
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

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

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    setError('')
    setSuccess('')
    try {
      const uploadRes = await uploadImage(file)
      await updateUserProfile({ avatarUrl: uploadRes.url })
      setProfile(prev => prev ? { ...prev, avatarUrl: uploadRes.url } : null)
      setSuccess('Photo de profil mise à jour avec succès.')
    } catch (err: any) {
      setError(err.response?.data?.error || "Erreur lors de l'upload de l'avatar.")
    } finally {
      setIsUploading(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      setError('Le nom complet est obligatoire.')
      return
    }
    setIsSaving(true)
    setError('')
    setSuccess('')
    try {
      await updateUserProfile({ name: editName, phone: editPhone || null })
      setProfile(prev => prev ? { ...prev, name: editName, phone: editPhone || null } : null)
      setSuccess('Profil mis à jour avec succès.')
      setIsEditing(false)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de la mise à jour.')
    } finally {
      setIsSaving(false)
    }
  }

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

      {success && (
        <div className="alert alert-success">
          <Check size={16} /><span>{success}</span>
        </div>
      )}

      <div className="profile-layout">
        {/* Carte profil principale */}
        <div className="profile-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="profile-avatar-container" style={{ position: 'relative', width: '88px', height: '88px', marginBottom: '16px' }}>
            {profile?.avatarUrl ? (
              <img src={profile.avatarUrl} alt="Avatar" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-primary)' }} />
            ) : (
              <div className="profile-avatar" style={{ width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
                <User size={36} />
              </div>
            )}
            <label className="avatar-upload-overlay" style={{
              position: 'absolute', bottom: '4px', right: '4px',
              background: 'var(--color-primary)', borderRadius: '50%',
              width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', border: '2px solid var(--color-surface)', transition: 'all 0.2s', boxShadow: 'var(--shadow-sm)'
            }} title="Changer d'avatar">
              <Camera size={13} color="#fff" />
              <input type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} disabled={isUploading} />
            </label>
            {isUploading && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="btn-spinner" style={{ width: '20px', height: '20px' }}></span>
              </div>
            )}
          </div>
          <div className="profile-name" style={{ fontSize: '1.2rem', fontWeight: '800', textAlign: 'center' }}>{profile?.name}</div>
          <div className="profile-role-badge" style={{ background: roleInfo.color, marginTop: '8px' }}>
            <Shield size={13} /> {roleInfo.label}
          </div>

          {isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', marginTop: '20px', borderTop: '1px solid var(--color-border)', paddingTop: '20px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '11px' }}>Nom complet</label>
                <input type="text" className="form-input" value={editName} onChange={e => setEditName(e.target.value)} disabled={isSaving} placeholder="Votre nom complet" />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '11px' }}>Téléphone</label>
                <input type="text" className="form-input" value={editPhone} onChange={e => setEditPhone(e.target.value)} disabled={isSaving} placeholder="Votre numéro de téléphone" />
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button className="btn btn-primary btn-sm btn-full" onClick={handleSaveProfile} disabled={isSaving} style={{ display: 'flex', gap: '4px', padding: '8px 12px' }}>
                  <Check size={14} /> Enregistrer
                </button>
                <button className="btn btn-secondary btn-sm btn-full" onClick={() => setIsEditing(false)} disabled={isSaving} style={{ display: 'flex', gap: '4px', padding: '8px 12px' }}>
                  <X size={14} /> Annuler
                </button>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: '20px', width: '100%', textAlign: 'center' }}>
              <button className="btn btn-secondary btn-sm btn-full" onClick={() => {
                setEditName(profile?.name || '')
                setEditPhone(profile?.phone || '')
                setIsEditing(true)
                setError('')
                setSuccess('')
              }}>
                Modifier mes infos
              </button>
            </div>
          )}
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
