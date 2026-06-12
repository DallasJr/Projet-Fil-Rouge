import { Router } from 'express'
import { register, login, getProfile } from '../controllers/auth.controller'
import { authenticateJWT } from '../middlewares/auth.middleware'
import { validateBody } from '../middlewares/validation.middleware'
import { loginSchema, registerSchema } from '../schemas/validation.schemas'
import { authLimiter } from '../middlewares/security.middleware'

const router = Router()

// Route Inscription : POST /api/auth/register
router.post('/register', authLimiter, validateBody(registerSchema), register)

// Route Connexion : POST /api/auth/login
router.post('/login', authLimiter, validateBody(loginSchema), login)

// Route Profil protégé : GET /api/auth/me (nécessite le token JWT)
router.get('/me', authenticateJWT, getProfile)

export default router
