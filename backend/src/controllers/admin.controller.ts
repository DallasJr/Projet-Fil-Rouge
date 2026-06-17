import { Response } from 'express'
import { AuthenticatedRequest } from '../middlewares/auth.middleware'
import { prisma } from '../index'
import bcrypt from 'bcryptjs'
import { Role } from '@prisma/client'

// 1. Lister tous les utilisateurs
export const getAllUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { role, isAvailable, dateFrom, dateTo } = req.query

    let whereClause: any = {}
    if (role && Object.values(Role).includes(role as Role)) {
      whereClause.role = role as Role
    }
    if (isAvailable !== undefined) {
      whereClause.isAvailable = isAvailable === 'true'
    }
    // Filtre par date d'inscription (fonctionnalité 14)
    if (dateFrom || dateTo) {
      whereClause.createdAt = {}
      if (dateFrom) whereClause.createdAt.gte = new Date(dateFrom as string)
      if (dateTo) whereClause.createdAt.lte = new Date(dateTo as string + 'T23:59:59.999Z')
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        isAvailable: true,
        createdAt: true,
        isSuspended: true,
        suspendedReason: true,
      },
      orderBy: { createdAt: 'desc' }
    })

    return res.json(users)
  } catch (error: any) {
    console.error('Erreur getAllUsers:', error)
    return res.status(500).json({ error: 'Impossible de récupérer les utilisateurs.' })
  }
}

// 2. Créer un livreur (DELIVERER)
export const createDeliverer = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, name, password, phone } = req.body

    if (!email || !name || !password) {
      return res.status(400).json({ error: 'Champs obligatoires manquants : email, name, password.' })
    }

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return res.status(400).json({ error: 'Un utilisateur avec cet email existe déjà.' })
    }

    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    const deliverer = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        phone,
        role: Role.DELIVERER
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true
      }
    })

    return res.status(201).json(deliverer)
  } catch (error: any) {
    console.error('Erreur createDeliverer:', error)
    return res.status(500).json({ error: 'Impossible de créer le compte livreur.' })
  }
}

// 3. Supprimer un utilisateur
export const deleteUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Non authentifié.' })

    const userId = String(req.params.id)

    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte.' })
    }

    const userToDelete = await prisma.user.findUnique({ where: { id: userId } })
    if (!userToDelete) {
      return res.status(404).json({ error: 'Utilisateur non trouvé.' })
    }

    if (userToDelete.role === Role.ADMIN) {
      return res.status(403).json({ error: 'Accès interdit. Impossible de supprimer un compte administrateur.' })
    }

    await prisma.user.delete({ where: { id: userId } })

    return res.json({ message: 'Utilisateur supprimé avec succès.' })
  } catch (error: any) {
    console.error('Erreur deleteUser:', error)
    return res.status(500).json({ error: 'Impossible de supprimer l\'utilisateur.' })
  }
}

// 4. Mettre à jour les informations et le rôle d'un utilisateur (inclut suspension)
export const updateUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = String(req.params.id)
    const { name, email, phone, role, isAvailable, isSuspended, suspendedReason } = req.body

    const existingUser = await prisma.user.findUnique({ where: { id: userId } })
    if (!existingUser) {
      return res.status(404).json({ error: 'Utilisateur non trouvé.' })
    }

    if (userId === req.user?.id && role && role !== existingUser.role) {
      return res.status(400).json({ error: 'Vous ne pouvez pas modifier votre propre rôle.' })
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        name: name !== undefined ? name : undefined,
        email: email !== undefined ? email : undefined,
        phone: phone !== undefined ? phone : undefined,
        role: role !== undefined ? role : undefined,
        isAvailable: isAvailable !== undefined ? isAvailable : undefined,
        isSuspended: isSuspended !== undefined ? isSuspended : undefined,
        suspendedReason: isSuspended !== undefined ? (isSuspended ? (suspendedReason || null) : null) : undefined,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        isAvailable: true,
        createdAt: true,
        isSuspended: true,
        suspendedReason: true,
      }
    })

    return res.json(updated)
  } catch (error: any) {
    console.error('Erreur updateUser:', error)
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Cet email est déjà utilisé par un autre utilisateur.' })
    }
    return res.status(500).json({ error: 'Impossible de mettre à jour l\'utilisateur.' })
  }
}

