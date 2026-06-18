import React, { useState } from 'react'
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView, Switch,
  Modal, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../contexts/AuthContext'
import { changePassword } from '../api/auth'

export default function ProfileScreen() {
  const { user, logout, isDeliverer, setAvailability, updateProfile } = useAuth()

  // Edit profile modal
  const [editVisible, setEditVisible] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')

  // Change password modal
  const [pwVisible, setPwVisible] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Aucun utilisateur connecté</Text>
        </View>
      </SafeAreaView>
    )
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'Administrateur'
      case 'DELIVERER': return 'Livreur'
      default: return 'Client'
    }
  }

  const formatMemberDate = (dateString?: string) => {
    if (!dateString) return '—'
    try {
      return new Date(dateString).toLocaleDateString('fr-FR', {
        day: '2-digit', month: 'long', year: 'numeric',
      })
    } catch {
      return dateString
    }
  }

  const openEditProfile = () => {
    setEditName(user.name || '')
    setEditPhone(user.phone || '')
    setEditError('')
    setEditVisible(true)
  }

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      setEditError('Le nom est obligatoire.')
      return
    }
    setEditLoading(true)
    setEditError('')
    try {
      await updateProfile({ name: editName.trim(), phone: editPhone.trim() || undefined })
      setEditVisible(false)
      Alert.alert('✅ Succès', 'Profil mis à jour !')
    } catch (err: any) {
      setEditError(err?.response?.data?.error || 'Erreur lors de la mise à jour.')
    } finally {
      setEditLoading(false)
    }
  }

  const openChangePassword = () => {
    setCurrentPw('')
    setNewPw('')
    setConfirmPw('')
    setPwError('')
    setPwSuccess(false)
    setPwVisible(true)
  }

  const handleChangePassword = async () => {
    if (!currentPw || !newPw || !confirmPw) {
      setPwError('Tous les champs sont requis.')
      return
    }
    if (newPw.length < 6) {
      setPwError('Le nouveau mot de passe doit contenir au moins 6 caractères.')
      return
    }
    if (newPw !== confirmPw) {
      setPwError('Les mots de passe ne correspondent pas.')
      return
    }
    setPwLoading(true)
    setPwError('')
    try {
      await changePassword({ currentPassword: currentPw, newPassword: newPw })
      setPwSuccess(true)
      setTimeout(() => {
        setPwVisible(false)
        setPwSuccess(false)
      }, 2000)
    } catch (err: any) {
      setPwError(err?.response?.data?.error || 'Erreur lors du changement de mot de passe.')
    } finally {
      setPwLoading(false)
    }
  }

  const roleColor = user.role === 'ADMIN' ? '#f97316' : user.role === 'DELIVERER' ? '#22c55e' : '#3b82f6'

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.headerCard}>
          <Text style={styles.headerTitle}>Mon Profil</Text>
          <Text style={styles.headerSubtitle}>Gérez vos informations personnelles</Text>
        </View>

        {/* Avatar + Name */}
        <View style={styles.avatarCard}>
          <View style={[styles.avatarContainer, { borderColor: roleColor + '66', shadowColor: roleColor }]}>
            <Text style={[styles.avatarText, { color: roleColor }]}>
              {user.name ? user.name.substring(0, 2).toUpperCase() : 'U'}
            </Text>
          </View>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.email}>{user.email}</Text>
          <View style={[styles.roleBadge, { backgroundColor: roleColor + '22', borderColor: roleColor + '55' }]}>
            <Text style={[styles.roleText, { color: roleColor }]}>{getRoleLabel(user.role)}</Text>
          </View>

          {/* Quick action buttons */}
          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.quickActionBtn} onPress={openEditProfile}>
              <Text style={styles.quickActionIcon}>✏️</Text>
              <Text style={styles.quickActionLabel}>Modifier</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionBtn} onPress={openChangePassword}>
              <Text style={styles.quickActionIcon}>🔒</Text>
              <Text style={styles.quickActionLabel}>Mot de passe</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Info section */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Informations du compte</Text>

          <View style={styles.infoBlock}>
            <Text style={styles.infoBlockLabel}>👤 NOM COMPLET</Text>
            <Text style={styles.infoBlockValue}>{user.name || '—'}</Text>
          </View>

          <View style={styles.infoBlock}>
            <Text style={styles.infoBlockLabel}>✉️ ADRESSE EMAIL</Text>
            <Text style={styles.infoBlockValue}>{user.email}</Text>
          </View>

          <View style={styles.infoBlock}>
            <Text style={styles.infoBlockLabel}>📞 TÉLÉPHONE</Text>
            <Text style={styles.infoBlockValue}>{user.phone || 'Non renseigné'}</Text>
          </View>

          <View style={styles.infoBlock}>
            <Text style={styles.infoBlockLabel}>🛡️ RÔLE</Text>
            <Text style={styles.infoBlockValue}>{getRoleLabel(user.role)}</Text>
          </View>

          <View style={styles.infoBlock}>
            <Text style={styles.infoBlockLabel}>📅 MEMBRE DEPUIS</Text>
            <Text style={styles.infoBlockValue}>{formatMemberDate(user.createdAt)}</Text>
          </View>

          {/* Deliverer availability */}
          {isDeliverer && (
            <View style={styles.availabilityBlock}>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoBlockLabel}>⚡ DISPONIBILITÉ LIVREUR</Text>
                <Text style={styles.availabilityStatus}>
                  {user.isAvailable ? '🟢 En ligne' : '🔴 Hors ligne'}
                </Text>
              </View>
              <Switch
                value={user.isAvailable ?? false}
                onValueChange={async (value) => {
                  try { await setAvailability(value) } catch {}
                }}
                trackColor={{ false: '#334155', true: '#f97316' }}
                thumbColor={user.isAvailable ? '#fff' : '#94a3b8'}
              />
            </View>
          )}
        </View>

        {/* Security section */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Sécurité</Text>
          <TouchableOpacity style={styles.actionRow} onPress={openChangePassword}>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionRowTitle}>🔒 Changer le mot de passe</Text>
              <Text style={styles.actionRowSub}>Mettre à jour votre mot de passe</Text>
            </View>
            <Text style={styles.actionRowChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={() =>
          Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Déconnecter', style: 'destructive', onPress: logout },
          ])
        }>
          <Text style={styles.logoutButtonText}>Se déconnecter</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ─── Modal Édition Profil ─── */}
      <Modal visible={editVisible} animationType="slide" transparent onRequestClose={() => setEditVisible(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>✏️ Modifier le profil</Text>

            {!!editError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{editError}</Text>
              </View>
            )}

            <Text style={styles.fieldLabel}>NOM COMPLET</Text>
            <TextInput
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Votre nom complet"
              placeholderTextColor="#475569"
            />

            <Text style={styles.fieldLabel}>TÉLÉPHONE</Text>
            <TextInput
              style={styles.modalInput}
              value={editPhone}
              onChangeText={setEditPhone}
              placeholder="+33 6 00 00 00 00"
              placeholderTextColor="#475569"
              keyboardType="phone-pad"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditVisible(false)}>
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, editLoading && { opacity: 0.6 }]}
                onPress={handleSaveProfile}
                disabled={editLoading}
              >
                {editLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.saveBtnText}>Enregistrer</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Modal Changement Mot de Passe ─── */}
      <Modal visible={pwVisible} animationType="slide" transparent onRequestClose={() => setPwVisible(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>🔒 Changer le mot de passe</Text>

            {pwSuccess ? (
              <View style={styles.successBox}>
                <Text style={styles.successText}>✅ Mot de passe mis à jour !</Text>
              </View>
            ) : (
              <>
                {!!pwError && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{pwError}</Text>
                  </View>
                )}

                <Text style={styles.fieldLabel}>MOT DE PASSE ACTUEL</Text>
                <TextInput
                  style={styles.modalInput}
                  value={currentPw}
                  onChangeText={setCurrentPw}
                  placeholder="••••••••"
                  placeholderTextColor="#475569"
                  secureTextEntry
                />

                <Text style={styles.fieldLabel}>NOUVEAU MOT DE PASSE</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newPw}
                  onChangeText={setNewPw}
                  placeholder="Min. 6 caractères"
                  placeholderTextColor="#475569"
                  secureTextEntry
                />

                <Text style={styles.fieldLabel}>CONFIRMER LE NOUVEAU MDP</Text>
                <TextInput
                  style={styles.modalInput}
                  value={confirmPw}
                  onChangeText={setConfirmPw}
                  placeholder="••••••••"
                  placeholderTextColor="#475569"
                  secureTextEntry
                />

                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setPwVisible(false)}>
                    <Text style={styles.cancelBtnText}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveBtn, pwLoading && { opacity: 0.6 }]}
                    onPress={handleChangePassword}
                    disabled={pwLoading}
                  >
                    {pwLoading
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.saveBtnText}>Mettre à jour</Text>
                    }
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0f14' },
  scrollContent: { padding: 16, alignItems: 'center', paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#ef4444', fontSize: 13, fontWeight: '600' },

  headerCard: {
    backgroundColor: '#151821',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  headerTitle: { color: '#f1f5f9', fontSize: 22, fontWeight: '900' },
  headerSubtitle: { color: '#64748b', fontSize: 12, marginTop: 2 },

  avatarCard: {
    backgroundColor: '#151821',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  avatarContainer: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(249,115,22,0.12)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 5,
  },
  avatarText: { fontSize: 28, fontWeight: '900' },
  name: { color: '#f1f5f9', fontSize: 20, fontWeight: '900', marginBottom: 4 },
  email: { color: '#64748b', fontSize: 13, marginBottom: 10 },
  roleBadge: {
    paddingHorizontal: 14, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, marginBottom: 16,
  },
  roleText: { fontSize: 11, fontWeight: '800' },

  quickActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  quickActionBtn: {
    alignItems: 'center', padding: 12, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    minWidth: 80,
  },
  quickActionIcon: { fontSize: 20, marginBottom: 4 },
  quickActionLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '700' },

  infoSection: {
    width: '100%',
    backgroundColor: '#151821',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  sectionTitle: {
    color: '#64748b', fontSize: 11, fontWeight: '800',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16,
  },
  infoBlock: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10, padding: 12, marginBottom: 10,
  },
  infoBlockLabel: {
    color: '#f97316', fontSize: 10, fontWeight: '800', marginBottom: 4, letterSpacing: 0.5,
  },
  infoBlockValue: { color: '#f1f5f9', fontSize: 13, fontWeight: '700' },

  availabilityBlock: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10, padding: 12, marginBottom: 10,
  },
  availabilityStatus: { color: '#f1f5f9', fontSize: 13, fontWeight: '800', marginTop: 2 },

  actionRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10, padding: 14,
  },
  actionRowTitle: { color: '#f1f5f9', fontSize: 13, fontWeight: '700' },
  actionRowSub: { color: '#64748b', fontSize: 11, marginTop: 2 },
  actionRowChevron: { color: '#475569', fontSize: 22, fontWeight: '300' },

  logoutButton: {
    width: '100%',
    backgroundColor: 'rgba(239,68,68,0.12)',
    paddingVertical: 14, borderRadius: 12, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)',
  },
  logoutButtonText: { color: '#ef4444', fontSize: 14, fontWeight: '800' },

  // Modal styles
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#151821',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  modalTitle: {
    color: '#f1f5f9', fontSize: 18, fontWeight: '900', marginBottom: 20, textAlign: 'center',
  },
  fieldLabel: {
    color: '#64748b', fontSize: 10, fontWeight: '800', letterSpacing: 0.8,
    marginBottom: 6, marginTop: 12, textTransform: 'uppercase',
  },
  modalInput: {
    backgroundColor: '#1e2333',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10, height: 48,
    paddingHorizontal: 14,
    color: '#f1f5f9', fontSize: 14,
  },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn: {
    flex: 1, height: 48, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  cancelBtnText: { color: '#94a3b8', fontSize: 14, fontWeight: '700' },
  saveBtn: {
    flex: 1, height: 48, borderRadius: 10,
    backgroundColor: '#f97316',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#f97316', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 10, padding: 12, marginBottom: 8,
  },
  successBox: {
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)',
    borderRadius: 10, padding: 16, marginBottom: 8, alignItems: 'center',
  },
  successText: { color: '#22c55e', fontSize: 14, fontWeight: '700' },
})
