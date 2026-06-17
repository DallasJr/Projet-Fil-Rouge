import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native'
import { useRoute, useNavigation } from '@react-navigation/native'
import { useAuth } from '../contexts/AuthContext'
import { getMyOrders, updateDelivererLocation, Order } from '../api/orders'

export default function OrderTrackingScreen() {
  const route = useRoute<any>()
  const navigation = useNavigation()
  const { user } = useAuth()
  const { orderId } = route.params || {}

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [simulating, setSimulating] = useState(false)
  const simulationInterval = useRef<any>(null)

  const isDelivererOrAdmin = user?.role === 'DELIVERER' || user?.role === 'ADMIN'

  const fetchOrderDetails = useCallback(async () => {
    try {
      const orders = await getMyOrders()
      const found = orders.find((o) => o.id === orderId)
      if (found) {
        setOrder(found)
      }
    } catch (err) {
      console.error('Error fetching order tracking details:', err)
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    fetchOrderDetails()
    // Poll for status updates every 5 seconds
    const interval = setInterval(fetchOrderDetails, 5000)
    return () => {
      clearInterval(interval)
      if (simulationInterval.current) clearInterval(simulationInterval.current)
    }
  }, [fetchOrderDetails])

  const startGPSSimulation = () => {
    if (!order || !order.delivery) {
      Alert.alert('Erreur', 'Pas de livraison associée à cette commande.')
      return
    }

    if (simulating) {
      if (simulationInterval.current) clearInterval(simulationInterval.current)
      setSimulating(false)
      return
    }

    // Starting points: Restaurant coordinates (around Paris center as placeholder)
    let currentLat = 48.8566
    let currentLng = 2.3522
    // Destination coordinates or random destination if not available
    const destLat = order.delivery.destLat || 48.8600
    const destLng = order.delivery.destLng || 2.3600

    setSimulating(true)
    let step = 0
    const totalSteps = 10

    simulationInterval.current = setInterval(async () => {
      step++
      const ratio = step / totalSteps
      const nextLat = currentLat + (destLat - currentLat) * ratio
      const nextLng = currentLng + (destLng - currentLng) * ratio

      try {
        await updateDelivererLocation(order.delivery!.id, nextLat, nextLng)
        fetchOrderDetails()
      } catch (err) {
        console.error('Error in simulation location update:', err)
      }

      if (step >= totalSteps) {
        if (simulationInterval.current) clearInterval(simulationInterval.current)
        setSimulating(false)
        Alert.alert('Simulation terminée', 'Le livreur est arrivé à destination !')
      }
    }, 3000)
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      </SafeAreaView>
    )
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Commande non trouvée</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const steps = [
    { label: 'Reçue', active: ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'DELIVERING', 'DELIVERED'].includes(order.status) },
    { label: 'Préparation', active: ['PREPARING', 'READY', 'DELIVERING', 'DELIVERED'].includes(order.status) },
    { label: 'Prête', active: ['READY', 'DELIVERING', 'DELIVERED'].includes(order.status) },
    { label: 'En livraison', active: ['DELIVERING', 'DELIVERED'].includes(order.status) },
    { label: 'Livrée', active: order.status === 'DELIVERED' || order.delivery?.status === 'DELIVERED' },
  ]

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Suivi Commande</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Info Card */}
        <View style={styles.card}>
          <Text style={styles.orderId}>Commande #{order.id.substring(0, 8)}</Text>
          <Text style={styles.restaurantName}>Restaurant: SmartCafé</Text>
          <Text style={styles.totalText}>Total: {order.totalAmount.toFixed(2)} €</Text>
        </View>

        {/* Timeline Progress */}
        <View style={styles.progressContainer}>
          <Text style={styles.sectionTitle}>Statut de la préparation</Text>
          <View style={styles.timeline}>
            {steps.map((step, idx) => (
              <View key={idx} style={styles.timelineStep}>
                <View style={[styles.timelineDot, step.active && styles.timelineDotActive]}>
                  {step.active && <View style={styles.timelineDotInner} />}
                </View>
                <Text style={[styles.timelineLabel, step.active && styles.timelineLabelActive]}>
                  {step.label}
                </Text>
                {idx < steps.length - 1 && (
                  <View style={[styles.timelineLine, steps[idx + 1].active && styles.timelineLineActive]} />
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Radar Simulator Map Area */}
        <View style={styles.mapContainer}>
          <Text style={styles.sectionTitle}>Localisation du Livreur (Radar)</Text>
          <View style={styles.radarBackground}>
            <View style={styles.radarCircle1} />
            <View style={styles.radarCircle2} />
            <View style={styles.radarCircle3} />
            
            {/* Coordinates and position details */}
            <View style={styles.coordinatesOverlay}>
              <Text style={styles.radarText}>📍 Client : {order.delivery?.deliveryAddress || 'Adresse en table'}</Text>
              {order.delivery?.delivererLat ? (
                <>
                  <Text style={styles.radarText}>
                    🚴 Position Livreur : {order.delivery.delivererLat.toFixed(5)}, {order.delivery.delivererLng?.toFixed(5)}
                  </Text>
                  {order.delivery.estimatedTime && (
                    <Text style={styles.etaText}>🕒 ETA Estimée : {order.delivery.estimatedTime} min</Text>
                  )}
                </>
              ) : (
                <Text style={styles.radarText}>🚴 Livreur en attente de récupération...</Text>
              )}
            </View>
          </View>
        </View>

        {/* Deliverer Control Panel */}
        {isDelivererOrAdmin && order.delivery && (
          <View style={styles.controlPanel}>
            <Text style={styles.controlTitle}>🛠️ Mode Démo / Présentation Oral</Text>
            <Text style={styles.controlDesc}>
              Simulez la position GPS du livreur en déplacement vers l'adresse client en temps réel.
            </Text>
            <TouchableOpacity
              style={[styles.simButton, simulating && styles.simButtonActive]}
              onPress={startGPSSimulation}
            >
              <Text style={styles.simButtonText}>
                {simulating ? '⏹️ Arrêter la Simulation' : '🚀 Lancer la Simulation GPS'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backArrow: {
    color: '#6366f1',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 20,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  orderId: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  restaurantName: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 6,
  },
  totalText: {
    color: '#6366f1',
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressContainer: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  timeline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    position: 'relative',
    height: 60,
  },
  timelineStep: {
    alignItems: 'center',
    flex: 1,
  },
  timelineDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  timelineDotActive: {
    backgroundColor: '#6366f1',
  },
  timelineDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ffffff',
  },
  timelineLabel: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 8,
    textAlign: 'center',
  },
  timelineLabelActive: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  timelineLine: {
    position: 'absolute',
    top: 9,
    left: '50%',
    width: '100%',
    height: 2,
    backgroundColor: '#334155',
    zIndex: 1,
  },
  timelineLineActive: {
    backgroundColor: '#6366f1',
  },
  mapContainer: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  radarBackground: {
    height: 180,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  radarCircle1: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: '#6366f122',
    position: 'absolute',
  },
  radarCircle2: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
    borderColor: '#6366f115',
    position: 'absolute',
  },
  radarCircle3: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#6366f108',
    position: 'absolute',
  },
  coordinatesOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
  },
  radarText: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 4,
  },
  etaText: {
    color: '#10b981',
    fontSize: 13,
    fontWeight: 'bold',
  },
  controlPanel: {
    backgroundColor: '#1e1b4b',
    borderColor: '#4338ca',
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  controlTitle: {
    color: '#c084fc',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  controlDesc: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 16,
  },
  simButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  simButtonActive: {
    backgroundColor: '#ef4444',
  },
  simButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
})
