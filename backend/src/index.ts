import express from 'express'
import helmet from 'helmet'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'

// Importer nos routes d'authentification, de menu et de commande
import authRoutes from './routes/auth.routes'
import menuRoutes from './routes/menu.routes'
import orderRoutes from './routes/order.routes'
import uploadRoutes from './routes/upload.routes'
import { apiLimiter } from './middlewares/security.middleware'

dotenv.config({ path: path.resolve(__dirname, '../.env') })

// Utilisation de pg native pour l'adapter Prisma
const pool = new pg.Pool({
  connectionString: process.env['DATABASE_URL']!,
})
const adapter = new PrismaPg(pool)

const prisma = new PrismaClient({ adapter })
const app = express()
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
app.use('/api/uploads', uploadRoutes)

app.get('/health', async (req, res) => {
  try {
    await prisma.$connect()
    res.json({ status: 'ok', database: 'connected' })
  } catch (error: any) {
    res.status(500).json({ status: 'error', error: error.message })
  }
})

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
})

export { prisma }
