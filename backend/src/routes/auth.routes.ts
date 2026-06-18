import { Router } from 'express'
import { register, login, getProfile, updateAvailability, forgotPassword, resetPassword, updateProfile, changePassword } from '../controllers/auth.controller'
import { authenticateJWT } from '../middlewares/auth.middleware'
import { validateBody } from '../middlewares/validation.middleware'
import { loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema, updateProfileSchema } from '../schemas/validation.schemas'
import { authLimiter } from '../middlewares/security.middleware'

const router = Router()

// Route Inscription : POST /api/auth/register
router.post('/register', authLimiter, validateBody(registerSchema), register)

// Route Connexion : POST /api/auth/login
router.post('/login', authLimiter, validateBody(loginSchema), login)

// Route Mot de passe oublié : POST /api/auth/forgot-password
router.post('/forgot-password', authLimiter, validateBody(forgotPasswordSchema), forgotPassword)

// Route Réinitialisation de mot de passe : POST /api/auth/reset-password
router.post('/reset-password', authLimiter, validateBody(resetPasswordSchema), resetPassword)

// Route Profil protégé : GET /api/auth/me (nécessite le token JWT)
router.get('/me', authenticateJWT, getProfile)

// Route Mise à jour profil : PATCH /api/auth/profile
router.patch('/profile', authenticateJWT, validateBody(updateProfileSchema), updateProfile)

// Route Changement mot de passe : PATCH /api/auth/change-password
router.patch('/change-password', authenticateJWT, changePassword)

// Route Disponibilité livreur : PATCH /api/auth/availability
router.patch('/availability', authenticateJWT, updateAvailability)

export default router
