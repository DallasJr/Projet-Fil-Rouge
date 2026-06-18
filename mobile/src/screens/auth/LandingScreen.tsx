import React, { useEffect, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Image, Animated, Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { StackScreenProps } from '@react-navigation/stack'
import type { RootStackParamList } from '../../navigation/RootNavigator'

const { width: SCREEN_W } = Dimensions.get('window')

type Props = StackScreenProps<RootStackParamList, 'Landing'>

/* ─── Static featured dishes (mirrors web landing) ──────────────────────────── */
const FEATURED = [
  {
    id: '1',
    name: 'Burger Gourmet',
    price: '14,90 €',
    rating: '4.9',
    reviews: 120,
    delivery: '~30 min',
    badge: '🔥 Populaire',
    badgeColor: '#ef4444',
    kcal: '780 kcal',
    desc: 'Double steak Black Angus, cheddar affiné, oignons caraméliés & notre sauce secrète maison.',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80',
  },
  {
    id: '2',
    name: 'Pizza Truffe & Prosciutto',
    price: '16,50 €',
    rating: '4.8',
    reviews: 85,
    delivery: '~30 min',
    badge: '💎 Signature',
    badgeColor: '#6366f1',
    kcal: '650 kcal',
    desc: 'Base crème truffe blanche, mozzarella di bufala, prosciutto crudo & roquette fraîche.',
    image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&q=80',
  },
  {
    id: '3',
    name: 'Poke Bowl Saumon Avocat',
    price: '13,90 €',
    rating: '4.7',
    reviews: 95,
    delivery: '~30 min',
    badge: '🥗 Healthy',
    badgeColor: '#22c55e',
    kcal: '520 kcal',
    desc: 'Saumon mariné premium, avocat crémeux, riz vinaigré, mangue fraîche & sésame grillé.',
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80',
  },
]

const HERO_IMAGE = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=700&q=80'

export default function LandingScreen({ navigation }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current
  const badgeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.sequence([
      Animated.delay(100),
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
      Animated.timing(badgeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start()
  }, [])

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Nav Bar ── */}
        <View style={styles.nav}>
          <View style={styles.navBrand}>
            <View style={styles.navLogo}>
              <Text style={styles.navLogoText}>🍽️</Text>
            </View>
            <Text style={styles.navBrandText}>RestauApp</Text>
          </View>
          <View style={styles.navActions}>
            <TouchableOpacity
              style={styles.navBtnOutline}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.navBtnOutlineText}>Se connecter</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.navBtnFill}
              onPress={() => navigation.navigate('Register')}
            >
              <Text style={styles.navBtnFillText}>S'inscrire</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Hero Section ── */}
        <View style={styles.hero}>
          {/* Left text */}
          <Animated.View style={[styles.heroText, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            {/* Badge */}
            <Animated.View style={[styles.heroBadge, { opacity: badgeAnim }]}>
              <Text style={styles.heroBadgeStar}>⭐</Text>
              <Text style={styles.heroBadgeText}>+500 commandes livrées ce mois</Text>
            </Animated.View>

            <Text style={styles.heroH1}>
              La bonne cuisine,{'\n'}
              <Text style={styles.heroH1Orange}>livrée chez vous.</Text>
            </Text>

            <Text style={styles.heroDesc}>
              Commandez en ligne, suivez votre livreur en temps réel et savourez des plats du chef. Simple, rapide, délicieux.
            </Text>

            {/* CTA buttons */}
            <View style={styles.ctaRow}>
              <TouchableOpacity
                style={styles.ctaPrimary}
                onPress={() => navigation.navigate('Login')}
                activeOpacity={0.85}
              >
                <Text style={styles.ctaPrimaryText}>🍽 Voir le menu →</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.ctaSecondary}
                onPress={() => navigation.navigate('Login')}
                activeOpacity={0.85}
              >
                <Text style={styles.ctaSecondaryText}>Déjà client ?</Text>
              </TouchableOpacity>
            </View>

            {/* Trust badges */}
            <View style={styles.trustRow}>
              <View style={styles.trustItem}>
                <Text style={styles.trustIcon}>⏱</Text>
                <Text style={styles.trustText}>Livraison ~30 min</Text>
              </View>
              <View style={styles.trustItem}>
                <Text style={styles.trustIcon}>📅</Text>
                <Text style={styles.trustText}>Livraison 7j/7</Text>
              </View>
              <View style={styles.trustItem}>
                <Text style={styles.trustIcon}>⭐</Text>
                <Text style={styles.trustText}>4.9 / 5</Text>
              </View>
            </View>
          </Animated.View>

          {/* Hero image card */}
          <View style={styles.heroCard}>
            <Image
              source={{ uri: HERO_IMAGE }}
              style={styles.heroImage}
              resizeMode="cover"
            />
            {/* Overlay badges */}
            <View style={styles.heroCardPopular}>
              <Text style={styles.heroCardPopularText}>🔥 Populaire</Text>
            </View>
            <View style={styles.heroCardRating}>
              <Text style={styles.ratingStars}>★★★★★</Text>
              <Text style={styles.ratingLabel}>+500 clients satisfaits</Text>
            </View>
            <View style={styles.heroCardInfo}>
              <Text style={styles.heroCardName}>Burger Gourmet</Text>
              <Text style={styles.heroCardPrice}>14,90 €</Text>
            </View>
            {/* Delivery chip */}
            <View style={styles.deliveryChip}>
              <Text style={styles.deliveryChipIcon}>🚴</Text>
              <View>
                <Text style={styles.deliveryChipTitle}>En route</Text>
                <Text style={styles.deliveryChipSub}>Arrivée dans ~28 min</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Featured Dishes Section ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nos plats incontournables</Text>
          <Text style={styles.sectionSub}>
            Sélectionnés chaque semaine par notre chef selon les arrivages et saisons.
          </Text>

          {FEATURED.map(dish => (
            <View key={dish.id} style={styles.dishCard}>
              {/* Image */}
              <View style={styles.dishImageBox}>
                <Image
                  source={{ uri: dish.image }}
                  style={styles.dishImage}
                  resizeMode="cover"
                />
                <View style={[styles.dishBadge, { backgroundColor: dish.badgeColor }]}>
                  <Text style={styles.dishBadgeText}>{dish.badge}</Text>
                </View>
                <View style={styles.dishKcal}>
                  <Text style={styles.dishKcalText}>🔥 {dish.kcal}</Text>
                </View>
              </View>

              {/* Info */}
              <View style={styles.dishInfo}>
                <View style={styles.dishNameRow}>
                  <Text style={styles.dishName}>{dish.name}</Text>
                  <Text style={styles.dishPrice}>{dish.price}</Text>
                </View>
                <View style={styles.dishMeta}>
                  <Text style={styles.dishRating}>⭐ {dish.rating} ({dish.reviews} avis)</Text>
                  <Text style={styles.dishDot}> · </Text>
                  <Text style={styles.dishDelivery}>Livraison {dish.delivery}</Text>
                </View>
                <Text style={styles.dishDesc}>{dish.desc}</Text>
                <TouchableOpacity
                  style={styles.dishBtn}
                  onPress={() => navigation.navigate('Login')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.dishBtnText}>Commander ce plat →</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* ── Footer CTA ── */}
        <View style={styles.footerCta}>
          <Text style={styles.footerCtaTitle}>Prêt à commander ?</Text>
          <Text style={styles.footerCtaSub}>Rejoignez +500 clients satisfaits</Text>
          <TouchableOpacity
            style={styles.footerCtaBtn}
            onPress={() => navigation.navigate('Register')}
            activeOpacity={0.85}
          >
            <Text style={styles.footerCtaBtnText}>Créer mon compte gratuitement</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.footerCtaLogin}>Déjà inscrit ? Se connecter</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f111a',
  },
  scroll: {
    paddingBottom: 40,
  },

  /* ── Nav ── */
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  navBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navLogo: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#c2410c',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navLogoText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 14,
  },
  navBrandText: {
    color: '#f1f5f9',
    fontWeight: '900',
    fontSize: 17,
  },
  navActions: {
    flexDirection: 'row',
    gap: 8,
  },
  navBtnOutline: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  navBtnOutlineText: {
    color: '#f1f5f9',
    fontSize: 12,
    fontWeight: '700',
  },
  navBtnFill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#f97316',
  },
  navBtnFillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },

  /* ── Hero ── */
  hero: {
    padding: 20,
    paddingTop: 28,
    gap: 28,
  },
  heroText: {
    gap: 14,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(249,115,22,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.25)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  heroBadgeStar: { fontSize: 13 },
  heroBadgeText: {
    color: '#f97316',
    fontSize: 12,
    fontWeight: '700',
  },
  heroH1: {
    fontSize: 34,
    fontWeight: '900',
    color: '#f1f5f9',
    lineHeight: 42,
    letterSpacing: -0.5,
  },
  heroH1Orange: {
    color: '#f97316',
  },
  heroDesc: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 22,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  ctaPrimary: {
    backgroundColor: '#f97316',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 13,
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  ctaPrimaryText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  ctaSecondary: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  ctaSecondaryText: {
    color: '#f1f5f9',
    fontWeight: '700',
    fontSize: 14,
  },
  trustRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trustIcon: { fontSize: 12, color: '#64748b' },
  trustText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },

  /* Hero card */
  heroCard: {
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    height: 220,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroCardPopular: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  heroCardPopularText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  heroCardRating: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
  },
  ratingStars: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '800',
  },
  ratingLabel: {
    color: '#1e293b',
    fontSize: 10,
    fontWeight: '600',
  },
  heroCardInfo: {
    position: 'absolute',
    bottom: 42,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroCardName: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 16,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroCardPrice: {
    backgroundColor: '#f97316',
    color: '#fff',
    fontWeight: '900',
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  deliveryChip: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  deliveryChipIcon: { fontSize: 18 },
  deliveryChipTitle: {
    color: '#1e293b',
    fontWeight: '800',
    fontSize: 13,
  },
  deliveryChipSub: {
    color: '#64748b',
    fontSize: 11,
  },

  /* ── Featured Dishes ── */
  section: {
    padding: 20,
    paddingTop: 32,
    backgroundColor: '#f8fafc',
  },
  sectionTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  sectionSub: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  dishCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  dishImageBox: {
    position: 'relative',
    height: 200,
  },
  dishImage: {
    width: '100%',
    height: '100%',
  },
  dishBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dishBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  dishKcal: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  dishKcalText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  dishInfo: {
    padding: 16,
    gap: 8,
  },
  dishNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dishName: {
    fontSize: 17,
    fontWeight: '900',
    color: '#1e293b',
    flex: 1,
    marginRight: 8,
  },
  dishPrice: {
    fontSize: 18,
    fontWeight: '900',
    color: '#f97316',
  },
  dishMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dishRating: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  dishDot: {
    color: '#94a3b8',
    fontSize: 12,
  },
  dishDelivery: {
    color: '#64748b',
    fontSize: 12,
  },
  dishDesc: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 19,
  },
  dishBtn: {
    backgroundColor: '#f97316',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  dishBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },

  /* ── Footer CTA ── */
  footerCta: {
    backgroundColor: '#0f111a',
    padding: 28,
    alignItems: 'center',
    gap: 12,
  },
  footerCtaTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#f1f5f9',
    textAlign: 'center',
  },
  footerCtaSub: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
  },
  footerCtaBtn: {
    width: '100%',
    backgroundColor: '#f97316',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  footerCtaBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  footerCtaLogin: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
})