// 5. Statistiques détaillées d'un utilisateur (fonctionnalités 5, 6, 7, 8, 9)
export const getUserStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = String(req.params.id)

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isAvailable: true,
        isSuspended: true,
        suspendedReason: true,
        createdAt: true,
        // Commandes passées (CLIENT)
        orders: {
          select: {
            id: true,
            totalAmount: true,
            status: true,
            createdAt: true,
            delivery: {
              select: {
                deliveryAddress: true,
                deliveryFee: true,
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        // Livraisons effectuées (DELIVERER)
        deliveries: {
          select: {
            id: true,
            status: true,
            deliveryFee: true,
            isPaid: true,
            createdAt: true,
            deliveredAt: true,
            pickedAt: true,
            order: {
              select: {
                totalAmount: true,
                customer: { select: { name: true } }
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        // Adresses enregistrées (CLIENT)
        addresses: {
          select: {
            id: true,
            street: true,
            city: true,
            zipCode: true,
            isDefault: true,
            createdAt: true,
          },
          orderBy: { isDefault: 'desc' }
        },
        // Avis laissés (CLIENT)
        reviews: {
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5
        },
      }
    })

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé.' })
    }

    // Calcul stats CLIENT
    const completedOrders = user.orders.filter(o => o.status === 'DELIVERED')
    const cancelledOrders = user.orders.filter(o => o.status === 'CANCELLED')
    const totalSpent = completedOrders.reduce((sum, o) => sum + o.totalAmount, 0)
    const avgBasket = completedOrders.length > 0 ? totalSpent / completedOrders.length : 0

    // Adresses uniques extraites des livraisons (en plus des adresses enregistrées)
    const deliveryAddresses = [...new Set(
      user.orders
        .filter(o => o.delivery?.deliveryAddress)
        .map(o => o.delivery!.deliveryAddress)
    )]

    // Calcul stats LIVREUR
    const completedDeliveries = user.deliveries.filter(d => d.status === 'DELIVERED')
    const cancelledDeliveries = user.deliveries.filter(d => d.status === 'CANCELLED')
    const totalCommissions = completedDeliveries.reduce((sum, d) => sum + d.deliveryFee, 0)
    const successRate = user.deliveries.length > 0
      ? Math.round((completedDeliveries.length / user.deliveries.length) * 100)
      : 0

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isAvailable: user.isAvailable,
        isSuspended: user.isSuspended,
        suspendedReason: user.suspendedReason,
        createdAt: user.createdAt,
      },
      clientStats: {
        totalOrders: user.orders.length,
        completedOrders: completedOrders.length,
        cancelledOrders: cancelledOrders.length,
        totalSpent,
        avgBasket,
        recentOrders: user.orders.slice(0, 5),
        addresses: user.addresses,
        deliveryAddresses: deliveryAddresses.slice(0, 5),
        reviews: user.reviews,
        avgRatingGiven: user.reviews.length > 0
          ? Math.round(user.reviews.reduce((s, r) => s + r.rating, 0) / user.reviews.length * 10) / 10
          : null,
      },
      delivererStats: {
        totalDeliveries: user.deliveries.length,
        completedDeliveries: completedDeliveries.length,
        cancelledDeliveries: cancelledDeliveries.length,
        successRate,
        totalCommissions,
        recentDeliveries: user.deliveries.slice(0, 5),
      }
    })
  } catch (error: any) {
    console.error('Erreur getUserStats:', error)
    return res.status(500).json({ error: 'Impossible de récupérer les statistiques.' })
  }
}

// 11. Envoyer un message direct à un utilisateur (notification)
export const sendDirectMessage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = String(req.params.id)
    const { message } = req.body

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Le message ne peut pas être vide.' })
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé.' })
    }

    const notification = await prisma.notification.create({
      data: {
        userId,
        message: `📢 Message de l'administration : ${message.trim()}`,
        isRead: false,
      }
    })

    return res.json({ success: true, notification })
  } catch (error: any) {
    console.error('Erreur sendDirectMessage:', error)
    return res.status(500).json({ error: 'Impossible d\'envoyer le message.' })
  }
}

