import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import bcrypt from 'bcryptjs'

const TARGET_EMAIL = 'admin_e2e@example.com'

const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL']! })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🚀 Checking E2E Admin user...')
  
  const salt = await bcrypt.genSalt(10)
  const hashedPassword = await bcrypt.hash('AdminPassword123!', salt)

  const user = await prisma.user.findUnique({ where: { email: TARGET_EMAIL } })
  if (!user) {
    await prisma.user.create({
      data: {
        email: TARGET_EMAIL,
        name: 'Admin E2E',
        password: hashedPassword,
        role: 'ADMIN'
      }
    })
    console.log(`✅ E2E Admin user created: ${TARGET_EMAIL}`)
  } else {
    await prisma.user.update({
      where: { email: TARGET_EMAIL },
      data: { role: 'ADMIN', password: hashedPassword }
    })
    console.log(`✅ E2E Admin user updated/ensured: ${TARGET_EMAIL}`)
  }
}

main()
  .catch((e) => { console.error('❌ Erreur :', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect(); await pool.end() })
