import { Response } from 'express'
import { AuthenticatedRequest } from '../middlewares/auth.middleware'
import { prisma } from '../index'
import { OrderStatus, DeliveryStatus, Role, PaymentMethod } from '@prisma/client'
import { notifyOrderStatusUpdate, notifyDeliveryAssigned } from '../socket'
import { createAndSendNotification } from './notification.controller'

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

    // Notifier tous les Admins de la nouvelle commande
    const admins = await prisma.user.findMany({
      where: { role: Role.ADMIN },
      select: { id: true }
    })
    const customer = await prisma.user.findUnique({ where: { id: req.user.id } })
    const clientNameStr = customer?.name || req.user.email
    const orderShortId = order.id.slice(-6).toUpperCase()
    for (const admin of admins) {
      await createAndSendNotification(
        admin.id,
        `Nouvelle commande #${orderShortId} passée par ${clientNameStr}.`,
        order.id
      )
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
        delivery: {
          include: {
            deliverer: { select: { id: true, name: true, phone: true } }
          }
        }
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
    if (!req.user) return res.status(401).json({ error: 'Non authentifié.' })

    let whereClause: any = {}
    
    // Si c'est un livreur, il ne doit voir que SES propres livraisons/commandes.
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
        customer: { select: { id: true, name: true, email: true, phone: true } },
        items: { include: { item: true } },
        delivery: {
          include: {
            deliverer: { select: { id: true, name: true, email: true, phone: true } }
          }
        }
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

    // Émettre l'événement temps réel
    notifyOrderStatusUpdate(orderId, status as string)

    // Notifier le client du changement de statut
    let label = status as string
    if (status === 'ACCEPTED') label = 'acceptée'
    if (status === 'PREPARING') label = 'en cours de préparation'
    if (status === 'READY') label = 'prête et en attente de livraison'
    if (status === 'DELIVERING') label = 'en cours de livraison'
    if (status === 'DELIVERED') label = 'livrée'
    if (status === 'CANCELLED') label = 'annulée'

    const orderShortId = orderId.slice(-6).toUpperCase()
    await createAndSendNotification(
      updatedOrder.customerId,
      `Votre commande #${orderShortId} est ${label}.`,
      orderId
    )

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

    const deliverer = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { name: true }
    })
    const delivererName = deliverer?.name || 'Livreur'

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

    // Émettre les événements temps réel
    notifyOrderStatusUpdate(updatedDelivery.orderId, OrderStatus.DELIVERING)
    notifyDeliveryAssigned(updatedDelivery.orderId, req.user.id, delivererName)

    // Notifier le client de la prise en charge de la livraison
    const order = await prisma.order.findUnique({
      where: { id: updatedDelivery.orderId },
      select: { customerId: true }
    })
    const orderShortId = updatedDelivery.orderId.slice(-6).toUpperCase()
    if (order) {
      await createAndSendNotification(
        order.customerId,
        `Le livreur ${delivererName} a pris en charge la livraison de votre commande #${orderShortId}.`,
        updatedDelivery.orderId
      )
    }

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
      notifyOrderStatusUpdate(updatedDelivery.orderId, OrderStatus.DELIVERING)
    } else if (status === DeliveryStatus.PICKED_UP) {
      notifyOrderStatusUpdate(updatedDelivery.orderId, 'PICKED_UP')
    }

    // Notifier le client de la mise à jour du statut de la livraison
    const order = await prisma.order.findUnique({
      where: { id: updatedDelivery.orderId },
      select: { customerId: true }
    })
    const orderShortId = updatedDelivery.orderId.slice(-6).toUpperCase()
    if (order) {
      if (status === DeliveryStatus.PICKED_UP) {
        await createAndSendNotification(
          order.customerId,
          `Votre commande #${orderShortId} est en cours de livraison.`,
          updatedDelivery.orderId
        )
      } else if (status === DeliveryStatus.DELIVERED) {
        await createAndSendNotification(
          order.customerId,
          `Votre commande #${orderShortId} a été livrée.`,
          updatedDelivery.orderId
        )
      }
    }

    return res.json(updatedDelivery)
  } catch (error: any) {
    console.error('Erreur updateDeliveryStatus:', error)
    return res.status(500).json({ error: 'Impossible de modifier la livraison.' })
  }
}

// 4. Récupérer l'historique des messages d'une commande
export const getOrderMessages = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    const orderId = String(id)

    // Vérifier si la commande existe
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    })

    if (!order) {
      return res.status(404).json({ error: 'Commande non trouvée.' })
    }

    // Récupérer les messages associés
    const messages = await prisma.message.findMany({
      where: { orderId },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            role: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    return res.json(messages)
  } catch (error: any) {
    console.error('Erreur getOrderMessages:', error)
    return res.status(500).json({ error: 'Impossible de récupérer les messages.' })
  }
}

// 5. Assigner un livreur manuellement (ADMIN uniquement)
export const assignDeliverer = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== Role.ADMIN) {
      return res.status(403).json({ error: 'Accès interdit. Rôle ADMIN requis.' })
    }

    const { id } = req.params // deliveryId
    const { delivererId } = req.body

    if (!delivererId) {
      return res.status(400).json({ error: 'delivererId est requis.' })
    }

    const deliverer = await prisma.user.findUnique({
      where: { id: delivererId }
    })

    if (!deliverer || deliverer.role !== Role.DELIVERER) {
      return res.status(400).json({ error: 'Le rôle de l\'utilisateur spécifié doit être DELIVERER.' })
    }

    const delivery = await prisma.delivery.findUnique({
      where: { id },
      include: { order: true }
    })

    if (!delivery) {
      return res.status(404).json({ error: 'Livraison non trouvée.' })
    }

    const updatedDelivery = await prisma.delivery.update({
      where: { id },
      data: {
        delivererId,
        status: DeliveryStatus.ASSIGNED
      }
    })

    await prisma.order.update({
      where: { id: delivery.orderId },
      data: { status: OrderStatus.DELIVERING }
    })

    // Émettre les événements temps réel
    notifyOrderStatusUpdate(delivery.orderId, OrderStatus.DELIVERING)
    notifyDeliveryAssigned(delivery.orderId, delivererId, deliverer.name)

    // Notifier le livreur et le client
    const orderShortId = delivery.orderId.slice(-6).toUpperCase()
    await createAndSendNotification(
      delivererId,
      `Vous avez été assigné à la livraison de la commande #${orderShortId}.`,
      delivery.orderId
    )
    await createAndSendNotification(
      delivery.order.customerId,
      `Le livreur ${deliverer.name} a été assigné à votre commande #${orderShortId}.`,
      delivery.orderId
    )

    return res.json(updatedDelivery)
  } catch (error: any) {
    console.error('Erreur assignDeliverer:', error)
    return res.status(500).json({ error: 'Impossible d\'assigner le livreur.' })
  }
}

// 6. Annuler la livraison (ADMIN ou LIVREUR assigné)
export const cancelDelivery = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Non authentifié.' })

    const { id } = req.params // deliveryId

    const delivery = await prisma.delivery.findUnique({
      where: { id },
      include: { order: true }
    })

    if (!delivery) {
      return res.status(404).json({ error: 'Livraison non trouvée.' })
    }

    if (req.user.role !== Role.ADMIN && delivery.delivererId !== req.user.id) {
      return res.status(403).json({ error: 'Accès interdit. Non autorisé à annuler cette livraison.' })
    }

    const updatedDelivery = await prisma.delivery.update({
      where: { id },
      data: {
        status: DeliveryStatus.CANCELLED,
        delivererId: null
      }
    })

    await prisma.order.update({
      where: { id: delivery.orderId },
      data: { status: OrderStatus.READY }
    })

    // Émettre l'événement temps réel
    notifyOrderStatusUpdate(delivery.orderId, OrderStatus.READY)

    // Notifier le client de l'annulation de la livraison
    const orderShortId = delivery.orderId.slice(-6).toUpperCase()
    await createAndSendNotification(
      delivery.order.customerId,
      `La livraison de votre commande #${orderShortId} a été annulée. Elle sera réassignée.`,
      delivery.orderId
    )

    return res.json(updatedDelivery)
  } catch (error: any) {
    console.error('Erreur cancelDelivery:', error)
    return res.status(500).json({ error: 'Impossible d\'annuler la livraison.' })
  }
}

// 7. Confirmer la réception de la commande (CLIENT uniquement)
export const confirmDelivery = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Non authentifié.' })

    const { id } = req.params // orderId
    const orderId = String(id)

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { delivery: true }
    })

    if (!order) {
      return res.status(404).json({ error: 'Commande non trouvée.' })
    }

    if (order.customerId !== req.user.id && req.user.role !== Role.ADMIN) {
      return res.status(403).json({ error: 'Accès interdit. Seul le client de cette commande peut confirmer la réception.' })
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.DELIVERED }
    })

    if (order.delivery) {
      await prisma.delivery.update({
        where: { id: order.delivery.id },
        data: {
          status: DeliveryStatus.DELIVERED,
          isPaid: true,
          deliveredAt: new Date()
        }
      })
    }

    // Émettre l'événement temps réel
    notifyOrderStatusUpdate(orderId, OrderStatus.DELIVERED)

    // Notifier le livreur et les admins
    const orderShortId = orderId.slice(-6).toUpperCase()
    if (order.delivery && order.delivery.delivererId) {
      await createAndSendNotification(
        order.delivery.delivererId,
        `Le client a validé la réception de la commande #${orderShortId}.`,
        orderId
      )
    }

    const admins = await prisma.user.findMany({
      where: { role: Role.ADMIN },
      select: { id: true }
    })
    for (const admin of admins) {
      await createAndSendNotification(
        admin.id,
        `La commande #${orderShortId} a été confirmée et payée.`,
        orderId
      )
    }

    return res.json(updatedOrder)
  } catch (error: any) {
    console.error('Erreur confirmDelivery:', error)
    return res.status(500).json({ error: 'Impossible de confirmer la réception de la livraison.' })
  }
}