// 15. Export CSV de tous les utilisateurs
export const exportUsersCSV = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isAvailable: true,
        isSuspended: true,
        createdAt: true,
        _count: {
          select: {
            orders: true,
            deliveries: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    const header = ['ID', 'Nom', 'Email', 'Téléphone', 'Rôle', 'Disponible', 'Suspendu', 'Nb Commandes', 'Nb Livraisons', 'Date inscription']
    const rows = users.map(u => [
      u.id,
      `"${u.name}"`,
      u.email,
      u.phone || '',
      u.role,
      u.isAvailable ? 'Oui' : 'Non',
      (u as any).isSuspended ? 'Oui' : 'Non',
      u._count.orders,
      u._count.deliveries,
      new Date(u.createdAt).toLocaleDateString('fr-FR'),
    ])

    const csv = [header, ...rows].map(r => r.join(';')).join('\n')
    const bom = '\uFEFF' // BOM pour Excel FR

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="utilisateurs_${new Date().toISOString().slice(0, 10)}.csv"`)
    return res.send(bom + csv)
  } catch (error: any) {
    console.error('Erreur exportUsersCSV:', error)
    return res.status(500).json({ error: 'Impossible d\'exporter les données.' })
  }
}

// 16. Récupérer les statistiques agrégées pour le Dashboard
export const getDashboardStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // 1. Chiffre d'affaires
    const completedOrders = await prisma.order.findMany({
      where: { status: 'DELIVERED' },
      select: { totalAmount: true }
    })
    const totalRevenue = completedOrders.reduce((sum, o) => sum + o.totalAmount, 0)

    const orders7Days = await prisma.order.findMany({
      where: {
        status: 'DELIVERED',
        createdAt: { gte: sevenDaysAgo }
      },
      select: { totalAmount: true }
    })
    const revenue7Days = orders7Days.reduce((sum, o) => sum + o.totalAmount, 0)

    const orders30Days = await prisma.order.findMany({
      where: {
        status: 'DELIVERED',
        createdAt: { gte: thirtyDaysAgo }
      },
      select: { totalAmount: true }
    })
    const revenue30Days = orders30Days.reduce((sum, o) => sum + o.totalAmount, 0)

    // 2. Commandes par statut
    const ordersGroupByStatus = await prisma.order.groupBy({
      by: ['status'],
      _count: { _all: true }
    })
    const ordersByStatus: Record<string, number> = {
      PENDING: 0,
      ACCEPTED: 0,
      PREPARING: 0,
      READY: 0,
      DELIVERING: 0,
      DELIVERED: 0,
      CANCELLED: 0
    }
    ordersGroupByStatus.forEach(group => {
      ordersByStatus[group.status] = group._count._all
    })

    const totalOrdersCount = Object.values(ordersByStatus).reduce((a, b) => a + b, 0)

    // 3. Utilisateurs par rôle
    const usersGroupByRole = await prisma.user.groupBy({
      by: ['role'],
      _count: { _all: true }
    })
    const usersByRole: Record<string, number> = {
      CLIENT: 0,
      DELIVERER: 0,
      ADMIN: 0
    }
    usersGroupByRole.forEach(group => {
      usersByRole[group.role] = group._count._all
    })

    const activeDeliverersCount = await prisma.user.count({
      where: {
        role: 'DELIVERER',
        isAvailable: true,
        isSuspended: false
      }
    })

    // 4. Notes et Avis
    const reviewsStats = await prisma.review.aggregate({
      _avg: { rating: true },
      _count: { _all: true }
    })
    const avgRating = reviewsStats._avg.rating || 0
    const totalReviews = reviewsStats._count._all || 0

    const recentReviews = await prisma.review.findMany({
      include: {
        customer: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 15
    })

    // 5. Chiffre d'affaires journalier (7 derniers jours)
    const dailyRevenue = []
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date()
      dayStart.setHours(0, 0, 0, 0)
      dayStart.setDate(dayStart.getDate() - i)
      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 1)

      const dayOrders = await prisma.order.findMany({
        where: {
          status: 'DELIVERED',
          createdAt: {
            gte: dayStart,
            lt: dayEnd
          }
        },
        select: { totalAmount: true }
      })
      const amount = dayOrders.reduce((sum, o) => sum + o.totalAmount, 0)
      const dateString = dayStart.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
      dailyRevenue.push({ date: dateString, amount })
    }

    // 6. Top 5 des produits vendus (commandes livrées uniquement)
    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          status: 'DELIVERED'
        }
      },
      include: {
        item: true
      }
    })

    const itemsMap: Record<string, { id: string; name: string; quantity: number; revenue: number; imageUrl?: string | null }> = {}
    orderItems.forEach(oi => {
      if (!oi.item) return
      const itemId = oi.itemId
      if (!itemsMap[itemId]) {
        itemsMap[itemId] = { id: oi.item.id, name: oi.item.name, quantity: 0, revenue: 0, imageUrl: oi.item.imageUrl }
      }
      const entry = itemsMap[itemId]!
      entry.quantity += oi.quantity
      entry.revenue += oi.unitPrice * oi.quantity
    })

    const topItems = Object.values(itemsMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5)

    return res.json({
      revenue: {
        total: totalRevenue,
        last7Days: revenue7Days,
        last30Days: revenue30Days,
        daily: dailyRevenue
      },
      orders: {
        total: totalOrdersCount,
        byStatus: ordersByStatus
      },
      users: {
        total: Object.values(usersByRole).reduce((a, b) => a + b, 0),
        byRole: usersByRole,
        activeDeliverers: activeDeliverersCount
      },
      reviews: {
        count: totalReviews,
        avgRating: Math.round(avgRating * 10) / 10,
        recent: recentReviews
      },
      topItems
    })
  } catch (error: any) {
    console.error('Erreur getDashboardStats:', error)
    return res.status(500).json({ error: 'Impossible de calculer les statistiques du dashboard.' })
  }
}
