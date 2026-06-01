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
  delivererId: string | null
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
