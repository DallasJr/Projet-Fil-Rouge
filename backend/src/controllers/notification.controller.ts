import { Response } from 'express'
import { AuthenticatedRequest } from '../middlewares/auth.middleware'
import { prisma } from '../index'
import { sendSocketNotification } from '../socket'

// Fonction utilitaire pour créer et envoyer une notification
export const createAndSendNotification = async (userId: string, message: string, orderId?: string) => {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        message,
        orderId: orderId || null
      }
    })
    
    // Envoyer la notification via socket temps réel
    sendSocketNotification(userId, notification)
    return notification
  } catch (error) {
    console.error('Erreur createAndSendNotification:', error)
  }
}

// Récupérer les notifications de l'utilisateur connecté
export const getMyNotifications = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Non authentifié.' })

    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    })

    return res.json(notifications)
  } catch (error) {
    console.error('Erreur getMyNotifications:', error)
    return res.status(500).json({ error: 'Impossible de récupérer les notifications.' })
  }
}

// Marquer une notification comme lue
export const markAsRead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Non authentifié.' })

    const { id } = req.params

    const notification = await prisma.notification.findUnique({
      where: { id }
    })

    if (!notification) {
      return res.status(404).json({ error: 'Notification non trouvée.' })
    }

    if (notification.userId !== req.user.id) {
      return res.status(403).json({ error: 'Accès refusé.' })
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true }
    })

    return res.json(updated)
  } catch (error) {
    console.error('Erreur markAsRead:', error)
    return res.status(500).json({ error: 'Impossible de modifier la notification.' })
  }
}

// Marquer toutes les notifications de l'utilisateur comme lues
export const markAllAsRead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Non authentifié.' })

    await prisma.notification.updateMany({
      where: {
        userId: req.user.id,
        isRead: false
      },
      data: { isRead: true }
    })

    return res.json({ message: 'Toutes les notifications ont été marquées comme lues.' })
  } catch (error) {
    console.error('Erreur markAllAsRead:', error)
    return res.status(500).json({ error: 'Impossible de modifier les notifications.' })
  }
}
