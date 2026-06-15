import { Router } from 'express'
import { submitReview, getOrderReview, getRestaurantReviews } from '../controllers/review.controller'
import { authenticateJWT } from '../middlewares/auth.middleware'

const router = Router()

// Soumettre un avis (nécessite d'être connecté)
router.post('/', authenticateJWT, submitReview)

// Consulter l'avis d'une commande
router.get('/order/:orderId', authenticateJWT, getOrderReview)

// Consulter tous les avis d'un restaurant
router.get('/restaurant/:restaurantId', authenticateJWT, getRestaurantReviews)

export default router
