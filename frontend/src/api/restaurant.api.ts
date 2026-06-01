import axiosClient from './axiosClient'

export interface Restaurant {
  id: string
  name: string
  description: string | null
  phone: string | null
  address: string
  isOpen: boolean
  openAt: string | null
  closeAt: string | null
}

export const getRestaurants = async (): Promise<Restaurant[]> => {
  const res = await axiosClient.get<Restaurant[]>('/restaurants')
  return res.data
}

export const getRestaurant = async (id: string): Promise<Restaurant> => {
  const res = await axiosClient.get<Restaurant>(`/restaurants/${id}`)
  return res.data
}
