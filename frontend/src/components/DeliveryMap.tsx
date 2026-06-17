import React from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Custom DivIcons using inline SVG for maximum compatibility and modern look in Vite
const createSvgIcon = (color: string, iconContent: string) => {
  return L.divIcon({
    className: 'custom-leaflet-icon',
    html: `
      <div style="
        display: flex;
        justify-content: center;
        align-items: center;
        width: 40px;
        height: 40px;
        background-color: white;
        border: 3px solid ${color};
        border-radius: 50%;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      ">
        ${iconContent}
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  })
}

// SVG Icons
const restaurantIcon = createSvgIcon('#EF4444', `
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 9 12 2l9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
`)

const clientIcon = createSvgIcon('#10B981', `
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
`)

const delivererIcon = createSvgIcon('#3B82F6', `
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="5.5" cy="17.5" r="2.5"/>
    <circle cx="18.5" cy="17.5" r="2.5"/>
    <path d="M15 6h1a2 2 0 0 1 2 2v2"/>
    <path d="M12 17.5V14H7.5"/>
    <path d="m14 9-2.5-4H9"/>
    <path d="M8 10h5"/>
    <path d="m15 11 3 3"/>
  </svg>
`)

interface DeliveryMapProps {
  restaurantLat?: number
  restaurantLng?: number
  destLat?: number | null
  destLng?: number | null
  delivererLat?: number | null
  delivererLng?: number | null
  estimatedTime?: number | null
  height?: string
}

// Map controller to dynamically fit the bounds of all markers on the map
function MapBoundsController({ points }: { points: [number, number][] }) {
  const map = useMap()
  React.useEffect(() => {
    const validPoints = points.filter(p => p[0] !== undefined && p[1] !== undefined && p[0] !== null && p[1] !== null && !isNaN(p[0]) && !isNaN(p[1]))
    if (validPoints.length > 0) {
      if (validPoints.length === 1) {
        map.setView(validPoints[0], 14)
      } else {
        const bounds = L.latLngBounds(validPoints)
        map.fitBounds(bounds, { padding: [40, 40] })
      }
    }
  }, [points, map])

  return null
}

export const DeliveryMap: React.FC<DeliveryMapProps> = ({
  restaurantLat = 48.8566,
  restaurantLng = 2.3522,
  destLat,
  destLng,
  delivererLat,
  delivererLng,
  estimatedTime,
  height = '400px'
}) => {
  const hasDest = destLat !== undefined && destLat !== null && destLng !== undefined && destLng !== null
  const hasDeliverer = delivererLat !== undefined && delivererLat !== null && delivererLng !== undefined && delivererLng !== null

  // Accumulate points to fit bounds
  const points: [number, number][] = [[restaurantLat, restaurantLng]]
  if (hasDest) points.push([destLat as number, destLng as number])
  if (hasDeliverer) points.push([delivererLat as number, delivererLng as number])

  // Coordinates for polyline
  const polylineCoords: [number, number][] = []
  if (hasDeliverer) {
    polylineCoords.push([delivererLat as number, delivererLng as number])
    if (hasDest) {
      polylineCoords.push([destLat as number, destLng as number])
    }
  } else {
    polylineCoords.push([restaurantLat, restaurantLng])
    if (hasDest) {
      polylineCoords.push([destLat as number, destLng as number])
    }
  }

  return (
    <div className="relative w-full rounded-2xl overflow-hidden shadow-lg border border-gray-100 bg-gray-50">
      {!hasDest && (
        <div className="absolute top-4 left-4 right-4 bg-orange-600/90 text-white backdrop-blur-md p-3 rounded-xl shadow-lg z-[1000] text-xs font-semibold flex items-center space-x-2 transition-all">
          <span>📍 L'adresse textuelle n'a pas pu être géolocalisée précisément. Le livreur se guidera via l'adresse écrite.</span>
        </div>
      )}
      <MapContainer
        center={[restaurantLat, restaurantLng]}
        zoom={13}
        style={{ width: '100%', height }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Restaurant Marker */}
        <Marker position={[restaurantLat, restaurantLng]} icon={restaurantIcon}>
          <Popup>
            <div className="font-semibold text-gray-800">Restaurant</div>
            <div className="text-xs text-gray-500">Point de départ</div>
          </Popup>
        </Marker>

        {/* Client/Destination Marker */}
        {hasDest && (
          <Marker position={[destLat as number, destLng as number]} icon={clientIcon}>
            <Popup>
              <div className="font-semibold text-gray-800">Client</div>
              <div className="text-xs text-gray-500">Adresse de livraison</div>
            </Popup>
          </Marker>
        )}

        {/* Deliverer Marker */}
        {hasDeliverer && (
          <Marker position={[delivererLat as number, delivererLng as number]} icon={delivererIcon}>
            <Popup>
              <div className="font-semibold text-blue-600">Livreur en mouvement</div>
              {estimatedTime !== undefined && estimatedTime !== null && (
                <div className="text-xs text-gray-600 font-medium mt-1">
                  Arrivée estimée : {Math.ceil(estimatedTime)} min
                </div>
              )}
            </Popup>
          </Marker>
        )}

        {/* Polyline path */}
        {polylineCoords.length > 1 && (
          <Polyline
            positions={polylineCoords}
            color="#3B82F6"
            weight={4}
            opacity={0.7}
            dashArray="10, 10"
          />
        )}

        {/* Fits zoom to show all active markers */}
        <MapBoundsController points={points} />
      </MapContainer>

      {/* Modern Overlay Info Banner */}
      {estimatedTime !== undefined && estimatedTime !== null && estimatedTime > 0 && (
        <div className="absolute bottom-4 left-4 right-4 md:left-6 md:right-auto md:w-80 bg-white/95 backdrop-blur-md p-4 rounded-xl shadow-xl border border-gray-100 z-[1000] transition-all animate-fade-in">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Temps estimé</p>
              <p className="text-lg font-bold text-gray-800">
                {Math.ceil(estimatedTime)} min restant{Math.ceil(estimatedTime) > 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
