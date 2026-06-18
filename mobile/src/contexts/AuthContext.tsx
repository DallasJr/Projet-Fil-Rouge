import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  login as apiLogin,
  register as apiRegister,
  getMe,
  updateAvailability as apiUpdateAvailability,
  updateProfile as apiUpdateProfile,
} from '../api/auth'
import type { AuthUser, LoginPayload, RegisterPayload, UpdateProfilePayload } from '../api/auth'

interface AuthContextType {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  isDeliverer: boolean
  login: (data: LoginPayload) => Promise<void>
  register: (data: RegisterPayload) => Promise<void>
  logout: () => Promise<void>
  setAvailability: (isAvailable: boolean) => Promise<void>
  updateProfile: (data: UpdateProfilePayload) => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType)

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Restore session on app start
  useEffect(() => {
    const restore = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('token')
        if (storedToken) {
          setToken(storedToken)
          const me = await getMe()
          setUser(me)
        }
      } catch {
        await AsyncStorage.removeItem('token')
      } finally {
        setIsLoading(false)
      }
    }
    restore()
  }, [])

  const login = async (data: LoginPayload) => {
    const res = await apiLogin(data)
    await AsyncStorage.setItem('token', res.token)
    setToken(res.token)
    setUser(res.user)
  }

  const register = async (data: RegisterPayload) => {
    const res = await apiRegister(data)
    await AsyncStorage.setItem('token', res.token)
    setToken(res.token)
    setUser(res.user)
  }

  const logout = async () => {
    await AsyncStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }

  const setAvailability = async (isAvailable: boolean) => {
    const updated = await apiUpdateAvailability(isAvailable)
    setUser(updated)
  }

  const updateProfile = async (data: UpdateProfilePayload) => {
    const updated = await apiUpdateProfile(data)
    setUser(updated)
  }

  const refreshUser = async () => {
    try {
      const me = await getMe()
      setUser(me)
    } catch {
      // silently fail
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isLoading,
      isAuthenticated: !!user,
      isAdmin: user?.role === 'ADMIN',
      isDeliverer: user?.role === 'DELIVERER',
      login,
      register,
      logout,
      setAvailability,
      updateProfile,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
