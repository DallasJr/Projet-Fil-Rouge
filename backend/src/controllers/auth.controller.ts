import crypto from 'crypto'
import { Response } from 'express'
import { AuthenticatedRequest } from '../middlewares/auth.middleware'
import { prisma } from '../index'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { Role } from '@prisma/client'
import { sendPasswordResetEmail } from '../services/email.service'

const JWT_SECRET = process.env['JWT_SECRET'] || 'super-secret-key-change-this-in-production-12345!'
const RESET_TOKEN_EXPIRATION_MINUTES = 60

const hashToken = (token: string) =>
  crypto.createHash('sha256').update(token).digest('hex')

const generateResetToken = () => crypto.randomBytes(32).toString('hex')

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

    // 4. Déterminer le rôle (Toujours CLIENT pour l'inscription publique)
    let userRole: Role = Role.CLIENT

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
        avatarUrl: user.avatarUrl,
        isAvailable: user.isAvailable,
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
        avatarUrl: user.avatarUrl,
        isAvailable: user.isAvailable,
      },
    })
  } catch (error) {
    console.error('Erreur connexion:', error)
    return res.status(500).json({ error: 'Une erreur interne est survenue lors de la connexion.' })
  }
}

// Demander la réinitialisation du mot de passe
export const forgotPassword = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ error: 'Email requis.' })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return res.json({ message: 'Si un compte existe, un email de réinitialisation a été envoyé.' })
    }

    const token = generateResetToken()
    const tokenHash = hashToken(token)
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRATION_MINUTES * 60 * 1000)

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    })

    // Envoyer le mail de réinitialisation
    sendPasswordResetEmail(user.email, token, user.name).catch((err) => {
      console.error("Erreur d'envoi d'email de réinitialisation de mot de passe:", err)
    })

    if (process.env.NODE_ENV !== 'production') {
      console.log(`Password reset token for ${email}: ${token}`)
    }

    return res.json({ message: 'Si un compte existe, un email de réinitialisation a été envoyé.' })
  } catch (error: any) {
    console.error('Erreur forgotPassword:', error)
    return res.status(500).json({ error: 'Une erreur interne est survenue lors de la demande de réinitialisation.' })
  }
}

// Réinitialiser le mot de passe avec le token
export const resetPassword = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { token, newPassword } = req.body

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token et nouveau mot de passe requis.' })
    }

    const tokenHash = hashToken(token)
    const resetRecord = await prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        used: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: true,
      },
    })

    if (!resetRecord || !resetRecord.user) {
      return res.status(400).json({ error: 'Token invalide ou expiré.' })
    }

    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(newPassword, salt)

    await prisma.user.update({
      where: { id: resetRecord.userId },
      data: { password: hashedPassword },
    })

    await prisma.passwordResetToken.update({
      where: { id: resetRecord.id },
      data: { used: true },
    })

    return res.json({ message: 'Le mot de passe a été réinitialisé avec succès.' })
  } catch (error: any) {
    console.error('Erreur resetPassword:', error)
    return res.status(500).json({ error: 'Une erreur interne est survenue lors de la réinitialisation du mot de passe.' })
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
        avatarUrl: true,
        isAvailable: true,
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

// Mettre à jour la disponibilité (Livreur uniquement)
export const updateAvailability = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Non autorisé.' })
    }

    const { isAvailable } = req.body
    if (isAvailable === undefined) {
      return res.status(400).json({ error: 'isAvailable est requis.' })
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { isAvailable: Boolean(isAvailable) },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        avatarUrl: true,
        isAvailable: true
      }
    })

    return res.json(updatedUser)
  } catch (error) {
    console.error('Erreur updateAvailability:', error)
    return res.status(500).json({ error: 'Une erreur interne est survenue.' })
  }
}

// Mettre à jour le profil (nom, téléphone, avatar)
export const updateProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Non autorisé.' })
    }

    const { name, phone, avatarUrl } = req.body

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        name: name !== undefined ? String(name) : undefined,
        phone: phone !== undefined ? (phone === '' ? null : String(phone)) : undefined,
        avatarUrl: avatarUrl !== undefined ? (avatarUrl === '' ? null : String(avatarUrl)) : undefined,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        avatarUrl: true,
        isAvailable: true,
        createdAt: true,
      },
    })

    return res.json(updatedUser)
  } catch (error: any) {
    console.error('Erreur updateProfile:', error)
    return res.status(500).json({ error: 'Une erreur interne est survenue lors de la mise à jour du profil.' })
  }
}
