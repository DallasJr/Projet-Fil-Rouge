import { Response } from 'express'
import { AuthenticatedRequest } from '../middlewares/auth.middleware'
import { prisma } from '../index'

// 1. Soumettre un avis sur une commande
export const submitReview = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Non autorisé.' })
    }

    const { orderId, rating, comment } = req.body

    // Validations basiques
    if (!orderId || rating === undefined) {
      return res.status(400).json({ error: 'Champs obligatoires manquants : orderId, rating.' })
    }

    const ratingVal = Number(rating)
    if (isNaN(ratingVal) || ratingVal < 1 || ratingVal > 5) {
      return res.status(400).json({ error: 'La note doit être un nombre entier compris entre 1 et 5.' })
    }

    // Récupérer la commande pour vérification
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { reviews: true }
    })

    if (!order) {
      return res.status(404).json({ error: 'Commande non trouvée.' })
    }

    // Vérifier que c'est bien la commande du client connecté
    if (order.customerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Vous ne pouvez noter que vos propres commandes.' })
    }

    // Vérifier le statut de la commande
    if (order.status !== 'DELIVERED') {
      return res.status(400).json({ error: 'Vous ne pouvez laisser un avis que sur les commandes livrées.' })
    }

    // Vérifier si un avis existe déjà
    if (order.reviews && order.reviews.length > 0) {
      return res.status(400).json({ error: 'Vous avez déjà soumis un avis pour cette commande.' })
    }

    // Créer l'avis
    const review = await prisma.review.create({
      data: {
        orderId,
        customerId: order.customerId,
        rating: Math.round(ratingVal),
        comment: comment ? String(comment).trim() : null
      },
      include: {
        customer: {
          select: { id: true, name: true }
        }
      }
    })

    return res.status(201).json({
      message: 'Avis enregistré avec succès !',
      review
    })
  } catch (error: any) {
    console.error('Erreur submitReview:', error)
    return res.status(500).json({ error: 'Une erreur interne est survenue lors de la soumission de l\'avis.' })
  }
}

// 2. Récupérer l'avis d'une commande spécifique
export const getOrderReview = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orderId = String(req.params.orderId)

    const review = await prisma.review.findFirst({
      where: { orderId },
      include: {
        customer: {
          select: { id: true, name: true }
        }
      }
    })

    if (!review) {
      return res.status(404).json({ error: 'Aucun avis trouvé pour cette commande.' })
    }

    return res.json(review)
  } catch (error: any) {
    console.error('Erreur getOrderReview:', error)
    return res.status(500).json({ error: 'Impossible de récupérer l\'avis de la commande.' })
  }
}

// 3. Récupérer tous les avis d'un restaurant
export const getRestaurantReviews = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const restaurantId = String(req.params.restaurantId)

    // Trouver les avis liés aux commandes de ce restaurant
    const reviews = await prisma.review.findMany({
      where: {
        order: {
          restaurantId
        }
      },
      include: {
        customer: {
          select: { id: true, name: true }
        },
        order: {
          select: { id: true, createdAt: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return res.json(reviews)
  } catch (error: any) {
    console.error('Erreur getRestaurantReviews:', error)
    return res.status(500).json({ error: 'Impossible de récupérer les avis du restaurant.' })
  }
}
