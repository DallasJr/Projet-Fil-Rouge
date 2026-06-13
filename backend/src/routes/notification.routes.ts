import { Router } from 'express'
import { getMyNotifications, markAsRead, markAllAsRead } from '../controllers/notification.controller'
import { authenticateJWT } from '../middlewares/auth.middleware'

const router = Router()

// Toutes les routes de notifications nécessitent d'être connecté
router.use(authenticateJWT)

// GET /api/notifications - Liste les notifications de l'utilisateur
router.get('/', getMyNotifications)

// PATCH /api/notifications/read-all - Marquer toutes les notifications comme lues
router.patch('/read-all', markAllAsRead)

// PATCH /api/notifications/:id/read - Marquer une notification spécifique comme lue
router.patch('/:id/read', markAsRead)

export default router
