import { Request, Response, NextFunction } from 'express'
import jwt, { Secret } from 'jsonwebtoken'
import { Role } from '@prisma/client'

// Étendre l'interface Request d'Express pour y ajouter l'utilisateur connecté
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    email: string
    role: Role
  }
}

// Middleware de vérification du Token JWT (Authentification)
export const authenticateJWT = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  let token: string | undefined = undefined
  const authHeader = req.headers.authorization

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1]
  } else if (req.query && req.query.token) {
    token = req.query.token as string
  }

  if (token) {
    const secret = ((process.env['JWT_SECRET'] as string) || 'super-secret-key-change-this-in-production-12345!') as Secret

    try {
      const decoded = (jwt.verify as any)(token, secret) as any
      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role as Role
      }
      return next()
    } catch (err) {
      return res.status(403).json({ error: 'Token invalide ou expiré.' })
    }
  } else {
    res.status(401).json({ error: 'Accès non autorisé. Token manquant.' })
  }
}

// Middleware d'authentification optionnelle (ne bloque pas si absent ou expiré)
export const optionalAuthenticateJWT = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1]
    const secret = ((process.env['JWT_SECRET'] as string) || 'super-secret-key-change-this-in-production-12345!') as Secret

    try {
      const decoded = (jwt.verify as any)(token, secret) as any
      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role as Role
      }
    } catch (err) {
      // Ignorer l'erreur pour garder l'accès optionnel
    }
  }
  return next()
}

// Middleware d'autorisation par Rôle (ex: autoriser uniquement ADMIN ou DELIVERER)
export const authorizeRoles = (...allowedRoles: Role[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Non authentifié.' })
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Accès interdit. Permissions insuffisantes.' })
    }

    return next()
  }
}
