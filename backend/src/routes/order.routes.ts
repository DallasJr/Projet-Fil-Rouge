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
import { validateBody } from '../middlewares/validation.middleware'
import { Role } from '@prisma/client'
import {
  createOrderSchema,
  updateDeliveryStatusSchema,
  updateOrderStatusSchema,
} from '../schemas/validation.schemas'

const router = Router()

// --- ROUTES COMMANDES (ORDERS) ---

// CLIENT et ADMIN peuvent créer une commande (ADMIN pour tester)
router.post('/', authenticateJWT, authorizeRoles(Role.CLIENT, Role.ADMIN), validateBody(createOrderSchema), createOrder)

// CLIENT, DELIVERER et ADMIN peuvent voir l'historique de commandes/livraisons
router.get('/my-orders', authenticateJWT, authorizeRoles(Role.CLIENT, Role.DELIVERER, Role.ADMIN), getMyOrders)

// Le restaurant (ADMIN) ou les livreurs peuvent voir toutes les commandes
router.get('/all', authenticateJWT, authorizeRoles(Role.ADMIN, Role.DELIVERER), getAllOrders)

// Le restaurant (ADMIN) peut changer le statut de préparation de la commande
router.patch('/:id/status', authenticateJWT, authorizeRoles(Role.ADMIN), validateBody(updateOrderStatusSchema), updateOrderStatus)


// --- ROUTES LIVRAISONS (DELIVERIES) ---

// Les livreurs et admins peuvent voir les livraisons non assignées
router.get('/deliveries/available', authenticateJWT, authorizeRoles(Role.DELIVERER, Role.ADMIN), getAvailableDeliveries)

// Un livreur (ou admin pour tester) peut accepter une livraison
router.post('/deliveries/:id/accept', authenticateJWT, authorizeRoles(Role.DELIVERER, Role.ADMIN), acceptDelivery)

// Un livreur peut mettre à jour le statut ou le paiement d'une livraison
router.patch('/deliveries/:id/status', authenticateJWT, authorizeRoles(Role.DELIVERER, Role.ADMIN), validateBody(updateDeliveryStatusSchema), updateDeliveryStatus)

export default router
