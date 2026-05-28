import { Router } from 'express'
import {
  createOrder,
  getMyOrders,
  getAllOrders,
  updateOrderStatus,
  getAvailableDeliveries,
  acceptDelivery,
  updateDeliveryStatus
} from '../controllers/order.controller'
import { authenticateJWT, authorizeRoles } from '../middlewares/auth.middleware'
import { Role } from '@prisma/client'

const router = Router()

// --- ROUTES COMMANDES (ORDERS) ---

// Un client connecté peut créer une commande
router.post('/', authenticateJWT, authorizeRoles(Role.CLIENT), createOrder)

// Un client connecté peut voir son historique de commandes
router.get('/my-orders', authenticateJWT, authorizeRoles(Role.CLIENT), getMyOrders)

// Le restaurant (ADMIN) ou les livreurs peuvent voir toutes les commandes
router.get('/all', authenticateJWT, authorizeRoles(Role.ADMIN, Role.DELIVERER), getAllOrders)

// Le restaurant (ADMIN) peut changer le statut de préparation de la commande
router.patch('/:id/status', authenticateJWT, authorizeRoles(Role.ADMIN), updateOrderStatus)


// --- ROUTES LIVRAISONS (DELIVERIES) ---

// Les livreurs et admins peuvent voir les livraisons non assignées
router.get('/deliveries/available', authenticateJWT, authorizeRoles(Role.DELIVERER, Role.ADMIN), getAvailableDeliveries)

// Un livreur peut accepter de prendre en charge une livraison
router.post('/deliveries/:id/accept', authenticateJWT, authorizeRoles(Role.DELIVERER), acceptDelivery)

// Un livreur peut mettre à jour le statut (ex: commande récupérée, commande livrée) ou le paiement d'une livraison
router.patch('/deliveries/:id/status', authenticateJWT, authorizeRoles(Role.DELIVERER, Role.ADMIN), updateDeliveryStatus)

export default router
