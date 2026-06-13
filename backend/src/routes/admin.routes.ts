import { Router } from 'express'
import { getAllUsers, createDeliverer, deleteUser, updateUser, getUserStats, sendDirectMessage, exportUsersCSV } from '../controllers/admin.controller'
import { authenticateJWT, authorizeRoles } from '../middlewares/auth.middleware'
import { Role } from '@prisma/client'

const router = Router()

// Toutes les routes admin nécessitent d'être authentifié avec le rôle ADMIN
router.use(authenticateJWT, authorizeRoles(Role.ADMIN))

// GET /api/admin/users - Liste tous les utilisateurs
router.get('/users', getAllUsers)

// GET /api/admin/users/export - Export CSV de tous les utilisateurs
router.get('/users/export', exportUsersCSV)

// GET /api/admin/users/:id/stats - Statistiques d'un utilisateur
router.get('/users/:id/stats', getUserStats)

// POST /api/admin/users/deliverer - Crée un livreur
router.post('/users/deliverer', createDeliverer)

// POST /api/admin/users/:id/message - Envoyer un message direct
router.post('/users/:id/message', sendDirectMessage)

// PATCH /api/admin/users/:id - Met à jour les infos ou le rôle d'un utilisateur
router.patch('/users/:id', updateUser)

// DELETE /api/admin/users/:id - Supprime un utilisateur
router.delete('/users/:id', deleteUser)

export default router
