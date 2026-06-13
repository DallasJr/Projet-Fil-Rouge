import { useState, useEffect } from 'react'
import { Trash2, Plus, Users, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { getAllUsers, createDeliverer, deleteUser } from '../api/admin.api'
import type { UserDetail } from '../api/admin.api'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

const AdminUsersPage = () => {
  const { user: currentUser } = useAuth()
  const { addToast } = useToast()
  
  const [users, setUsers] = useState<UserDetail[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState<string>('')
  
  // Formulaire de création de livreur
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [phone, setPhone] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const fetchUsers = async () => {
    setIsLoading(true)
    try {
      const data = await getAllUsers(roleFilter || undefined)
      setUsers(data)
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Erreur lors du chargement des utilisateurs', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [roleFilter])

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (userId === currentUser?.id) {
      addToast('Vous ne pouvez pas supprimer votre propre compte.', 'error')
      return
    }
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur "${userName}" ?`)) {
      return
    }

    try {
      await deleteUser(userId)
      addToast('Utilisateur supprimé avec succès.', 'success')
      setUsers(users.filter((u) => u.id !== userId))
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Erreur lors de la suppression de l\'utilisateur.', 'error')
    }
  }

  const handleCreateDeliverer = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    if (password.length < 6) {
      setError('Le mot de passe doit faire au moins 6 caractères.')
      return
    }

    setIsSubmitting(true)

    try {
      await createDeliverer({ name, email, password, phone: phone || undefined })
      addToast(`Livreur "${name}" créé avec succès.`, 'success')
      
      // Réinitialiser le formulaire
      setName('')
      setEmail('')
      setPassword('')
      setConfirmPassword('')
      setPhone('')
      
      // Recharger les utilisateurs
      fetchUsers()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Impossible de créer le compte livreur.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="admin-users-page" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
          <Users size={28} /> Gestion des Utilisateurs
        </h1>
        <p style={{ color: '#666', marginTop: '4px', marginBottom: 0 }}>Gérez les comptes des clients et livreurs de la plateforme.</p>
      </div>

      <div className="admin-users-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '24px', alignItems: 'start' }}>
        {/* Liste des utilisateurs */}
        <div className="users-list-section" style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <div className="list-filters" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '18px', margin: 0 }}>Comptes Utilisateurs</h2>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #ddd', outline: 'none' }}
            >
              <option value="">Tous les rôles</option>
              <option value="CLIENT">Clients</option>
              <option value="DELIVERER">Livreurs</option>
              <option value="ADMIN">Administrateurs</option>
            </select>
          </div>

          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>Chargement des utilisateurs...</div>
          ) : users.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>Aucun utilisateur trouvé.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #eee', color: '#666', fontSize: '14px' }}>
                    <th style={{ padding: '12px 8px' }}>Nom</th>
                    <th style={{ padding: '12px 8px' }}>Email</th>
                    <th style={{ padding: '12px 8px' }}>Téléphone</th>
                    <th style={{ padding: '12px 8px' }}>Rôle</th>
                    <th style={{ padding: '12px 8px' }}>Création</th>
                    <th style={{ padding: '12px 8px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isSelf = u.id === currentUser?.id
                    const isAdmin = u.role === 'ADMIN'

                    return (
                      <tr key={u.id} style={{ borderBottom: '1px solid #eee', fontSize: '14px' }}>
                        <td style={{ padding: '12px 8px', fontWeight: '500' }}>{u.name} {isSelf && <span style={{ fontSize: '10px', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '10px', marginLeft: '6px' }}>Moi</span>}</td>
                        <td style={{ padding: '12px 8px', color: '#666' }}>{u.email}</td>
                        <td style={{ padding: '12px 8px', color: '#666' }}>{u.phone || 'Non renseigné'}</td>
                        <td style={{ padding: '12px 8px' }}>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: '600',
                            padding: '4px 8px',
                            borderRadius: '20px',
                            backgroundColor: u.role === 'ADMIN' ? '#fef3c7' : u.role === 'DELIVERER' ? '#dcfce7' : '#f3f4f6',
                            color: u.role === 'ADMIN' ? '#d97706' : u.role === 'DELIVERER' ? '#15803d' : '#374151'
                          }}>
                            {u.role}
                          </span>
                        </td>
                        <td style={{ padding: '12px 8px', color: '#999', fontSize: '12px' }}>
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                          <button
                            onClick={() => handleDeleteUser(u.id, u.name)}
                            disabled={isSelf || isAdmin}
                            title={isSelf ? 'Impossible de vous supprimer' : isAdmin ? 'Impossible de supprimer un admin' : 'Supprimer l\'utilisateur'}
                            style={{
                              border: 'none',
                              backgroundColor: 'transparent',
                              color: isSelf || isAdmin ? '#ccc' : '#ef4444',
                              cursor: isSelf || isAdmin ? 'not-allowed' : 'pointer',
                              padding: '6px',
                              borderRadius: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => { if (!isSelf && !isAdmin) e.currentTarget.style.backgroundColor = '#fee2e2' }}
                            onMouseLeave={(e) => { if (!isSelf && !isAdmin) e.currentTarget.style.backgroundColor = 'transparent' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section Créer un livreur */}
        <div className="create-deliverer-section" style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <h2 style={{ fontSize: '18px', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={20} /> Créer un Livreur
          </h2>
          
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#fee2e2', color: '#b91c1c', padding: '10px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleCreateDeliverer} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: '500', color: '#444' }}>Nom complet</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Martin Durand"
                required
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', outline: 'none' }}
              />
            </div>

            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: '500', color: '#444' }}>Adresse email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ex: martin@example.com"
                required
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', outline: 'none' }}
              />
            </div>

            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: '500', color: '#444' }}>Mot de passe temporaire</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 caractères"
                  required
                  style={{ width: '100%', padding: '8px 40px 8px 12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', outline: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    background: 'none',
                    border: 'none',
                    color: '#999',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: '500', color: '#444' }}>Confirmer le mot de passe</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Répétez le mot de passe"
                  required
                  style={{ width: '100%', padding: '8px 40px 8px 12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', outline: 'none' }}
                />
              </div>
            </div>

            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: '500', color: '#444' }}>Téléphone (optionnel)</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ex: 0612345678"
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', outline: 'none' }}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                marginTop: '6px',
                padding: '10px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#0284c7',
                color: '#fff',
                fontWeight: '600',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => { if (!isSubmitting) e.currentTarget.style.backgroundColor = '#0369a1' }}
              onMouseLeave={(e) => { if (!isSubmitting) e.currentTarget.style.backgroundColor = '#0284c7' }}
            >
              {isSubmitting ? 'Création...' : 'Créer le livreur'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default AdminUsersPage
