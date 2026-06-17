import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from './AuthContext'

interface SocketContextType {
  socket: Socket | null
  isConnected: boolean
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false
})

export const useSocket = () => useContext(SocketContext)

interface SocketProviderProps {
  children: ReactNode
}

export const SocketProvider = ({ children }: SocketProviderProps) => {
  const { user } = useAuth()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  // Garder une référence stable pour le cleanup sans recréer à chaque render
  const socketRef = useRef<Socket | null>(null)

  // On se base sur user?.id (string stable) plutôt que sur l'objet user entier
  useEffect(() => {
    const userId = user?.id

    if (!userId) {
      // Déconnexion propre si l'utilisateur se déconnecte
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
        setSocket(null)
        setIsConnected(false)
      }
      return
    }

    // Éviter de recréer un socket si on est déjà connecté avec le même utilisateur
    if (socketRef.current?.connected) return

    const token = localStorage.getItem('token')
    if (!token) return

    const apiUrl = (import.meta.env['VITE_API_URL'] as string || 'http://localhost:3000/api').replace('/api', '')

    const newSocket = io(apiUrl, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    })

    newSocket.on('connect', () => {
      console.log('🔌 Connecté au serveur WebSocket !')
      setIsConnected(true)
    })

    newSocket.on('disconnect', () => {
      console.log('🔌 Déconnecté du serveur WebSocket')
      setIsConnected(false)
    })

    newSocket.on('connect_error', (err) => {
      console.error('❌ Erreur Socket.io :', err.message)
    })

    socketRef.current = newSocket
    setSocket(newSocket)

    return () => {
      newSocket.disconnect()
      socketRef.current = null
    }
  }, [user?.id])

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  )
}
