import { Router } from 'express'
import { register, login, getProfile } from '../controllers/auth.controller'
import { authenticateJWT } from '../middlewares/auth.middleware'
import { validateBody } from '../middlewares/validation.middleware'
import { loginSchema, registerSchema } from '../schemas/validation.schemas'

const router = Router()

// Route Inscription : POST /api/auth/register
router.post('/register', validateBody(registerSchema), register)

// Route Connexion : POST /api/auth/login
router.post('/login', validateBody(loginSchema), login)

// Route Profil protégé : GET /api/auth/me (nécessite le token JWT)
router.get('/me', authenticateJWT, getProfile)

export default router
