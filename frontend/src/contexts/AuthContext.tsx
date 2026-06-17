import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { login as apiLogin, register as apiRegister, updateAvailability as apiUpdateAvailability } from '../api/auth.api'
import type { LoginPayload, RegisterPayload, AuthUser } from '../api/auth.api'

interface AuthContextType {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  isDeliverer: boolean
  isClient: boolean
  login: (data: LoginPayload) => Promise<void>
  register: (data: RegisterPayload) => Promise<void>
  logout: () => void
  setAvailability: (isAvailable: boolean) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const storedToken = localStorage.getItem('token')
    const storedUser = localStorage.getItem('user')
    if (storedToken && storedUser) {
      try {
        setToken(storedToken)
        setUser(JSON.parse(storedUser))
      } catch {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      }
    }
    setIsLoading(false)
  }, [])

  const login = async (data: LoginPayload) => {
    const res = await apiLogin(data)
    localStorage.setItem('token', res.token)
    localStorage.setItem('user', JSON.stringify(res.user))
    setToken(res.token)
    setUser(res.user)
  }

  const register = async (data: RegisterPayload) => {
    const res = await apiRegister(data)
    localStorage.setItem('token', res.token)
    localStorage.setItem('user', JSON.stringify(res.user))
    setToken(res.token)
    setUser(res.user)
  }

  const logout = async () => {
    // Si l'utilisateur est un livreur, on le met automatique hors-ligne avant déconnexion
    if (user && user.role === 'DELIVERER') {
      try {
        await apiUpdateAvailability(false)
      } catch (e) {
        console.error('Erreur mise hors ligne à la déconnexion', e)
      }
    }
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }

  const setAvailability = async (isAvailable: boolean) => {
    if (!user) return
    const updated = await apiUpdateAvailability(isAvailable)
    const newUser = { ...user, isAvailable: updated.isAvailable }
    localStorage.setItem('user', JSON.stringify(newUser))
    setUser(newUser)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'ADMIN',
        isDeliverer: user?.role === 'DELIVERER',
        isClient: user?.role === 'CLIENT',
        login,
        register,
        logout,
        setAvailability,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
