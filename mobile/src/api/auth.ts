import client from './client'

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  name: string
  email: string
  password: string
  phone?: string
}

export interface AuthUser {
  id: string
  name: string
  email: string
  role: 'CLIENT' | 'DELIVERER' | 'ADMIN'
  phone?: string | null
  isAvailable?: boolean
}

export interface AuthResponse {
  token: string
  user: AuthUser
}

export const login = async (data: LoginPayload): Promise<AuthResponse> => {
  const res = await client.post<AuthResponse>('/auth/login', data)
  return res.data
}

export const register = async (data: RegisterPayload): Promise<AuthResponse> => {
  const res = await client.post<AuthResponse>('/auth/register', data)
  return res.data
}

export const getMe = async (): Promise<AuthUser> => {
  const res = await client.get<AuthUser>('/auth/me')
  return res.data
}
