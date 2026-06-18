import client from './client'

export interface NotificationDetail {
  id: string
  userId: string
  orderId: string | null
  message: string
  isRead: boolean
  createdAt: string
}

export const getMyNotifications = async (): Promise<NotificationDetail[]> => {
  const res = await client.get<NotificationDetail[]>('/notifications')
  return res.data
}

export const markAsRead = async (id: string): Promise<NotificationDetail> => {
  const res = await client.patch<NotificationDetail>(`/notifications/${id}/read`)
  return res.data
}

export const markAllAsRead = async (): Promise<{ message: string }> => {
  const res = await client.patch<{ message: string }>('/notifications/read-all')
  return res.data
}
