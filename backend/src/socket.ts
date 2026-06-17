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

// Map userId => Set de socketIds (un même utilisateur peut avoir plusieurs onglets)
const connectedUsers = new Map<string, Set<string>>()

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

      // Ajouter à la map des connectés
      if (!connectedUsers.has(socket.user.id)) {
        connectedUsers.set(socket.user.id, new Set())
      }
      connectedUsers.get(socket.user.id)!.add(socket.id)

      // Notifier les admins qu'un utilisateur est en ligne
      io?.to('role:ADMIN').emit('user_online', {
        userId: socket.user.id,
        email: socket.user.email,
        role: socket.user.role
      })
    }

    if (socket.user?.role) {
      socket.join(`role:${socket.user.role}`)
      console.log(`👤 L'utilisateur a rejoint le salon de rôle : role:${socket.user.role}`)
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

    // Indicateur de frappe (typing)
    socket.on('typing', (data: { orderId: string; isTyping: boolean }) => {
      if (!socket.user) return
      const { orderId, isTyping } = data

      // Récupérer le nom de l'utilisateur depuis la base de données (optimisation: on le broadcaste avec le socket)
      prisma.user.findUnique({ where: { id: socket.user.id }, select: { name: true } })
        .then((user) => {
          if (!user) return
          // Diffuser à tous sauf l'émetteur
          socket.to(`order:${orderId}`).emit('user_typing', {
            userId: socket.user!.id,
            name: user.name,
            orderId,
            isTyping,
          })
        })
        .catch(() => {})
    })

    socket.on('get_online_users', () => {
      // Envoyer la liste des IDs d'utilisateurs en ligne uniquement à l'admin demandeur
      const onlineIds = Array.from(connectedUsers.keys())
      socket.emit('online_users_list', onlineIds)
    })

    socket.on('disconnect', async () => {
      console.log(`🔌 Client déconnecté : ${socket.user?.email}`)

      // Retirer de la map des connectés
      if (socket.user?.id) {
        const sockets = connectedUsers.get(socket.user.id)
        if (sockets) {
          sockets.delete(socket.id)
          if (sockets.size === 0) {
            // Dernier onglet fermé -> vraiment hors-ligne
            connectedUsers.delete(socket.user.id)
            io?.to('role:ADMIN').emit('user_offline', { userId: socket.user.id })
          }
        }
      }

      // Si c'est un livreur, le passer hors-ligne automatiquement
      if (socket.user?.role === 'DELIVERER') {
        try {
          await prisma.user.update({
            where: { id: socket.user.id },
            data: { isAvailable: false }
          })
          console.log(`📴 Livreur ${socket.user.email} passé hors-ligne automatiquement.`)
        } catch (err) {
          console.error('Erreur mise à jour disponibilité livreur:', err)
        }
      }
    })
  })
}


// Fonction utilitaire pour envoyer des notifications ou statuts mis à jour
export const notifyOrderStatusUpdate = async (orderId: string, status: string) => {
  if (!io) return
  console.log(`📢 Diffusion du statut ${status} pour la commande ${orderId}`)
  io.to(`order:${orderId}`).emit('order_status_updated', { orderId, status })
  // Notifier également les administrateurs et livreurs pour leurs dashboards
  io.to('role:ADMIN').to('role:DELIVERER').emit('order_status_updated', { orderId, status })

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { customerId: true }
    })
    if (order) {
      io.to(`user:${order.customerId}`).emit('order_status_updated', { orderId, status })
    }
  } catch (error) {
    console.error('Erreur lors de la notification de statut à l\'utilisateur:', error)
  }
}

export const notifyOrderCreated = (order: any) => {
  if (!io) return
  console.log(`📢 Nouvelle commande créée diffusée aux admins et livreurs : ${order.id}`)
  io.to('role:ADMIN').to('role:DELIVERER').emit('order_created', order)
}

export const notifyDeliveryAssigned = async (orderId: string, delivererId: string, delivererName: string) => {
  if (!io) return
  console.log(`📢 Diffusion de l'assignation du livreur ${delivererName} pour la commande ${orderId}`)
  io.to(`order:${orderId}`).emit('delivery_assigned', { orderId, delivererId, delivererName })
  // Notifier également les admins et livreurs pour leurs dashboards
  io.to('role:ADMIN').to('role:DELIVERER').emit('delivery_assigned', { orderId, delivererId, delivererName })

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { customerId: true }
    })
    if (order) {
      io.to(`user:${order.customerId}`).emit('delivery_assigned', { orderId, delivererId, delivererName })
    }
  } catch (error) {
    console.error('Erreur lors de la notification d\'assignation à l\'utilisateur:', error)
  }
}

export const sendSocketNotification = (userId: string, notification: any) => {
  if (!io) return
  console.log(`📢 Envoi d'une notification socket à l'utilisateur ${userId}`)
  io.to(`user:${userId}`).emit('new_notification', notification)
}

export const notifyDelivererLocation = (
  orderId: string,
  customerId: string,
  lat: number,
  lng: number,
  eta: number | null
) => {
  if (!io) return
  const payload = { orderId, lat, lng, eta }
  console.log(`📍 Position livreur diffusée pour commande ${orderId} : (${lat.toFixed(5)}, ${lng.toFixed(5)}) ETA=${eta}min`)
  io.to(`order:${orderId}`).emit('deliverer_location', payload)
  io.to(`user:${customerId}`).emit('deliverer_location', payload)
  io.to('role:ADMIN').emit('deliverer_location', payload)
}

