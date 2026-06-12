import rateLimit from 'express-rate-limit'

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limite chaque IP à 100 requêtes par windowMs
  standardHeaders: true, // renvoie les en-têtes RateLimit-*
  legacyHeaders: false, // désactive les en-têtes X-RateLimit-* deprecated
  message: {
    error: 'Trop de requêtes. Réessayez dans 15 minutes.',
  },
})

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limiter les tentatives de connexion/inscription
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Trop de tentatives d\'authentification. Réessayez dans 15 minutes.',
  },
})
