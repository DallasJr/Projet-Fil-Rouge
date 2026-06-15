import axiosClient from './axiosClient'
import type { Delivery } from './orders.api'

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

// Liste des utilisateurs
export const getAllUsers = async (role?: string, isAvailable?: boolean, dateFrom?: string, dateTo?: string): Promise<UserDetail[]> => {
  const params: any = {}
  if (role) params.role = role
  if (isAvailable !== undefined) params.isAvailable = isAvailable
  if (dateFrom) params.dateFrom = dateFrom
  if (dateTo) params.dateTo = dateTo

  const res = await axiosClient.get<UserDetail[]>('/admin/users', { params })
  return res.data
}

// Statistiques d'un utilisateur
export const getUserStats = async (id: string): Promise<UserStats> => {
  const res = await axiosClient.get<UserStats>(`/admin/users/${id}/stats`)
  return res.data
}

// Créer un livreur (DELIVERER)
export const createDeliverer = async (data: CreateDelivererPayload): Promise<UserDetail> => {
  const res = await axiosClient.post<UserDetail>('/admin/users/deliverer', data)
  return res.data
}

// Supprimer un utilisateur
export const deleteUser = async (id: string): Promise<{ message: string }> => {
  const res = await axiosClient.delete<{ message: string }>(`/admin/users/${id}`)
  return res.data
}

// Mettre à jour un utilisateur
export const updateUser = async (id: string, data: Partial<UserDetail>): Promise<UserDetail> => {
  const res = await axiosClient.patch<UserDetail>(`/admin/users/${id}`, data)
  return res.data
}

// Envoyer un message direct
export const sendDirectMessage = async (userId: string, message: string): Promise<{ success: boolean }> => {
  const res = await axiosClient.post(`/admin/users/${userId}/message`, { message })
  return res.data
}

// Export CSV
export const exportUsersCSV = (): void => {
  const token = localStorage.getItem('token')
  const baseUrl = axiosClient.defaults.baseURL || ''
  const url = `${baseUrl}/admin/users/export`
  const a = document.createElement('a')
  a.href = url
  // Ajouter le token via header n'est pas possible avec <a>, on ouvre dans un onglet
  // À la place on utilise fetch pour blob
  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.blob())
    .then(blob => {
      const blobUrl = URL.createObjectURL(blob)
      a.href = blobUrl
      a.download = `utilisateurs_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
    })
}

// Assigner un livreur à une livraison
export const assignDeliverer = async (deliveryId: string, delivererId: string): Promise<Delivery> => {
  const res = await axiosClient.patch<Delivery>(`/orders/deliveries/${deliveryId}/assign`, { delivererId })
  return res.data
}

// Annuler la livraison
export const cancelDelivery = async (deliveryId: string): Promise<Delivery> => {
  const res = await axiosClient.patch<Delivery>(`/orders/deliveries/${deliveryId}/cancel`)
  return res.data
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

export const getDashboardStats = async (): Promise<DashboardStats> => {
  const res = await axiosClient.get<DashboardStats>('/admin/dashboard/stats')
  return res.data
}
