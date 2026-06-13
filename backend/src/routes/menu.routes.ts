import { Router } from 'express'
import {
  getCategories,
  createCategory,
  deleteCategory,
  getItems,
  createItem,
  updateItem,
  deleteItem
} from '../controllers/menu.controller'
import { authenticateJWT, authorizeRoles, optionalAuthenticateJWT } from '../middlewares/auth.middleware'
import { Role } from '@prisma/client'

const router = Router()

// --- ROUTES CATEGORIES ---
// Tout le monde peut voir les catégories et les plats (Clients, Livreurs, Visiteurs)
router.get('/categories', getCategories)

// Seul le restaurant (ADMIN) peut créer ou supprimer des catégories
router.post('/categories', authenticateJWT, authorizeRoles(Role.ADMIN), createCategory)
router.delete('/categories/:id', authenticateJWT, authorizeRoles(Role.ADMIN), deleteCategory)


// --- ROUTES ITEMS (PLATS) ---
// Voir tous les plats (les admins verront tous les plats, les autres verront uniquement les plats disponibles)
router.get('/items', optionalAuthenticateJWT, getItems)

// Seul le restaurant (ADMIN) peut gérer les plats de la carte
router.post('/items', authenticateJWT, authorizeRoles(Role.ADMIN), createItem)
router.put('/items/:id', authenticateJWT, authorizeRoles(Role.ADMIN), updateItem)
router.delete('/items/:id', authenticateJWT, authorizeRoles(Role.ADMIN), deleteItem)

export default router
