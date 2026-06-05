import axiosClient from './axiosClient'

export interface NotificationDetail {
  id: string
  userId: string
  orderId: string | null
  message: string
  isRead: boolean
  createdAt: string
}

// Récupérer mes notifications
export const getMyNotifications = async (): Promise<NotificationDetail[]> => {
  const res = await axiosClient.get<NotificationDetail[]>('/notifications')
  return res.data
}

// Marquer une notification comme lue
export const markAsRead = async (id: string): Promise<NotificationDetail> => {
  const res = await axiosClient.patch<NotificationDetail>(`/notifications/${id}/read`)
  return res.data
}

// Marquer toutes les notifications comme lues
export const markAllAsRead = async (): Promise<{ message: string }> => {
  const res = await axiosClient.patch<{ message: string }>('/notifications/read-all')
  return res.data
}
