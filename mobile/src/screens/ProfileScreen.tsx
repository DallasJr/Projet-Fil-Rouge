import React from 'react'
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Switch } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../contexts/AuthContext'

export default function ProfileScreen() {
  const { user, logout, isDeliverer, setAvailability } = useAuth()

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
      case 'ADMIN':
        return 'Administrateur'
      case 'DELIVERER':
        return 'Livreur'
      case 'CLIENT':
      default:
        return 'Client'
    }
  }

  const formatMemberDate = (dateString?: string) => {
    if (!dateString) return '—'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      })
    } catch {
      return dateString
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Top Header Card */}
        <View style={styles.headerCard}>
          <Text style={styles.headerTitle}>Mon Profil</Text>
          <Text style={styles.headerSubtitle}>Vos informations personnelles</Text>
        </View>

        {/* Profile Avatar Card */}
        <View style={styles.avatarCard}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {user.name ? user.name.substring(0, 2).toUpperCase() : 'U'}
            </Text>
          </View>
          <Text style={styles.name}>{user.name}</Text>
          <View style={[
            styles.roleBadge,
            user.role === 'ADMIN' ? styles.adminBadge : user.role === 'DELIVERER' ? styles.delivererBadge : styles.clientBadge
          ]}>
            <Text style={styles.roleText}>{getRoleLabel(user.role)}</Text>
          </View>
        </View>

        {/* Profile Info Card */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Informations du compte</Text>
          
          {/* Nom complet */}
          <View style={styles.infoBlock}>
            <Text style={styles.infoBlockLabel}>👤 NOM COMPLET</Text>
            <Text style={styles.infoBlockValue}>{user.name || '—'}</Text>
          </View>

          {/* Adresse Email */}
          <View style={styles.infoBlock}>
            <Text style={styles.infoBlockLabel}>✉️ ADRESSE EMAIL</Text>
            <Text style={styles.infoBlockValue}>{user.email}</Text>
          </View>

          {/* Téléphone */}
          <View style={styles.infoBlock}>
            <Text style={styles.infoBlockLabel}>📞 TÉLÉPHONE</Text>
            <Text style={styles.infoBlockValue}>{user.phone || 'Non renseigné'}</Text>
          </View>

          {/* Rôle */}
          <View style={styles.infoBlock}>
            <Text style={styles.infoBlockLabel}>🛡️ RÔLE</Text>
            <Text style={styles.infoBlockValue}>{getRoleLabel(user.role)}</Text>
          </View>

          {/* Membre depuis */}
          <View style={styles.infoBlock}>
            <Text style={styles.infoBlockLabel}>📅 MEMBRE DEPUIS</Text>
            <Text style={styles.infoBlockValue}>{formatMemberDate(user.createdAt)}</Text>
          </View>

          {/* Availability switch for deliverer */}
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
                  try {
                    await setAvailability(value)
                  } catch (err) {
                    console.error('Failed to update availability:', err)
                  }
                }}
                trackColor={{ false: '#334155', true: '#f97316' }}
                thumbColor={user.isAvailable ? '#fff' : '#94a3b8'}
              />
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutButtonText}>Se déconnecter</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0f14',
  },
  scrollContent: {
    padding: 16,
    alignItems: 'center',
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
  },
  headerCard: {
    backgroundColor: '#151821',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  headerTitle: {
    color: '#f1f5f9',
    fontSize: 22,
    fontWeight: '900',
  },
  headerSubtitle: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
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
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(249,115,22,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 2,
    borderColor: 'rgba(249,115,22,0.4)',
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  avatarText: {
    color: '#f97316',
    fontSize: 28,
    fontWeight: '900',
  },
  name: {
    color: '#f1f5f9',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 8,
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  adminBadge: {
    backgroundColor: 'rgba(249,115,22,0.15)',
    borderColor: 'rgba(249,115,22,0.4)',
  },
  delivererBadge: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderColor: 'rgba(34,197,94,0.4)',
  },
  clientBadge: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderColor: 'rgba(59,130,246,0.4)',
  },
  roleText: {
    color: '#f1f5f9',
    fontSize: 11,
    fontWeight: '800',
  },
  infoSection: {
    width: '100%',
    backgroundColor: '#151821',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  sectionTitle: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  infoBlock: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  infoBlockLabel: {
    color: '#f97316',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  infoBlockValue: {
    color: '#f1f5f9',
    fontSize: 13,
    fontWeight: '700',
  },
  availabilityBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  availabilityStatus: {
    color: '#f1f5f9',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  logoutButton: {
    width: '100%',
    backgroundColor: 'rgba(239,68,68,0.12)',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
  },
  logoutButtonText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '800',
  },
})
