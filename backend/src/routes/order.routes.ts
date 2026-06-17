import { Router } from 'express'
import {
  createOrder,
  getMyOrders,
  getAllOrders,
  updateOrderStatus,
  getAvailableDeliveries,
  acceptDelivery,
  updateDeliveryStatus,
  getOrderMessages,
  assignDeliverer,
  cancelDelivery,
  confirmDelivery,
  updateDelivererLocation,
  getOrderAuditLogs,
  acceptAssignment,
  rejectAssignment,
  downloadInvoice
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

// Le restaurant (ADMIN) ou le client (pour annulation) peut changer le statut de la commande
router.patch('/:id/status', authenticateJWT, authorizeRoles(Role.ADMIN, Role.CLIENT), validateBody(updateOrderStatusSchema), updateOrderStatus)

// Le client (CLIENT) ou ADMIN peut confirmer la réception de la commande
router.patch('/:id/confirm', authenticateJWT, authorizeRoles(Role.CLIENT, Role.ADMIN), confirmDelivery)

// Récupérer l'historique des messages d'une commande (tous les utilisateurs authentifiés)
router.get('/:id/messages', authenticateJWT, getOrderMessages)

// Télécharger la facture PDF d'une commande
router.get('/:id/invoice', authenticateJWT, downloadInvoice)

// --- ROUTES LIVRAISONS (DELIVERIES) ---

// Les livreurs et admins peuvent voir les livraisons non assignées
router.get('/deliveries/available', authenticateJWT, authorizeRoles(Role.DELIVERER, Role.ADMIN), getAvailableDeliveries)

// Un livreur (ou admin pour tester) peut accepter une livraison
router.post('/deliveries/:id/accept', authenticateJWT, authorizeRoles(Role.DELIVERER, Role.ADMIN), acceptDelivery)

// Un livreur ou admin peut mettre à jour le statut ou le paiement d'une livraison
router.patch('/deliveries/:id/status', authenticateJWT, authorizeRoles(Role.DELIVERER, Role.ADMIN), validateBody(updateDeliveryStatusSchema), updateDeliveryStatus)

// Un admin peut assigner un livreur à une livraison
router.patch('/deliveries/:id/assign', authenticateJWT, authorizeRoles(Role.ADMIN), assignDeliverer)

// Un livreur (s'il est assigné) ou un admin peut annuler la livraison
router.patch('/deliveries/:id/cancel', authenticateJWT, authorizeRoles(Role.DELIVERER, Role.ADMIN), cancelDelivery)

// Un livreur ou admin peut accepter ou refuser une proposition d'assignation
router.patch('/deliveries/:id/accept-assignment', authenticateJWT, authorizeRoles(Role.DELIVERER, Role.ADMIN), acceptAssignment)
router.patch('/deliveries/:id/reject-assignment', authenticateJWT, authorizeRoles(Role.DELIVERER, Role.ADMIN), rejectAssignment)

// Lot 2 — Mise à jour de la position GPS du livreur en temps réel
router.patch('/deliveries/:id/location', authenticateJWT, authorizeRoles(Role.DELIVERER, Role.ADMIN), updateDelivererLocation)

// Lot 3 — Historique d'audit d'une commande (ADMIN et CLIENT)
router.get('/:id/audit-logs', authenticateJWT, authorizeRoles(Role.ADMIN, Role.CLIENT), getOrderAuditLogs)

export default router
