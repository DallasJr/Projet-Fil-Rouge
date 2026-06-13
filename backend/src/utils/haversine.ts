/**
 * Utilitaires GPS — Lot 2 Géolocalisation
 */

const EARTH_RADIUS_KM = 6371

/**
 * Calcule la distance à vol d'oiseau entre deux points GPS (formule Haversine)
 * @returns Distance en kilomètres
 */
export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180

  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_KM * c
}

/**
 * Calcule l'ETA en minutes à partir d'une distance en km
 * @param distanceKm Distance en km
 * @param speedKmh   Vitesse moyenne (défaut : 20 km/h pour scooter/vélo urbain)
 * @returns ETA en minutes (arrondi)
 */
export function calculateETA(distanceKm: number, speedKmh = 20): number {
  return Math.round((distanceKm / speedKmh) * 60)
}

/**
 * Géocode une adresse texte en coordonnées GPS via l'API adresse.data.gouv.fr
 * Fallback : retourne null si l'adresse est introuvable ou l'API indisponible
 */
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const encoded = encodeURIComponent(address)
    const url = `https://api-adresse.data.gouv.fr/search/?q=${encoded}&limit=1`

    const response = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!response.ok) return null

    const data = await response.json() as any

    if (!data.features || data.features.length === 0) return null

    const feature = data.features[0]
    const score: number = feature.properties?.score ?? 0

    // On rejette les résultats avec un score de confiance trop bas (< 0.4)
    if (score < 0.4) return null

    const [lng, lat] = feature.geometry.coordinates as [number, number]
    return { lat, lng }
  } catch {
    // Timeout ou réseau indisponible → fallback silencieux
    return null
  }
}
