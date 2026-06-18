import axiosClient from './axiosClient'

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
  isVegetarian?: boolean
  isGlutenFree?: boolean
  isSpicy?: boolean
  categoryId: string
  category?: Category
}

// ── Categories ──
export const getCategories = async (): Promise<Category[]> => {
  const res = await axiosClient.get<Category[]>('/menu/categories')
  return res.data
}

export const createCategory = async (data: { name: string; restaurantId: string; displayOrder?: number }): Promise<Category> => {
  const res = await axiosClient.post<Category>('/menu/categories', data)
  return res.data
}

export const deleteCategory = async (id: string): Promise<void> => {
  await axiosClient.delete(`/menu/categories/${id}`)
}

// ── Items (Plats) ──
export const getItems = async (): Promise<Item[]> => {
  const res = await axiosClient.get<Item[]>('/menu/items')
  return res.data
}

export const createItem = async (data: {
  name: string
  description?: string
  price: number
  imageUrl?: string | null
  isAvailable?: boolean
  categoryId: string
}): Promise<Item> => {
  const res = await axiosClient.post<Item>('/menu/items', data)
  return res.data
}

export const updateItem = async (id: string, data: Partial<Item>): Promise<Item> => {
  const res = await axiosClient.put<Item>(`/menu/items/${id}`, data)
  return res.data
}

export const deleteItem = async (id: string): Promise<void> => {
  await axiosClient.delete(`/menu/items/${id}`)
}
