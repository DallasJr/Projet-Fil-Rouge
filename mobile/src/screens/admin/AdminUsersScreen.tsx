import React, { useState, useEffect, useCallback } from 'react'
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  ActivityIndicator, TextInput, Alert, Modal, ScrollView, Switch, RefreshControl, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { getAllUsers, deleteUser, updateUser, createDeliverer, getUserStats, UserDetail, UserStats } from '../../api/admin'

type RoleFilter = 'ALL' | 'CLIENT' | 'DELIVERER' | 'ADMIN'
type UserRole = 'CLIENT' | 'DELIVERER' | 'ADMIN'

export default function AdminUsersScreen() {
  const navigation = useNavigation()
  const [users, setUsers] = useState<UserDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL')

  // Create deliverer modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [creating, setCreating] = useState(false)

  // Stats + Edit modal
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null)
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)

  // Edit mode inside modal
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editRole, setEditRole] = useState<UserRole>('CLIENT')
  const [editIsAvailable, setEditIsAvailable] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadUsers = useCallback(async (showIndicator = true) => {
    if (showIndicator) setLoading(true)
    try {
      const role = roleFilter === 'ALL' ? undefined : roleFilter
      const data = await getAllUsers(role)
      setUsers(data)
    } catch (err) {
      console.error('Error fetching users:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [roleFilter])

  useEffect(() => { loadUsers() }, [loadUsers])
  const onRefresh = () => { setRefreshing(true); loadUsers(false) }

  const handleShowDetail = async (user: UserDetail) => {
    setSelectedUser(user)
    setIsEditing(false)
    setLoadingStats(true)
    setShowDetailModal(true)
    try {
      const statsData = await getUserStats(user.id)
      setUserStats(statsData)
    } catch {
      setUserStats(null)
    } finally {
      setLoadingStats(false)
    }
  }

  const startEditing = (user: UserDetail) => {
    setEditName(user.name)
    setEditEmail(user.email)
    setEditPhone(user.phone || '')
    setEditRole(user.role)
    setEditIsAvailable(user.isAvailable ?? false)
    setIsEditing(true)
  }

  const handleSaveEdit = async () => {
    if (!selectedUser) return
    setSaving(true)
    try {
      const updated = await updateUser(selectedUser.id, {
        name: editName,
        email: editEmail,
        phone: editPhone || undefined,
        role: editRole,
        isAvailable: editIsAvailable,
      })
      setSelectedUser(prev => prev ? { ...prev, ...updated } : null)
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, ...updated } : u))
      setIsEditing(false)
      Alert.alert('Succès', 'Informations mises à jour.')
    } catch {
      Alert.alert('Erreur', 'Impossible de mettre à jour les informations.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (user: UserDetail) => {
    Alert.alert('Supprimer', `Supprimer "${user.name}" définitivement ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          try {
            await deleteUser(user.id)
            loadUsers(false)
            setShowDetailModal(false)
          } catch {
            Alert.alert('Erreur', 'Impossible de supprimer cet utilisateur.')
          }
        },
      },
    ])
  }

  const handleToggleSuspend = async (user: UserDetail) => {
    try {
      const updated = await updateUser(user.id, { isSuspended: !user.isSuspended })
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, ...updated } : u))
      if (selectedUser?.id === user.id) {
        setSelectedUser(prev => prev ? { ...prev, isSuspended: updated.isSuspended } : null)
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de modifier le statut.')
    }
  }

  const handleCreateDeliverer = async () => {
    if (!newName || !newEmail || !newPassword) {
      Alert.alert('Champs requis', 'Nom, email et mot de passe sont obligatoires.')
      return
    }
    setCreating(true)
    try {
      await createDeliverer({ name: newName, email: newEmail, password: newPassword, phone: newPhone || undefined })
      setShowCreateModal(false)
      setNewName(''); setNewEmail(''); setNewPassword(''); setNewPhone('')
      loadUsers(false)
    } catch {
      Alert.alert('Erreur', 'Impossible de créer le livreur.')
    } finally {
      setCreating(false)
    }
  }

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  const getRoleColor = (role: string) => {
    if (role === 'ADMIN') return '#ef4444'
    if (role === 'DELIVERER') return '#22c55e'
    return '#3b82f6'
  }

  const getRoleLabel = (role: string) => {
    if (role === 'ADMIN') return 'Administrateur'
    if (role === 'DELIVERER') return 'Livreur'
    return 'Client'
  }

  const getFilterLabel = (f: RoleFilter) => {
    const map: Record<RoleFilter, string> = { ALL: 'Tous', CLIENT: 'Clients', DELIVERER: 'Livreurs', ADMIN: 'Admins' }
    return map[f]
  }

  const renderUser = ({ item }: { item: UserDetail }) => {
    const color = getRoleColor(item.role)
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => handleShowDetail(item)}>
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: color + '15', borderColor: color + '40' }]}>
          <Text style={[styles.avatarText, { color }]}>{item.name.slice(0, 2).toUpperCase()}</Text>
        </View>

        <View style={styles.cardInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.userName} numberOfLines={1}>{item.name}</Text>
            {item.isSuspended && (
              <View style={styles.suspendedBadge}><Text style={styles.suspendedText}>Suspendu</Text></View>
            )}
          </View>
          <Text style={styles.userEmail} numberOfLines={1}>{item.email}</Text>
          {item.phone && <Text style={styles.userPhone}>📞 {item.phone}</Text>}
          <View style={[styles.roleBadge, { backgroundColor: color + '15', borderColor: color + '40' }]}>
            <Text style={[styles.roleText, { color }]}>{getRoleLabel(item.role)}</Text>
          </View>
        </View>

        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Utilisateurs</Text>
        <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreateModal(true)}>
          <Text style={styles.createBtnText}>+ Livreur</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher par nom ou email..."
          placeholderTextColor="#475569"
        />
      </View>

      {/* Role Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 48 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 4 }}>
        {(['ALL', 'CLIENT', 'DELIVERER', 'ADMIN'] as RoleFilter[]).map(role => (
          <TouchableOpacity
            key={role}
            style={[styles.chip, roleFilter === role && styles.chipActive]}
            onPress={() => setRoleFilter(role)}
          >
            <Text style={[styles.chipText, roleFilter === role && styles.chipTextActive]}>
              {getFilterLabel(role)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Users list */}
      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color="#f97316" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={u => u.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />}
          ListEmptyComponent={
            <View style={styles.centered}><Text style={styles.emptyText}>Aucun utilisateur trouvé</Text></View>
          }
          renderItem={renderUser}
        />
      )}

      {/* ── Create Deliverer Modal ── */}
      <Modal visible={showCreateModal} animationType="slide" onRequestClose={() => setShowCreateModal(false)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Créer un Livreur</Text>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            {[
              { label: 'Nom *', val: newName, set: setNewName, placeholder: 'Jean Dupont' },
              { label: 'Email *', val: newEmail, set: setNewEmail, placeholder: 'jean@example.com' },
              { label: 'Mot de passe *', val: newPassword, set: setNewPassword, placeholder: '••••••••' },
              { label: 'Téléphone', val: newPhone, set: setNewPhone, placeholder: '06 00 00 00 00' },
            ].map(f => (
              <View key={f.label} style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{f.label}</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={f.val}
                  onChangeText={f.set}
                  placeholder={f.placeholder}
                  placeholderTextColor="#475569"
                  secureTextEntry={f.label.includes('passe')}
                />
              </View>
            ))}
            <TouchableOpacity style={styles.submitBtn} onPress={handleCreateDeliverer} disabled={creating}>
              {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Créer le livreur</Text>}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── User Detail / Edit Modal ── */}
      <Modal visible={showDetailModal} animationType="slide" transparent onRequestClose={() => { setShowDetailModal(false); setIsEditing(false); setUserStats(null) }}>
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalSheet}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{selectedUser?.name}</Text>
                <Text style={styles.modalSubTitle}>{selectedUser?.email}</Text>
              </View>
              <View style={styles.modalHeaderActions}>
                {!isEditing && (
                  <TouchableOpacity style={styles.editIconBtn} onPress={() => selectedUser && startEditing(selectedUser)}>
                    <Text style={styles.editIconText}>✏️</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => { setShowDetailModal(false); setIsEditing(false); setUserStats(null) }}>
                  <Text style={styles.closeBtn}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              {isEditing ? (
                /* ── EDIT FORM ── */
                <View style={{ gap: 14 }}>
                  <Text style={styles.sectionLabel}>Modifier les informations</Text>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Nom complet</Text>
                    <TextInput style={styles.fieldInput} value={editName} onChangeText={setEditName} placeholderTextColor="#475569" />
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Adresse email</Text>
                    <TextInput style={styles.fieldInput} value={editEmail} onChangeText={setEditEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#475569" />
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Téléphone</Text>
                    <TextInput style={styles.fieldInput} value={editPhone} onChangeText={setEditPhone} keyboardType="phone-pad" placeholder="06 00 00 00 00" placeholderTextColor="#475569" />
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Rôle</Text>
                    <View style={styles.roleButtons}>
                      {(['CLIENT', 'DELIVERER', 'ADMIN'] as UserRole[]).map(r => (
                        <TouchableOpacity
                          key={r}
                          style={[styles.roleBtn, editRole === r && { backgroundColor: getRoleColor(r), borderColor: getRoleColor(r) }]}
                          onPress={() => setEditRole(r)}
                        >
                          <Text style={[styles.roleBtnText, editRole === r && { color: '#fff' }]}>
                            {getRoleLabel(r)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {editRole === 'DELIVERER' && (
                    <View style={styles.switchRow}>
                      <Text style={styles.fieldLabel}>Disponible pour livraisons</Text>
                      <Switch
                        value={editIsAvailable}
                        onValueChange={setEditIsAvailable}
                        trackColor={{ false: '#334155', true: '#22c55e' }}
                        thumbColor={editIsAvailable ? '#fff' : '#94a3b8'}
                      />
                    </View>
                  )}

                  <View style={styles.editActions}>
                    <TouchableOpacity style={styles.cancelEditBtn} onPress={() => setIsEditing(false)}>
                      <Text style={styles.cancelEditText}>Annuler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEdit} disabled={saving}>
                      {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Enregistrer</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                /* ── STATS VIEW ── */
                <View style={{ gap: 14 }}>
                  {/* Info card */}
                  <View style={styles.statsCard}>
                    <Text style={styles.statsCardTitle}>Informations</Text>
                    {[
                      { label: 'Rôle', value: getRoleLabel(selectedUser?.role || ''), color: getRoleColor(selectedUser?.role || '') },
                      { label: 'Statut', value: selectedUser?.isSuspended ? 'Suspendu' : 'Actif', color: selectedUser?.isSuspended ? '#ef4444' : '#22c55e' },
                      { label: 'Téléphone', value: selectedUser?.phone || '—' },
                      { label: 'Inscription', value: selectedUser?.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString('fr-FR') : '—' },
                    ].map(row => (
                      <View key={row.label} style={styles.statsRow}>
                        <Text style={styles.statsLabel}>{row.label}</Text>
                        <Text style={[styles.statsVal, row.color ? { color: row.color } : {}]}>{row.value}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Role-specific stats */}
                  {loadingStats ? (
                    <ActivityIndicator color="#f97316" />
                  ) : selectedUser?.role === 'CLIENT' && userStats?.clientStats ? (
                    <View style={styles.statsCard}>
                      <Text style={styles.statsCardTitle}>Statistiques d'achat</Text>
                      <View style={styles.statsGrid}>
                        <View style={styles.statsGridItem}>
                          <Text style={styles.statsGridNum}>{userStats.clientStats.totalOrders}</Text>
                          <Text style={styles.statsGridLabel}>Commandes</Text>
                        </View>
                        <View style={styles.statsGridItem}>
                          <Text style={[styles.statsGridNum, { color: '#22c55e' }]}>{userStats.clientStats.completedOrders}</Text>
                          <Text style={styles.statsGridLabel}>Livrées</Text>
                        </View>
                      </View>
                      <View style={styles.statsRow}>
                        <Text style={styles.statsLabel}>Total dépensé</Text>
                        <Text style={[styles.statsVal, { color: '#f97316', fontWeight: '900' }]}>{userStats.clientStats.totalSpent.toFixed(2)} €</Text>
                      </View>
                      <View style={styles.statsRow}>
                        <Text style={styles.statsLabel}>Panier moyen</Text>
                        <Text style={styles.statsVal}>{userStats.clientStats.avgBasket.toFixed(2)} €</Text>
                      </View>
                    </View>
                  ) : selectedUser?.role === 'DELIVERER' && userStats?.delivererStats ? (
                    <View style={styles.statsCard}>
                      <Text style={styles.statsCardTitle}>Statistiques de livraison</Text>
                      <View style={styles.statsGrid}>
                        <View style={styles.statsGridItem}>
                          <Text style={styles.statsGridNum}>{userStats.delivererStats.totalDeliveries}</Text>
                          <Text style={styles.statsGridLabel}>Assignées</Text>
                        </View>
                        <View style={styles.statsGridItem}>
                          <Text style={[styles.statsGridNum, { color: '#22c55e' }]}>
                            {(userStats.delivererStats.successRate * 100).toFixed(0)}%
                          </Text>
                          <Text style={styles.statsGridLabel}>Réussite</Text>
                        </View>
                      </View>
                      <View style={styles.statsRow}>
                        <Text style={styles.statsLabel}>Commissions cumulées</Text>
                        <Text style={[styles.statsVal, { color: '#22c55e', fontWeight: '900' }]}>{userStats.delivererStats.totalCommissions.toFixed(2)} €</Text>
                      </View>
                    </View>
                  ) : null}

                  {/* Danger zone */}
                  <View style={styles.dangerZone}>
                    <Text style={styles.sectionLabel}>Actions</Text>
                    <TouchableOpacity
                      style={[styles.actionBtn, selectedUser?.isSuspended ? styles.btnGreen : styles.btnWarning]}
                      onPress={() => selectedUser && handleToggleSuspend(selectedUser)}
                    >
                      <Text style={styles.actionBtnText}>
                        {selectedUser?.isSuspended ? '✓ Réactiver le compte' : '⊘ Suspendre le compte'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.btnRed]}
                      onPress={() => selectedUser && handleDelete(selectedUser)}
                    >
                      <Text style={styles.actionBtnText}>🗑 Supprimer le compte</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0f14' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { color: '#64748b', fontSize: 16 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  backText: { color: '#f97316', fontWeight: '800', fontSize: 15 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#f1f5f9' },
  createBtn: { backgroundColor: '#f97316', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  createBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  searchRow: { paddingHorizontal: 16, paddingVertical: 10 },
  searchInput: {
    backgroundColor: '#151821', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: '#f1f5f9',
  },

  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#151821', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  chipActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  chipText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  card: {
    backgroundColor: '#151821', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, flexShrink: 0,
  },
  avatarText: { fontWeight: '900', fontSize: 16 },
  cardInfo: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userName: { color: '#f1f5f9', fontWeight: '800', fontSize: 15, flex: 1 },
  suspendedBadge: { backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  suspendedText: { color: '#ef4444', fontSize: 10, fontWeight: '700' },
  userEmail: { color: '#94a3b8', fontSize: 12 },
  userPhone: { color: '#64748b', fontSize: 12 },
  roleBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1, marginTop: 4 },
  roleText: { fontSize: 11, fontWeight: '800' },
  chevron: { color: '#475569', fontSize: 22, fontWeight: '300' },

  // Modals
  modal: { flex: 1, backgroundColor: '#0d0f14' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#0d0f14', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  modalHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#f1f5f9' },
  modalSubTitle: { fontSize: 12, color: '#64748b', marginTop: 2 },
  closeBtn: { fontSize: 20, color: '#64748b', padding: 4 },
  editIconBtn: { padding: 4 },
  editIconText: { fontSize: 18 },
  modalBody: { padding: 20, gap: 14, paddingBottom: 40 },

  sectionLabel: { fontSize: 12, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 },

  // Edit form
  fieldGroup: { gap: 6 },
  fieldLabel: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  fieldInput: {
    backgroundColor: '#151821', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    padding: 13, fontSize: 14, color: '#f1f5f9',
  },
  roleButtons: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  roleBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#151821', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  roleBtnText: { color: '#94a3b8', fontSize: 13, fontWeight: '700' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelEditBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center',
    backgroundColor: '#1e293b', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  cancelEditText: { color: '#94a3b8', fontSize: 14, fontWeight: '700' },
  saveBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', backgroundColor: '#f97316' },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  // Stats
  statsCard: {
    backgroundColor: '#151821', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', gap: 10,
  },
  statsCardTitle: { fontSize: 12, fontWeight: '800', color: '#f97316', textTransform: 'uppercase', letterSpacing: 0.5 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  statsLabel: { color: '#94a3b8', fontSize: 13 },
  statsVal: { color: '#f1f5f9', fontSize: 13, fontWeight: '700' },
  statsGrid: { flexDirection: 'row', gap: 10 },
  statsGridItem: { flex: 1, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: 12, alignItems: 'center', gap: 4 },
  statsGridNum: { fontSize: 22, fontWeight: '900', color: '#f1f5f9' },
  statsGridLabel: { fontSize: 11, color: '#64748b', fontWeight: '600' },

  // Danger zone
  dangerZone: { gap: 10 },
  actionBtn: { paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  btnWarning: { backgroundColor: 'rgba(249,115,22,0.15)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.4)' },
  btnGreen: { backgroundColor: 'rgba(34,197,94,0.15)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.4)' },
  btnRed: { backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)' },
  actionBtnText: { color: '#f1f5f9', fontWeight: '700', fontSize: 14 },

  // Create form
  submitBtn: { backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
})
