import { Response } from 'express'
import { AuthenticatedRequest } from '../middlewares/auth.middleware'
import { prisma } from '../index'
import bcrypt from 'bcryptjs'
import { Role } from '@prisma/client'

// 1. Lister tous les utilisateurs
export const getAllUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { role } = req.query
    
    let whereClause: any = {}
    if (role && Object.values(Role).includes(role as Role)) {
      whereClause.role = role as Role
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true
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

    const { id } = req.params

    if (id === req.user.id) {
      return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte.' })
    }

    const userToDelete = await prisma.user.findUnique({ where: { id } })
    if (!userToDelete) {
      return res.status(404).json({ error: 'Utilisateur non trouvé.' })
    }

    // Protection : un admin ne peut pas supprimer un autre administrateur
    if (userToDelete.role === Role.ADMIN) {
      return res.status(403).json({ error: 'Accès interdit. Impossible de supprimer un compte administrateur.' })
    }

    await prisma.user.delete({ where: { id } })

    return res.json({ message: 'Utilisateur supprimé avec succès.' })
  } catch (error: any) {
    console.error('Erreur deleteUser:', error)
    return res.status(500).json({ error: 'Impossible de supprimer l\'utilisateur.' })
  }
}
