import client from './client'

export type OrderStatus = 'PENDING' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'DELIVERING' | 'DELIVERED' | 'CANCELLED'
export type DeliveryStatus = 'ASSIGNED' | 'PICKED_UP' | 'DELIVERED' | 'CANCELLED'

export interface OrderItemDetail {
  id: string
  itemId: string
  quantity: number
  unitPrice: number
  note: string | null
  item: {
    id: string
    name: string
    imageUrl?: string | null
    description?: string | null
    price?: number
  }
}

export interface Delivery {
  id: string
  orderId: string
  deliveryAddress: string
  status: DeliveryStatus
  deliveryFee: number
  isPaid: boolean
  confirmedByDeliverer: boolean
  confirmedByCustomer: boolean
  acceptedByDeliverer: boolean
  paymentMethod: 'CREDIT_CARD' | 'PAYPAL' | 'CASH'
  delivererId: string | null
  deliverer?: { id: string; name: string; phone?: string | null } | null
  delivererLat?: number | null
  delivererLng?: number | null
  destLat?: number | null
  destLng?: number | null
  estimatedTime?: number | null
  createdAt?: string
}

export interface Order {
  id: string
  status: OrderStatus
  totalAmount: number
  note: string | null
  restaurantId: string
  createdAt: string
  updatedAt: string
  customerId: string
  items: OrderItemDetail[]
  delivery?: Delivery | null
}

export interface CreateOrderPayload {
  restaurantId: string
  items: { itemId: string; quantity: number; note?: string }[]
  note?: string
  deliveryAddress?: string
  paymentMethod?: 'CREDIT_CARD' | 'CASH' | 'PAYPAL'
}

export const getMyOrders = async (): Promise<Order[]> => {
  const res = await client.get<Order[]>('/orders/my-orders')
  return res.data
}

export const createOrder = async (data: CreateOrderPayload): Promise<Order> => {
  const res = await client.post<Order>('/orders', data)
  return res.data
}

export const confirmDelivery = async (orderId: string): Promise<Order> => {
  const res = await client.patch<Order>(`/orders/${orderId}/confirm`)
  return res.data
}

export const getAvailableDeliveries = async (): Promise<Delivery[]> => {
  const res = await client.get<Delivery[]>('/orders/deliveries/available')
  return res.data
}

export const acceptDelivery = async (deliveryId: string): Promise<Delivery> => {
  const res = await client.post<Delivery>(`/orders/deliveries/${deliveryId}/accept`)
  return res.data
}

export const updateDeliveryStatus = async (
  deliveryId: string,
  status: DeliveryStatus,
  isPaid?: boolean
): Promise<Delivery> => {
  const res = await client.patch<Delivery>(`/orders/deliveries/${deliveryId}/status`, {
    status,
    ...(isPaid !== undefined && { isPaid }),
  })
  return res.data
}

export const getMyDeliveries = async (): Promise<Order[]> => {
  const res = await client.get<Order[]>('/orders/deliveries/mine')
  return res.data
}

export const acceptAssignment = async (deliveryId: string): Promise<Delivery> => {
  const res = await client.patch<Delivery>(`/orders/deliveries/${deliveryId}/accept-assignment`)
  return res.data
}

export const rejectAssignment = async (deliveryId: string): Promise<Delivery> => {
  const res = await client.patch<Delivery>(`/orders/deliveries/${deliveryId}/reject-assignment`)
  return res.data
}

export const updateDelivererLocation = async (
  deliveryId: string,
  lat: number,
  lng: number
): Promise<Delivery> => {
  const res = await client.patch<Delivery>(`/orders/deliveries/${deliveryId}/location`, { lat, lng })
  return res.data
}

