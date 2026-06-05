import { Router } from 'express'
import { getAllUsers, createDeliverer, deleteUser } from '../controllers/admin.controller'
import { authenticateJWT, authorizeRoles } from '../middlewares/auth.middleware'
import { Role } from '@prisma/client'

const router = Router()

// Toutes les routes admin nécessitent d'être authentifié avec le rôle ADMIN
router.use(authenticateJWT, authorizeRoles(Role.ADMIN))

// GET /api/admin/users - Liste tous les utilisateurs (filtrable par ?role=ROLE)
router.get('/users', getAllUsers)

// POST /api/admin/users/deliverer - Crée un livreur
router.post('/users/deliverer', createDeliverer)

// DELETE /api/admin/users/:id - Supprime un utilisateur
router.delete('/users/:id', deleteUser)

export default router
