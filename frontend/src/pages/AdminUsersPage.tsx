import { useState, useEffect } from 'react'
import { Trash2, Plus, AlertCircle, Eye, EyeOff, Filter, Search, ChevronDown, Download, Ban, CheckCircle, Mail, BarChart2, ShieldAlert, ShoppingBag, Truck, Pencil, Save, X, WifiOff } from 'lucide-react'
import { getAllUsers, createDeliverer, deleteUser, updateUser, getUserStats, sendDirectMessage, exportUsersCSV } from '../api/admin.api'
import type { UserDetail, UserStats } from '../api/admin.api'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useSocket } from '../contexts/SocketContext'

const AdminUsersPage = () => {
  const { user: currentUser } = useAuth()
  const { addToast } = useToast()
  const { socket, isConnected } = useSocket()
  
  const [users, setUsers] = useState<UserDetail[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Filtres
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  
  // Formulaire de création de livreur
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [phone, setPhone] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Détails & Stats Utilisateur
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null)
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(false)
  const [directMessage, setDirectMessage] = useState('')
  const [isSendingMsg, setIsSendingMsg] = useState(false)

  // Édition utilisateur inline
  const [isEditingUser, setIsEditingUser] = useState(false)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editRole, setEditRole] = useState<'CLIENT' | 'DELIVERER' | 'ADMIN'>('CLIENT')
  const [editIsAvailable, setEditIsAvailable] = useState(false)
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  // Suspension
  const [suspendingUserId, setSuspendingUserId] = useState<string | null>(null)

  // Présence en ligne (WebSocket)
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set())

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

  // Écouter les événements de connexion/déconnexion
  useEffect(() => {
    if (!socket || !isConnected) return

    // Demander la liste initiale des connectés
    socket.emit('get_online_users')

    const onList = (ids: string[]) => {
      setOnlineUserIds(new Set(ids))
    }
    const onOnline = ({ userId }: { userId: string }) => {
      setOnlineUserIds(prev => new Set([...prev, userId]))
    }
    const onOffline = ({ userId }: { userId: string }) => {
      setOnlineUserIds(prev => {
        const next = new Set(prev)
        next.delete(userId)
        return next
      })
    }

    socket.on('online_users_list', onList)
    socket.on('user_online', onOnline)
    socket.on('user_offline', onOffline)

    return () => {
      socket.off('online_users_list', onList)
      socket.off('user_online', onOnline)
      socket.off('user_offline', onOffline)
    }
  }, [socket, isConnected])

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (userId === currentUser?.id) {
      addToast('Vous ne pouvez pas supprimer votre propre compte.', 'error')
      return
    }
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer définitivement l'utilisateur "${userName}" ?`)) {
      return
    }

    try {
      await deleteUser(userId)
      addToast('Utilisateur supprimé avec succès.', 'success')
      setUsers(users.filter((u) => u.id !== userId))
      if (selectedUser?.id === userId) {
        setSelectedUser(null)
        setUserStats(null)
      }
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Erreur lors de la suppression de l\'utilisateur.', 'error')
    }
  }

  const handleToggleSuspend = async (u: UserDetail) => {
    if (u.id === currentUser?.id) {
      addToast('Vous ne pouvez pas suspendre votre propre compte.', 'error')
      return
    }

    let reason: string | null = null

    if (!u.isSuspended) {
      reason = window.prompt(`Raison de la suspension pour ${u.name} :`, 'Non-respect des conditions d\'utilisation')
      if (reason === null) return // Annulé
    } else {
      if (!window.confirm(`Voulez-vous réactiver le compte de ${u.name} ?`)) return
    }

    setSuspendingUserId(u.id)
    try {
      const updated = await updateUser(u.id, {
        isSuspended: !u.isSuspended,
        suspendedReason: reason
      })
      setUsers(prev => prev.map(usr => usr.id === u.id ? { ...usr, ...updated } : usr))
      if (selectedUser?.id === u.id) {
        setSelectedUser(prev => prev ? { ...prev, ...updated } : null)
      }
      addToast(`Compte de ${u.name} ${u.isSuspended ? 'réactivé' : 'suspendu'} avec succès.`, 'success')
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Impossible de mettre à jour le statut du compte.', 'error')
    } finally {
      setSuspendingUserId(null)
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

  const handleEditUser = (usr: UserDetail) => {
    setIsEditingUser(true)
    setEditName(usr.name)
    setEditEmail(usr.email)
    setEditPhone(usr.phone || '')
    setEditRole(usr.role)
    setEditIsAvailable(usr.isAvailable ?? false)
  }

  const handleSaveEdit = async () => {
    if (!selectedUser) return
    setIsSavingEdit(true)
    try {
      const updated = await updateUser(selectedUser.id, {
        name: editName,
        email: editEmail,
        phone: editPhone || undefined,
        role: editRole,
        isAvailable: editIsAvailable,
      })
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, ...updated } : u))
      setSelectedUser(prev => prev ? { ...prev, ...updated } : null)
      setIsEditingUser(false)
      addToast('Informations mises à jour avec succès.', 'success')
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Impossible de mettre à jour l\'utilisateur.', 'error')
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleShowStats = async (usr: UserDetail) => {
    setSelectedUser(usr)
    setUserStats(null)
    setIsLoadingStats(true)
    setDirectMessage('')
    setIsEditingUser(false)
    try {
      const stats = await getUserStats(usr.id)
      setUserStats(stats)
    } catch (err: any) {
      addToast('Impossible de charger les statistiques détaillées.', 'error')
    } finally {
      setIsLoadingStats(false)
    }
  }

  const handleSendDirectMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser || !directMessage.trim()) return
    setIsSendingMsg(true)
    try {
      await sendDirectMessage(selectedUser.id, directMessage)
      addToast('Message direct envoyé avec succès !', 'success')
      setDirectMessage('')
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Erreur lors de l\'envoi du message.', 'error')
    } finally {
      setIsSendingMsg(false)
    }
  }

  const filteredUsers = users.filter((u) => {
    const matchesSearch = 
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.phone || '').toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

  return (
    <div className="admin-users-page" style={{ paddingBottom: '4rem' }}>
      {/* Hero Header */}
      <div className="page-header" style={{ flexDirection: 'column', alignItems: 'stretch', display: 'flex' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              👤 Comptes Utilisateurs
            </h1>
            <p className="page-subtitle">Supervisez et gérez les comptes des clients, livreurs et administrateurs</p>
          </div>
          <button className="btn btn-secondary" onClick={() => exportUsersCSV()} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Download size={14} /> Exporter en CSV
          </button>
        </div>

        {/* Filtres & Recherche intégrés */}
        <div className="filter-panel" style={{ width: '100%', marginTop: '16px' }}>
          <div className="filter-panel-header" onClick={() => setShowFilters(v => !v)}>
            <span className="filter-panel-title">
              <Filter size={13} style={{ color: 'var(--color-primary)' }} /> Filtres &amp; Recherche
              {(searchTerm || roleFilter) && (
                <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '10px', background: 'var(--color-primary)', color: '#fff', fontWeight: '700', marginLeft: '6px' }}>
                  {[searchTerm && '1', roleFilter && '1'].filter(Boolean).length}
                </span>
              )}
            </span>
            <span className={`filter-panel-toggle ${showFilters ? 'open' : ''}`}>
              {showFilters ? 'Masquer' : 'Afficher'} <ChevronDown size={13} style={{ marginLeft: '4px' }} />
            </span>
          </div>
          
          {showFilters && (
            <div className="filter-panel-body">
              <div className="form-group" style={{ margin: 0, flex: '1', minWidth: '200px' }}>
                <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Recherche rapide</label>
                <div style={{ position: 'relative' }}>
                  <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-dim)' }} />
                  <input type="text" className="form-input" placeholder="Nom, email, téléphone..." value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)} style={{ paddingLeft: '30px', fontSize: '13px' }} />
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Rôle</label>
                <select className="form-input form-select" value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{ fontSize: '13px', minWidth: '160px' }}>
                  <option value="">Tous les rôles</option>
                  <option value="CLIENT">Clients</option>
                  <option value="DELIVERER">Livreurs</option>
                  <option value="ADMIN">Administrateurs</option>
                </select>
              </div>

              <button className="btn btn-secondary btn-sm" onClick={() => { setSearchTerm(''); setRoleFilter('') }} style={{ height: '38px' }}>
                Réinitialiser
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px', padding: '0 24px', marginTop: '24px' }}>
        
        {/* Liste principale des utilisateurs */}
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '800', margin: '0 0 16px 0', color: 'var(--color-text)' }}>
            Membres de la plateforme ({filteredUsers.length})
          </h2>

          {isLoading ? (
            <div className="loading-screen" style={{ height: '200px', background: 'transparent' }}><div className="loading-spinner"></div></div>
          ) : filteredUsers.length === 0 ? (
            <div className="empty-state" style={{ padding: '60px 0' }}><p>Aucun utilisateur correspondant aux filtres.</p></div>
          ) : (
            <div className="orders-table-wrapper">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Email</th>
                    <th>Téléphone</th>
                    <th>Rôle</th>
                    <th>Statut</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => {
                    const isSelf = u.id === currentUser?.id
                    const isAdmin = u.role === 'ADMIN'

                    return (
                      <tr key={u.id} style={{ opacity: u.isSuspended ? 0.7 : 1 }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                              width: '32px', height: '32px', borderRadius: '50%',
                              background: u.role === 'ADMIN' ? 'linear-gradient(135deg, #f59e0b, #ef4444)' : u.role === 'DELIVERER' ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #6366f1, #3b82f6)',
                              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '12px', fontWeight: '800'
                            }}>
                              {(u.name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span style={{ fontWeight: '700', color: 'var(--color-text)' }}>{u.name}</span>
                              {isSelf && (
                                <span style={{ fontSize: '9px', fontWeight: '800', background: 'var(--color-primary-glow)', color: 'var(--color-primary)', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px' }}>
                                  MOI
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{u.email}</td>
                        <td style={{ color: 'var(--color-text-dim)', fontSize: '0.85rem' }}>{u.phone || '—'}</td>
                        <td>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: '800',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: u.role === 'ADMIN' ? 'rgba(245,158,11,0.15)' : u.role === 'DELIVERER' ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.15)',
                            color: u.role === 'ADMIN' ? '#f59e0b' : u.role === 'DELIVERER' ? '#10b981' : '#6366f1'
                          }}>
                            {u.role}
                          </span>
                        </td>
                        <td>
                          {u.isSuspended ? (
                            <span style={{ color: '#ef4444', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '700' }} title={u.suspendedReason || ''}>
                              <Ban size={11} /> Suspendu
                            </span>
                          ) : onlineUserIds.has(u.id) ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '700', color: '#10b981' }}>
                              <span style={{
                                width: '7px', height: '7px', borderRadius: '50%',
                                background: '#10b981',
                                boxShadow: '0 0 0 2px rgba(16,185,129,0.25)',
                                display: 'inline-block',
                                animation: 'pulse 2s infinite'
                              }} />
                              En ligne
                            </span>
                          ) : (
                            <span style={{ color: 'var(--color-text-dim)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: '600' }}>
                              <WifiOff size={11} /> Hors ligne
                            </span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '6px', minWidth: 'auto' }}
                              onClick={() => handleShowStats(u)}
                              title="Statistiques & Message Direct"
                            >
                              <BarChart2 size={14} />
                            </button>
                            
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '6px', minWidth: 'auto', color: u.isSuspended ? '#10b981' : '#ef4444' }}
                              onClick={() => handleToggleSuspend(u)}
                              disabled={isSelf || suspendingUserId === u.id}
                              title={u.isSuspended ? 'Réactiver le compte' : 'Suspendre le compte'}
                            >
                              <Ban size={14} />
                            </button>

                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '6px', minWidth: 'auto', color: '#ef4444' }}
                              onClick={() => handleDeleteUser(u.id, u.name)}
                              disabled={isSelf || isAdmin}
                              title="Supprimer définitivement"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Formulaire Création Livreur */}
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          boxShadow: 'var(--shadow-sm)',
          position: 'sticky',
          top: '24px'
        }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '800', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text)' }}>
            <Plus size={18} style={{ color: 'var(--color-primary)' }} /> Créer un Livreur
          </h2>

          {error && (
            <div className="alert alert-error" style={{ marginBottom: '16px', padding: '10px 12px' }}>
              <AlertCircle size={14} />
              <span style={{ fontSize: '12px' }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleCreateDeliverer} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Nom complet</label>
              <input
                type="text"
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Martin Durand"
                required
                style={{ fontSize: '13px' }}
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Adresse email</label>
              <input
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ex: martin@example.com"
                required
                style={{ fontSize: '13px' }}
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Mot de passe temporaire</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 caractères"
                  required
                  style={{ width: '100%', paddingRight: '40px', fontSize: '13px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-text-dim)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Confirmer le mot de passe</label>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Répétez le mot de passe"
                required
                style={{ fontSize: '13px' }}
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Téléphone (optionnel)</label>
              <input
                type="tel"
                className="form-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ex: 0612345678"
                style={{ fontSize: '13px' }}
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={isSubmitting} style={{ width: '100%', marginTop: '6px' }}>
              {isSubmitting ? 'Création...' : 'Créer le livreur'}
            </button>
          </form>
        </div>
      </div>

      {/* Modal Détails & Statistiques détaillées de l'utilisateur */}
      {selectedUser && (
        <div className="modal-overlay" onClick={() => setSelectedUser(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', width: '95%', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '50%',
                  background: selectedUser.role === 'ADMIN' ? 'linear-gradient(135deg, #f59e0b, #ef4444)' : selectedUser.role === 'DELIVERER' ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #6366f1, #3b82f6)',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '16px', fontWeight: '800'
                }}>
                  {(selectedUser.name || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: 'var(--color-text)' }}>{selectedUser.name}</h3>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-dim)', display: 'block' }}>ID: {selectedUser.id}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {!isEditingUser ? (
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                    onClick={() => handleEditUser(selectedUser)}
                    title="Modifier les informations"
                  >
                    <Pencil size={12} /> Modifier
                  </button>
                ) : (
                  <>
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                      onClick={handleSaveEdit}
                      disabled={isSavingEdit}
                    >
                      <Save size={12} /> {isSavingEdit ? 'Sauvegarde...' : 'Enregistrer'}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                      onClick={() => setIsEditingUser(false)}
                    >
                      <X size={12} /> Annuler
                    </button>
                  </>
                )}
                <button className="btn btn-secondary btn-sm" style={{ minWidth: 'auto', padding: '6px' }} onClick={() => { setSelectedUser(null); setIsEditingUser(false) }}>✕</button>
              </div>
            </div>

            {selectedUser.isSuspended && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                gap: '8px',
                marginBottom: '20px',
                color: '#ef4444'
              }}>
                <ShieldAlert size={18} style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: '700', fontSize: '13px' }}>Compte actuellement suspendu</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>Raison : {selectedUser.suspendedReason || 'Non précisée'}</div>
                </div>
              </div>
            )}

            {isEditingUser ? (
              /* ─── Formulaire d'édition ─── */
              <div style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: '700', margin: '0 0 14px 0', color: 'var(--color-primary)' }}>✏️ Édition des informations</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Nom complet</label>
                    <input type="text" className="form-input" value={editName} onChange={e => setEditName(e.target.value)} style={{ fontSize: '13px' }} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Email</label>
                    <input type="email" className="form-input" value={editEmail} onChange={e => setEditEmail(e.target.value)} style={{ fontSize: '13px' }} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Téléphone</label>
                    <input type="tel" className="form-input" value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="Ex: 0612345678" style={{ fontSize: '13px' }} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Rôle</label>
                    <select className="form-input form-select" value={editRole} onChange={e => setEditRole(e.target.value as any)} style={{ fontSize: '13px' }}>
                      <option value="CLIENT">Client</option>
                      <option value="DELIVERER">Livreur</option>
                      <option value="ADMIN">Administrateur</option>
                    </select>
                  </div>
                  {(editRole === 'DELIVERER' || editRole === 'ADMIN') && (
                    <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: 'var(--color-surface-3)', borderRadius: '8px', border: '1px solid var(--color-border)', cursor: 'pointer' }}
                      onClick={() => setEditIsAvailable(!editIsAvailable)}
                    >
                      <div style={{
                        width: '36px', height: '20px', borderRadius: '10px',
                        background: editIsAvailable ? 'var(--color-primary)' : 'var(--color-border)',
                        position: 'relative', transition: 'background 0.2s', flexShrink: 0
                      }}>
                        <div style={{
                          position: 'absolute', top: '2px', left: editIsAvailable ? '18px' : '2px',
                          width: '16px', height: '16px', borderRadius: '50%',
                          background: '#fff', transition: 'left 0.2s'
                        }} />
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--color-text)' }}>
                        {editIsAvailable ? '🟢 Disponible pour livraison' : '🔴 Non disponible pour livraison'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* ─── Affichage lecture seule ─── */
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div style={{ background: 'var(--color-surface-2)', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                  <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-dim)', fontWeight: '700', textTransform: 'uppercase' }}>Email</span>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--color-text)', wordBreak: 'break-all' }}>{selectedUser.email}</span>
                </div>
                <div style={{ background: 'var(--color-surface-2)', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                  <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-dim)', fontWeight: '700', textTransform: 'uppercase' }}>Téléphone</span>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--color-text)' }}>{selectedUser.phone || 'Non renseigné'}</span>
                </div>
                {(selectedUser.role === 'DELIVERER' || selectedUser.role === 'ADMIN') && (
                  <div style={{ gridColumn: '1 / -1', background: 'var(--color-surface-2)', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px' }}>{selectedUser.isAvailable ? '🟢' : '🔴'}</span>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--color-text)' }}>
                      {selectedUser.isAvailable ? 'Disponible pour livraison' : 'Non disponible pour livraison'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Statistiques Dynamiques */}
            <h4 style={{ fontSize: '1rem', fontWeight: '800', margin: '0 0 12px 0', borderBottom: '1px solid var(--color-border)', paddingBottom: '6px', color: 'var(--color-text)' }}>
              Activité sur la plateforme
            </h4>

            {isLoadingStats ? (
              <div className="loading-screen" style={{ height: '120px', background: 'transparent' }}><div className="loading-spinner"></div></div>
            ) : userStats ? (
              <div>
                {selectedUser.role === 'CLIENT' && userStats.clientStats && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px', marginBottom: '24px' }}>
                    <div style={{ background: 'var(--color-surface-3)', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
                      <ShoppingBag size={16} style={{ color: 'var(--color-primary)', marginBottom: '4px' }} />
                      <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-dim)' }}>Commandes</span>
                      <strong style={{ fontSize: '16px', color: 'var(--color-text)' }}>{userStats.clientStats.totalOrders}</strong>
                    </div>
                    <div style={{ background: 'var(--color-surface-3)', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
                      <CheckCircle size={16} style={{ color: '#10b981', marginBottom: '4px' }} />
                      <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-dim)' }}>Livrées</span>
                      <strong style={{ fontSize: '16px', color: 'var(--color-text)' }}>{userStats.clientStats.completedOrders}</strong>
                    </div>
                    <div style={{ background: 'var(--color-surface-3)', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
                      <span style={{ fontSize: '16px', marginBottom: '4px', display: 'block' }}>💶</span>
                      <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-dim)' }}>Dépenses</span>
                      <strong style={{ fontSize: '14px', color: 'var(--color-text)' }}>{userStats.clientStats.totalSpent.toFixed(2)} €</strong>
                    </div>
                    <div style={{ background: 'var(--color-surface-3)', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
                      <span style={{ fontSize: '16px', marginBottom: '4px', display: 'block' }}>🛒</span>
                      <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-dim)' }}>Panier moyen</span>
                      <strong style={{ fontSize: '14px', color: 'var(--color-text)' }}>{userStats.clientStats.avgBasket.toFixed(2)} €</strong>
                    </div>
                  </div>
                )}

                {selectedUser.role === 'DELIVERER' && userStats.delivererStats && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px', marginBottom: '24px' }}>
                    <div style={{ background: 'var(--color-surface-3)', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
                      <Truck size={16} style={{ color: 'var(--color-primary)', marginBottom: '4px' }} />
                      <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-dim)' }}>Livraisons</span>
                      <strong style={{ fontSize: '16px', color: 'var(--color-text)' }}>{userStats.delivererStats.totalDeliveries}</strong>
                    </div>
                    <div style={{ background: 'var(--color-surface-3)', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
                      <CheckCircle size={16} style={{ color: '#10b981', marginBottom: '4px' }} />
                      <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-dim)' }}>Taux de réussite</span>
                      <strong style={{ fontSize: '16px', color: 'var(--color-text)' }}>{(userStats.delivererStats.successRate * 100).toFixed(0)}%</strong>
                    </div>
                    <div style={{ background: 'var(--color-surface-3)', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
                      <span style={{ fontSize: '16px', marginBottom: '4px', display: 'block' }}>💰</span>
                      <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-dim)' }}>Commissions</span>
                      <strong style={{ fontSize: '14px', color: 'var(--color-text)' }}>{userStats.delivererStats.totalCommissions.toFixed(2)} €</strong>
                    </div>
                  </div>
                )}

                {selectedUser.role === 'ADMIN' && (
                  <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                    🔒 Les administrateurs n'ont pas d'indicateurs de consommation ou de commission.
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--color-text-dim)', fontSize: '12px' }}>Aucune donnée d'activité disponible.</div>
            )}

            {/* Message Direct */}
            <h4 style={{ fontSize: '1rem', fontWeight: '800', margin: '0 0 12px 0', borderBottom: '1px solid var(--color-border)', paddingBottom: '6px', color: 'var(--color-text)' }}>
              <Mail size={14} style={{ color: 'var(--color-primary)', marginRight: '6px' }} /> Envoyer un message direct
            </h4>
            <form onSubmit={handleSendDirectMessage} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ margin: 0, flex: 1 }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Écrire un message pour cet utilisateur..."
                  value={directMessage}
                  onChange={(e) => setDirectMessage(e.target.value)}
                  required
                  style={{ fontSize: '13px' }}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={isSendingMsg || !directMessage.trim()} style={{ height: '38px', minWidth: '80px' }}>
                {isSendingMsg ? 'Envoi...' : 'Envoyer'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminUsersPage
