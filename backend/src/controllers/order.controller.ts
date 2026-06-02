import { Response } from 'express'
import { AuthenticatedRequest } from '../middlewares/auth.middleware'
import { prisma } from '../index'
import { OrderStatus, DeliveryStatus, Role, PaymentMethod } from '@prisma/client'

// --- COMMANDES (ORDERS) ---

// 1. Créer une commande (CLIENT uniquement)
export const createOrder = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Non authentifié.' })

    const { restaurantId, items, note, deliveryAddress, paymentMethod, tableNumber } = req.body

    if (!restaurantId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'restaurantId et un tableau items non vide sont requis.' })
    }

    // Calculer le montant total et valider l'existence des produits
    let totalAmount = 0
    const orderItemsData = []

    for (const orderItem of items) {
      const product = await prisma.item.findUnique({ where: { id: orderItem.itemId } })
      if (!product) {
        return res.status(404).json({ error: `L'article avec l'ID ${orderItem.itemId} n'existe pas.` })
      }
      if (!product.isAvailable) {
        return res.status(400).json({ error: `L'article ${product.name} n'est pas disponible actuellement.` })
      }

      const quantity = parseInt(orderItem.quantity) || 1
      const price = product.price
      totalAmount += price * quantity

      orderItemsData.push({
        itemId: product.id,
        quantity,
        unitPrice: price,
        note: orderItem.note ? String(orderItem.note) : null
      })
    }

    // Créer la commande en transaction avec Prisma
    const order = await prisma.order.create({
      data: {
        customerId: req.user.id,
        restaurantId,
        totalAmount,
        note: note ? String(note) : null,
        status: OrderStatus.PENDING,
        items: {
          create: orderItemsData
        }
      },
      include: {
        items: { include: { item: true } }
      }
    })

    // Si une adresse de livraison est fournie, on crée automatiquement l'entité de livraison associée
    if (deliveryAddress) {
      await prisma.delivery.create({
        data: {
          orderId: order.id,
          deliveryAddress: String(deliveryAddress),
          status: DeliveryStatus.ASSIGNED,
          paymentMethod: paymentMethod && Object.values(PaymentMethod).includes(paymentMethod) ? paymentMethod : PaymentMethod.CREDIT_CARD,
          isPaid: false,
          deliveryFee: 2.50 // Frais fixes de livraison simulés
        }
      })
    }

    return res.status(201).json(order)
  } catch (error: any) {
    console.error('Erreur createOrder:', error)
    return res.status(500).json({ error: 'Impossible de finaliser la commande.' })
  }
}

// 2. Récupérer l'historique des commandes du client connecté
export const getMyOrders = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Non authentifié.' })

    let whereClause: any = { customerId: req.user.id }

    if (req.user.role === Role.DELIVERER) {
      whereClause = {
        delivery: {
          delivererId: req.user.id
        }
      }
    }

    const orders = await prisma.order.findMany({
      where: whereClause,
      include: {
        items: { include: { item: true } },
        delivery: true
      },
      orderBy: { createdAt: 'desc' }
    })

    return res.json(orders)
  } catch (error: any) {
    console.error('Erreur getMyOrders:', error)
    return res.status(500).json({ error: 'Impossible de récupérer les commandes.' })
  }
}

// 3. Récupérer toutes les commandes (ADMIN ou LIVREUR)
export const getAllOrders = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
        items: { include: { item: true } },
        delivery: true
      },
      orderBy: { createdAt: 'desc' }
    })
    return res.json(orders)
  } catch (error: any) {
    console.error('Erreur getAllOrders:', error)
    return res.status(500).json({ error: 'Impossible de récupérer les commandes.' })
  }
}

// 4. Mettre à jour le statut d'une commande (ADMIN uniquement)
export const updateOrderStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    const { status } = req.body

    const orderId = String(id)

    if (!status || !Object.values(OrderStatus).includes(status)) {
      return res.status(400).json({ error: 'Statut de commande invalide.' })
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status: status as OrderStatus },
      include: { delivery: true }
    })

    return res.json(updatedOrder)
  } catch (error: any) {
    console.error('Erreur updateOrderStatus:', error)
    return res.status(500).json({ error: 'Impossible de mettre à jour le statut de la commande.' })
  }
}


// --- LIVRAISONS (DELIVERIES) ---

// 1. Voir les livraisons disponibles non assignées (LIVREUR ou ADMIN)
export const getAvailableDeliveries = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deliveries = await prisma.delivery.findMany({
      where: { delivererId: null },
      include: {
        order: {
          include: {
            customer: { select: { id: true, name: true, phone: true } }
          }
        }
      }
    })
    return res.json(deliveries)
  } catch (error: any) {
    console.error('Erreur getAvailableDeliveries:', error)
    return res.status(500).json({ error: 'Impossible de récupérer les livraisons disponibles.' })
  }
}

// 2. Accepter / Prendre en charge une livraison (LIVREUR uniquement)
export const acceptDelivery = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Non authentifié.' })
    const { id } = req.params
    const deliveryId = String(id)

    const existingDelivery = await prisma.delivery.findUnique({ where: { id: deliveryId } })
    if (!existingDelivery) {
      return res.status(404).json({ error: 'Livraison non trouvée.' })
    }

    if (existingDelivery.delivererId) {
      return res.status(400).json({ error: 'Cette livraison est déjà prise en charge par un autre livreur.' })
    }

    // Assigner le livreur et mettre à jour le statut de la commande liée
    const updatedDelivery = await prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        delivererId: req.user.id,
        status: DeliveryStatus.ASSIGNED
      }
    })

    await prisma.order.update({
      where: { id: updatedDelivery.orderId },
      data: { status: OrderStatus.DELIVERING }
    })

    return res.json(updatedDelivery)
  } catch (error: any) {
    console.error('Erreur acceptDelivery:', error)
    return res.status(500).json({ error: 'Impossible d\'accepter la livraison.' })
  }
}

// 3. Mettre à jour le statut de la livraison (LIVREUR uniquement)
export const updateDeliveryStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Non authentifié.' })
    const { id } = req.params
    const { status, isPaid } = req.body
    const deliveryId = String(id)

    const delivery = await prisma.delivery.findUnique({ where: { id: deliveryId } })
    if (!delivery) {
      return res.status(404).json({ error: 'Livraison non trouvée.' })
    }

    if (delivery.delivererId !== req.user.id && req.user.role !== Role.ADMIN) {
      return res.status(403).json({ error: 'Vous n\'êtes pas le livreur assigné à cette commande.' })
    }

    const updatedData: any = {}
    if (status && Object.values(DeliveryStatus).includes(status)) {
      updatedData.status = status as DeliveryStatus
      if (status === DeliveryStatus.PICKED_UP) {
        updatedData.pickedAt = new Date()
      } else if (status === DeliveryStatus.DELIVERED) {
        updatedData.deliveredAt = new Date()
      }
    }

    if (isPaid !== undefined) {
      updatedData.isPaid = Boolean(isPaid)
    }

    const updatedDelivery = await prisma.delivery.update({
      where: { id: deliveryId },
      data: updatedData
    })

    // Si livré, mettre également à jour le statut de la commande générale
    if (status === DeliveryStatus.DELIVERED) {
      await prisma.order.update({
        where: { id: updatedDelivery.orderId },
        data: { status: OrderStatus.DELIVERED }
      })
    }

    return res.json(updatedDelivery)
  } catch (error: any) {
    console.error('Erreur updateDeliveryStatus:', error)
    return res.status(500).json({ error: 'Impossible de modifier la livraison.' })
  }
}
