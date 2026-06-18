import client from './client'
import type { Delivery, Order, OrderStatus } from './orders'

export interface UserDetail {
  id: string
  name: string
  email: string
  phone: string | null
  role: 'CLIENT' | 'DELIVERER' | 'ADMIN'
  isAvailable?: boolean
  isSuspended?: boolean
  suspendedReason?: string | null
  createdAt: string
}

export interface UserStats {
  user: UserDetail
  clientStats: {
    totalOrders: number
    completedOrders: number
    cancelledOrders: number
    totalSpent: number
    avgBasket: number
    recentOrders: any[]
    addresses: { id: string; street: string; city: string; zipCode: string; isDefault: boolean }[]
    deliveryAddresses: string[]
    reviews: { id: string; rating: number; comment: string | null; createdAt: string }[]
    avgRatingGiven: number | null
  }
  delivererStats: {
    totalDeliveries: number
    completedDeliveries: number
    cancelledDeliveries: number
    successRate: number
    totalCommissions: number
    recentDeliveries: any[]
  }
}

export interface CreateDelivererPayload {
  name: string
  email: string
  password: string
  phone?: string
}

export interface DashboardStats {
  revenue: {
    total: number
    last7Days: number
    last30Days: number
    daily: { date: string; amount: number }[]
  }
  orders: {
    total: number
    byStatus: Record<string, number>
  }
  users: {
    total: number
    byRole: Record<string, number>
    activeDeliverers: number
  }
  reviews: {
    count: number
    avgRating: number
    recent: {
      id: string
      orderId: string
      customerId: string
      rating: number
      comment: string | null
      createdAt: string
      customer?: {
        id: string
        name: string
      }
    }[]
  }
  topItems: {
    id: string
    name: string
    quantity: number
    revenue: number
    imageUrl?: string | null
  }[]
}

export const getAllUsers = async (
  role?: string,
  isAvailable?: boolean,
  dateFrom?: string,
  dateTo?: string
): Promise<UserDetail[]> => {
  const params: any = {}
  if (role) params.role = role
  if (isAvailable !== undefined) params.isAvailable = isAvailable
  if (dateFrom) params.dateFrom = dateFrom
  if (dateTo) params.dateTo = dateTo

  const res = await client.get<UserDetail[]>('/admin/users', { params })
  return res.data
}

export const getUserStats = async (id: string): Promise<UserStats> => {
  const res = await client.get<UserStats>(`/admin/users/${id}/stats`)
  return res.data
}

export const createDeliverer = async (data: CreateDelivererPayload): Promise<UserDetail> => {
  const res = await client.post<UserDetail>('/admin/users/deliverer', data)
  return res.data
}

export const deleteUser = async (id: string): Promise<{ message: string }> => {
  const res = await client.delete<{ message: string }>(`/admin/users/${id}`)
  return res.data
}

export const updateUser = async (id: string, data: Partial<UserDetail>): Promise<UserDetail> => {
  const res = await client.patch<UserDetail>(`/admin/users/${id}`, data)
  return res.data
}

export const getDashboardStats = async (): Promise<DashboardStats> => {
  const res = await client.get<DashboardStats>('/admin/dashboard/stats')
  return res.data
}

export const assignDeliverer = async (deliveryId: string, delivererId: string): Promise<Delivery> => {
  const res = await client.patch<Delivery>(`/orders/deliveries/${deliveryId}/assign`, { delivererId })
  return res.data
}

export const cancelDelivery = async (deliveryId: string): Promise<Delivery> => {
  const res = await client.patch<Delivery>(`/orders/deliveries/${deliveryId}/cancel`)
  return res.data
}

export const getAllOrders = async (status?: string): Promise<Order[]> => {
  const params: any = {}
  if (status) params.status = status
  const res = await client.get<Order[]>('/orders/all', { params })
  return res.data
}

export const updateOrderStatus = async (orderId: string, status: OrderStatus): Promise<Order> => {
  const res = await client.patch<Order>(`/orders/${orderId}/status`, { status })
  return res.data
}

export const getAvailableDeliverers = async (): Promise<UserDetail[]> => {
  const res = await client.get<UserDetail[]>('/admin/users', { params: { role: 'DELIVERER', isAvailable: true } })
  return res.data
}
