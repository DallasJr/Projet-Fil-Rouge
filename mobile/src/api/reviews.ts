import client from './client'

export interface Review {
  id: string
  orderId: string
  customerId: string
  rating: number
  comment: string | null
  createdAt: string
}

export const submitReview = async (
  orderId: string,
  rating: number,
  comment?: string
): Promise<{ message: string; review: Review }> => {
  const res = await client.post<{ message: string; review: Review }>('/reviews', {
    orderId,
    rating,
    comment,
  })
  return res.data
}

export const getOrderReview = async (orderId: string): Promise<Review> => {
  const res = await client.get<Review>(`/reviews/order/${orderId}`)
  return res.data
}
