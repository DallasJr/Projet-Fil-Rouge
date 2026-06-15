import axiosClient from './axiosClient'

export type OrderStatus = 'PENDING' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'DELIVERING' | 'DELIVERED' | 'CANCELLED'
export type DeliveryStatus = 'ASSIGNED' | 'PICKED_UP' | 'DELIVERED' | 'CANCELLED'

export interface OrderItemPayload {
  itemId: string
  quantity: number
  note?: string
}

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
  pickedAt: string | null
  deliveredAt: string | null
  confirmedByDeliverer: boolean
  confirmedByCustomer: boolean
  acceptedByDeliverer: boolean
  paymentMethod: 'CREDIT_CARD' | 'PAYPAL' | 'CASH'
  delivererId: string | null
  deliverer?: {
    id: string
    name: string
    email?: string
    phone?: string | null
  } | null
  delivererLat?: number | null
  delivererLng?: number | null
  destLat?: number | null
  destLng?: number | null
  estimatedTime?: number | null
  createdAt?: string
  order?: Order
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
  customer?: {
    id: string
    name: string
    email: string
    phone?: string | null
  }
  items: OrderItemDetail[]
  delivery?: Delivery | null
  reviews?: { id: string; rating: number; comment: string | null; createdAt: string }[]
}

export interface CreateOrderPayload {
  restaurantId: string
  items: OrderItemPayload[]
  note?: string
  deliveryAddress?: string
  paymentMethod?: 'CREDIT_CARD' | 'CASH' | 'PAYPAL'
  tableNumber?: number
}

// ── Client ──
export const createOrder = async (data: CreateOrderPayload): Promise<Order> => {
  const res = await axiosClient.post<Order>('/orders', data)
  return res.data
}

export const getMyOrders = async (): Promise<Order[]> => {
  const res = await axiosClient.get<Order[]>('/orders/my-orders')
  return res.data
}

// ── Admin / Livreur ──
export const getAllOrders = async (): Promise<Order[]> => {
  const res = await axiosClient.get<Order[]>('/orders/all')
  return res.data
}

export const updateOrderStatus = async (id: string, status: OrderStatus): Promise<Order> => {
  const res = await axiosClient.patch<Order>(`/orders/${id}/status`, { status })
  return res.data
}

// ── Livraisons ──
export const getAvailableDeliveries = async (): Promise<Delivery[]> => {
  const res = await axiosClient.get<Delivery[]>('/orders/deliveries/available')
  return res.data
}

export const acceptDelivery = async (deliveryId: string): Promise<Delivery> => {
  const res = await axiosClient.post<Delivery>(`/orders/deliveries/${deliveryId}/accept`)
  return res.data
}

export const updateDeliveryStatus = async (
  deliveryId: string,
  status: DeliveryStatus,
  isPaid?: boolean
): Promise<Delivery> => {
  const res = await axiosClient.patch<Delivery>(`/orders/deliveries/${deliveryId}/status`, {
    status,
    ...(isPaid !== undefined && { isPaid }),
  })
  return res.data
}

export const acceptAssignment = async (deliveryId: string): Promise<Delivery> => {
  const res = await axiosClient.patch<Delivery>(`/orders/deliveries/${deliveryId}/accept-assignment`)
  return res.data
}

export const rejectAssignment = async (deliveryId: string): Promise<Delivery> => {
  const res = await axiosClient.patch<Delivery>(`/orders/deliveries/${deliveryId}/reject-assignment`)
  return res.data
}

export interface Message {
  id: string
  orderId: string
  senderId: string
  content: string
  createdAt: string
  sender: {
    id: string
    name: string
    role: 'CLIENT' | 'DELIVERER' | 'ADMIN'
  }
}

export const getOrderMessages = async (orderId: string): Promise<Message[]> => {
  const res = await axiosClient.get<Message[]>(`/orders/${orderId}/messages`)
  return res.data
}

export const confirmDelivery = async (orderId: string): Promise<Order> => {
  const res = await axiosClient.patch<Order>(`/orders/${orderId}/confirm`)
  return res.data
}

export const updateDelivererLocation = async (
  deliveryId: string,
  lat: number,
  lng: number
): Promise<Delivery> => {
  const res = await axiosClient.patch<Delivery>(`/orders/deliveries/${deliveryId}/location`, { lat, lng })
  return res.data
}

// --- AUDIT LOG ---

export interface AuditLog {
  id: string
  orderId: string
  actorId: string
  actor: {
    id: string
    name: string
    email: string
    role: string
  }
  action: 'STATUS_CHANGE' | 'DELIVERER_ASSIGNED' | 'DELIVERER_REPLACED' | 'DELIVERY_CANCELLED'
  oldValue: string | null
  newValue: string | null
  note: string | null
  createdAt: string
}

export const getOrderAuditLogs = async (orderId: string): Promise<AuditLog[]> => {
  const res = await axiosClient.get<AuditLog[]>(`/orders/${orderId}/audit-logs`)
  return res.data
}

export const downloadOrderInvoice = async (orderId: string): Promise<Blob> => {
  const res = await axiosClient.get(`/orders/${orderId}/invoice`, {
    responseType: 'blob'
  })
  return res.data
}
