import axiosClient from './axiosClient'

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  name: string
  email: string
  password: string
  phone?: string
  role?: 'CLIENT' | 'DELIVERER' | 'ADMIN'
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

export interface ForgotPasswordPayload {
  email: string
}

export interface ResetPasswordPayload {
  token: string
  newPassword: string
}

export interface MessageResponse {
  message: string
}

export const login = async (data: LoginPayload): Promise<AuthResponse> => {
  const res = await axiosClient.post<AuthResponse>('/auth/login', data)
  return res.data
}

export const register = async (data: RegisterPayload): Promise<AuthResponse> => {
  const res = await axiosClient.post<AuthResponse>('/auth/register', data)
  return res.data
}

export const getProfile = async (): Promise<AuthUser & { createdAt: string }> => {
  const res = await axiosClient.get<AuthUser & { createdAt: string }>(
    '/auth/me'
  )
  return res.data
}

export const forgotPassword = async (
  data: ForgotPasswordPayload,
): Promise<MessageResponse> => {
  const res = await axiosClient.post<MessageResponse>('/auth/forgot-password', data)
  return res.data
}

export const resetPassword = async (
  data: ResetPasswordPayload,
): Promise<MessageResponse> => {
  const res = await axiosClient.post<MessageResponse>('/auth/reset-password', data)
  return res.data
}

export const updateAvailability = async (isAvailable: boolean): Promise<AuthUser> => {
  const res = await axiosClient.patch<AuthUser>('/auth/availability', { isAvailable })
  return res.data
}
