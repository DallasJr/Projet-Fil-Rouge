import axiosClient from './axiosClient'

export interface Review {
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
}

export const submitReview = async (
  orderId: string,
  rating: number,
  comment?: string
): Promise<{ message: string; review: Review }> => {
  const res = await axiosClient.post<{ message: string; review: Review }>('/reviews', {
    orderId,
    rating,
    comment
  })
  return res.data
}

export const getOrderReview = async (orderId: string): Promise<Review> => {
  const res = await axiosClient.get<Review>(`/reviews/order/${orderId}`)
  return res.data
}

export const getRestaurantReviews = async (restaurantId: string): Promise<Review[]> => {
  const res = await axiosClient.get<Review[]>(`/reviews/restaurant/${restaurantId}`)
  return res.data
}
