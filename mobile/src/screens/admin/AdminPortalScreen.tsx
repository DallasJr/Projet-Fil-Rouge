import React from 'react'
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'

export default function AdminPortalScreen() {
  const navigation = useNavigation<any>()

  const adminModules = [
    {
      title: 'Dashboard',
      desc: 'Revenus, commandes en temps réel et performances des ventes.',
      screen: 'AdminDashboard',
      icon: '📊',
      color: '#6366f1',
    },
    {
      title: 'Utilisateurs',
      desc: 'Gérer les rôles, modifier les comptes, suspendre ou supprimer.',
      screen: 'AdminUsers',
      icon: '👥',
      color: '#3b82f6',
    },
    {
      title: 'Gestion du Menu',
      desc: 'Ajouter, éditer des plats et gérer les catégories.',
      screen: 'AdminMenu',
      icon: '🍔',
      color: '#f97316',
    },
  ]

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Text style={styles.headerEmoji}>🛠️</Text>
        </View>
        <View>
          <Text style={styles.headerTitle}>Administration</Text>
          <Text style={styles.headerSub}>Contrôle et gestion de la plateforme</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {adminModules.map((mod, idx) => (
          <TouchableOpacity
            key={idx}
            style={[styles.card, { borderLeftColor: mod.color, borderLeftWidth: 4 }]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate(mod.screen)}
          >
            <View style={[styles.iconContainer, { backgroundColor: mod.color + '15', borderColor: mod.color + '30' }]}>
              <Text style={styles.icon}>{mod.icon}</Text>
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>{mod.title}</Text>
              <Text style={styles.cardDesc}>{mod.desc}</Text>
            </View>
            <Text style={styles.cardChevron}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0f14',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerEmoji: { fontSize: 24 },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#f1f5f9',
  },
  headerSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  card: {
    backgroundColor: '#151821',
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    gap: 14,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  icon: { fontSize: 24 },
  cardInfo: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f1f5f9',
  },
  cardDesc: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 17,
  },
  cardChevron: {
    color: '#475569',
    fontSize: 24,
  },
})
