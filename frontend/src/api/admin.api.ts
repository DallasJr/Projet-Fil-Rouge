import axiosClient from './axiosClient'
import type { Delivery } from './orders.api'

export interface UserDetail {
  id: string
  name: string
  email: string
  phone: string | null
  role: 'CLIENT' | 'DELIVERER' | 'ADMIN'
  isAvailable?: boolean
  createdAt: string
}

export interface CreateDelivererPayload {
  name: string
  email: string
  password: string
  phone?: string
}

// Liste des utilisateurs
export const getAllUsers = async (role?: string, isAvailable?: boolean): Promise<UserDetail[]> => {
  const params: any = {}
  if (role) params.role = role
  if (isAvailable !== undefined) params.isAvailable = isAvailable

  const res = await axiosClient.get<UserDetail[]>('/admin/users', { params })
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
