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

export const createCategory = async (data: { name: string; restaurantId: string; displayOrder?: number }): Promise<Category> => {
  const res = await client.post<Category>('/menu/categories', data)
  return res.data
}

export const deleteCategory = async (id: string): Promise<void> => {
  await client.delete(`/menu/categories/${id}`)
}

export const createItem = async (data: {
  name: string
  description?: string
  price: number
  imageUrl?: string
  isAvailable?: boolean
  categoryId: string
}): Promise<Item> => {
  const res = await client.post<Item>('/menu/items', data)
  return res.data
}

export const updateItem = async (id: string, data: Partial<Item>): Promise<Item> => {
  const res = await client.put<Item>(`/menu/items/${id}`, data)
  return res.data
}

export const deleteItem = async (id: string): Promise<void> => {
  await client.delete(`/menu/items/${id}`)
}
