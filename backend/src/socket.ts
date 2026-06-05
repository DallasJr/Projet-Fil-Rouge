import { Server as SocketIOServer, Socket } from 'socket.io'
import { Server as HTTPServer } from 'http'
import jwt, { Secret } from 'jsonwebtoken'
import { Role } from '@prisma/client'
import { prisma } from './index'

interface SocketUser {
  id: string
  email: string
  role: Role
}

interface AuthenticatedSocket extends Socket {
  user?: SocketUser
}

let io: SocketIOServer | null = null

export const initSocket = (server: HTTPServer) => {
  io = new SocketIOServer(server, {
    cors: {
      origin: '*', // Permet toutes les connexions (React et React Native)
      methods: ['GET', 'POST']
    }
  })

  // Middleware d'authentification pour Socket.io
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth['token'] || socket.handshake.query['token']

    if (!token) {
      return next(new Error('Authentification échouée. Token manquant.'))
    }

    const secret = ((process.env['JWT_SECRET'] as string) || 'super-secret-key-change-this-in-production-12345!') as Secret

    try {
      const decoded = (jwt.verify as any)(token, secret) as any
      socket.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role as Role
      }
      return next()
    } catch (err) {
      return next(new Error('Authentification échouée. Token invalide.'))
    }
  })

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`🔌 Nouveau client connecté au Socket : ${socket.user?.email} (${socket.user?.role})`)

    if (socket.user?.id) {
      socket.join(`user:${socket.user.id}`)
      console.log(`👤 L'utilisateur a rejoint son salon de notification personnel : user:${socket.user.id}`)
    }

    // Rejoindre un salon de commande
    socket.on('join_order', (orderId: string) => {
      socket.join(`order:${orderId}`)
      console.log(`👤 L'utilisateur ${socket.user?.email} a rejoint le salon : order:${orderId}`)
    })

    // Quitter un salon de commande
    socket.on('leave_order', (orderId: string) => {
      socket.leave(`order:${orderId}`)
      console.log(`👤 L'utilisateur ${socket.user?.email} a quitté le salon : order:${orderId}`)
    })

    // Réception d'un message instantané
    socket.on('send_message', async (data: { orderId: string; content: string }) => {
      try {
        if (!socket.user) return

        const { orderId, content } = data

        if (!content || !content.trim()) return

        // Persister le message en base de données
        const message = await prisma.message.create({
          data: {
            orderId,
            senderId: socket.user.id,
            content: content.trim()
          },
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                role: true
              }
            }
          }
        })

        // Diffuser le message à tous les utilisateurs dans le salon de cette commande
        io?.to(`order:${orderId}`).emit('receive_message', message)
      } catch (error) {
        console.error('Erreur lors de la gestion du message socket:', error)
      }
    })

    socket.on('disconnect', () => {
      console.log(`🔌 Client déconnecté : ${socket.user?.email}`)
    })
  })
}

// Fonction utilitaire pour envoyer des notifications ou statuts mis à jour
export const notifyOrderStatusUpdate = (orderId: string, status: string) => {
  if (!io) return
  console.log(`📢 Diffusion du statut ${status} pour la commande ${orderId}`)
  io.to(`order:${orderId}`).emit('order_status_updated', { orderId, status })
}

export const notifyDeliveryAssigned = (orderId: string, delivererId: string, delivererName: string) => {
  if (!io) return
  console.log(`📢 Diffusion de l'assignation du livreur ${delivererName} pour la commande ${orderId}`)
  io.to(`order:${orderId}`).emit('delivery_assigned', { orderId, delivererId, delivererName })
}

export const sendSocketNotification = (userId: string, notification: any) => {
  if (!io) return
  console.log(`📢 Envoi d'une notification socket à l'utilisateur ${userId}`)
  io.to(`user:${userId}`).emit('new_notification', notification)
}
