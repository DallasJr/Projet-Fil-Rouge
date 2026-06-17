import client from './client'

export interface Category {
  id: string
  name: string
  displayOrder: number
  restaurantId: string
  items?: Item[]
}

export interface Item {
  id: string
  name: string
  description: string | null
  price: number
  imageUrl: string | null
  isAvailable: boolean
  categoryId: string
  category?: Category
}

export interface Restaurant {
  id: string
  name: string
  description?: string | null
  isOpen: boolean
  address: string
}

export const getRestaurants = async (): Promise<Restaurant[]> => {
  const res = await client.get<Restaurant[]>('/menu/restaurants')
  return res.data
}

export const getCategories = async (): Promise<Category[]> => {
  const res = await client.get<Category[]>('/menu/categories')
  return res.data
}

export const getItems = async (): Promise<Item[]> => {
  const res = await client.get<Item[]>('/menu/items')
  return res.data
}
