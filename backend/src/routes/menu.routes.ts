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
import { authenticateJWT, authorizeRoles } from '../middlewares/auth.middleware'
import { validateBody } from '../middlewares/validation.middleware'
import { Role } from '@prisma/client'
import { createCategorySchema, createItemSchema, updateItemSchema } from '../schemas/validation.schemas'

const router = Router()

// --- ROUTES CATEGORIES ---
// Tout le monde peut voir les catégories et les plats (Clients, Livreurs, Visiteurs)
router.get('/categories', getCategories)

// Seul le restaurant (ADMIN) peut créer ou supprimer des catégories
router.post('/categories', authenticateJWT, authorizeRoles(Role.ADMIN), validateBody(createCategorySchema), createCategory)
router.delete('/categories/:id', authenticateJWT, authorizeRoles(Role.ADMIN), deleteCategory)


// --- ROUTES ITEMS (PLATS) ---
// Voir tous les plats
router.get('/items', getItems)

// Seul le restaurant (ADMIN) peut gérer les plats de la carte
router.post('/items', authenticateJWT, authorizeRoles(Role.ADMIN), validateBody(createItemSchema), createItem)
router.put('/items/:id', authenticateJWT, authorizeRoles(Role.ADMIN), validateBody(updateItemSchema), updateItem)
router.delete('/items/:id', authenticateJWT, authorizeRoles(Role.ADMIN), deleteItem)

export default router
