import { Router } from 'express'
import { register, login, getProfile, updateAvailability } from '../controllers/auth.controller'
import { authenticateJWT } from '../middlewares/auth.middleware'

const router = Router()

// Route Inscription : POST /api/auth/register
router.post('/register', register)

// Route Connexion : POST /api/auth/login
router.post('/login', login)

// Route Profil protégé : GET /api/auth/me (nécessite le token JWT)
router.get('/me', authenticateJWT, getProfile)

// Route Disponibilité livreur : PATCH /api/auth/availability
router.patch('/availability', authenticateJWT, updateAvailability)

export default router
