import { Response } from 'express'
import { AuthenticatedRequest } from '../middlewares/auth.middleware'
import { prisma } from '../index'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { Role } from '@prisma/client'

const JWT_SECRET = process.env['JWT_SECRET'] || 'super-secret-key-change-this-in-production-12345!'

// Inscription (Register)
export const register = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, name, password, phone, role } = req.body

    // 1. Validations basiques
    if (!email || !name || !password) {
      return res.status(400).json({ error: 'Champs obligatoires manquants : email, name, password.' })
    }

    // 2. Vérifier si l'utilisateur existe déjà
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return res.status(400).json({ error: 'Un utilisateur avec cet email existe déjà.' })
    }

    // 3. Hachage du mot de passe (Sécurité bcrypt)
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    // 4. Déterminer le rôle (Optionnel : par défaut CLIENT)
    let userRole: Role = Role.CLIENT
    if (role && Object.values(Role).includes(role as Role)) {
      userRole = role as Role
    }

    // 5. Créer l'utilisateur dans la base PostgreSQL via Prisma
    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        phone,
        role: userRole,
      },
    })

    // 6. Générer le Token JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' } // Expire dans 7 jours
    )

    // 7. Renvoyer les informations de l'utilisateur (sans le mot de passe !)
    return res.status(201).json({
      message: 'Inscription réussie !',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
      },
    })
  } catch (error: any) {
    console.error('Erreur inscription:', error)
    return res.status(500).json({ error: 'Une erreur interne est survenue lors de l\'inscription.' })
  }
}

// Connexion (Login)
export const login = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, password } = req.body

    // 1. Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Veuillez saisir votre email et votre mot de passe.' })
    }

    // 2. Rechercher l'utilisateur en base
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' })
    }

    // 3. Comparer le mot de passe avec le hash
    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' })
    }

    // 4. Générer le Token JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    // 5. Renvoyer le token et l'utilisateur connecté
    return res.json({
      message: 'Connexion réussie !',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
      },
    })
  } catch (error) {
    console.error('Erreur connexion:', error)
    return res.status(500).json({ error: 'Une erreur interne est survenue lors de la connexion.' })
  }
}

// Récupérer le profil connecté (Me)
export const getProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Non autorisé.' })
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        createdAt: true,
      },
    })

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé.' })
    }

    return res.json(user)
  } catch (error) {
    console.error('Erreur profil:', error)
    return res.status(500).json({ error: 'Une erreur interne est survenue.' })
  }
}
