import express from 'express'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

const adapter = new PrismaPg({
  connectionString: process.env['DATABASE_URL']!,
})

const prisma = new PrismaClient({ adapter })
const app = express()
const PORT = process.env['PORT'] || 3000

app.use(express.json())

app.get('/health', async (req, res) => {
  await prisma.$connect()
  res.json({ status: 'ok' })
})

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
})

export { prisma }