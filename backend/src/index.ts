import express from 'express'
import helmet from 'helmet'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import cors from 'cors'
import 'dotenv/config'
import { createServer } from 'http'
import { initSocket } from './socket'

// Importer nos routes d'authentification, de menu et de commande
import authRoutes from './routes/auth.routes'
import menuRoutes from './routes/menu.routes'
import orderRoutes from './routes/order.routes'
import adminRoutes from './routes/admin.routes'
import notificationRoutes from './routes/notification.routes'
import reviewRoutes from './routes/review.routes'
import uploadRoutes from './routes/upload.routes'
import { apiLimiter } from './middlewares/security.middleware'

// Utilisation de pg native pour l'adapter Prisma
const pool = new pg.Pool({
  connectionString: process.env['DATABASE_URL']!,
})
const adapter = new PrismaPg(pool)

const prisma = new PrismaClient({ adapter })
const app = express()
const server = createServer(app)
const PORT = process.env['PORT'] || 3000

// Middlewares globaux
app.use(helmet())
app.use(cors()) // Permet aux applications React et React Native de communiquer avec l'API
app.use(express.json())
app.use(apiLimiter)

// Définir les routes de l'API
app.use('/api/auth', authRoutes)
app.use('/api/menu', menuRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/reviews', reviewRoutes)
app.use('/api/uploads', uploadRoutes)

app.get('/health', async (req, res) => {
  try {
    await prisma.$connect()
    res.json({ status: 'ok', database: 'connected' })
  } catch (error: any) {
    res.status(500).json({ status: 'error', error: error.message })
  }
})

// Initialiser le serveur Socket.io
initSocket(server)

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`)
  })
}

export { prisma, app }
