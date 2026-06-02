/**
 * Script de setup initial — à lancer UNE SEULE FOIS
 * - Passe le compte johndoe@gmail.com en ADMIN
 * - Crée le restaurant principal si inexistant
 * - Affiche l'ID du restaurant à copier dans frontend/.env
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const TARGET_EMAIL = 'johndoe@gmail.com'
const RESTAURANT_NAME = 'RestauApp'

const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL']! })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🚀 Démarrage du script de setup...\n')

  // 1. Passer le compte en ADMIN
  const user = await prisma.user.findUnique({ where: { email: TARGET_EMAIL } })
  if (!user) {
    console.error(`❌ Utilisateur "${TARGET_EMAIL}" non trouvé en base.`)
    console.log('   Créez d\'abord un compte via /register puis relancez ce script.')
    process.exit(1)
  }

  if (user.role === 'ADMIN') {
    console.log(`✅ "${user.name}" est déjà ADMIN.`)
  } else {
    await prisma.user.update({
      where: { email: TARGET_EMAIL },
      data: { role: 'ADMIN' }
    })
    console.log(`✅ "${user.name}" (${TARGET_EMAIL}) passé en ADMIN !`)
  }

  // 2. Créer le restaurant principal si inexistant
  let restaurant = await prisma.restaurant.findFirst()
  if (!restaurant) {
    restaurant = await prisma.restaurant.create({
      data: {
        name: RESTAURANT_NAME,
        description: 'Le meilleur restaurant de la ville !',
        address: '1 Rue de la Gastronomie, Paris',
        phone: '+33 1 23 45 67 89',
        isOpen: true,
        openAt: '11:00',
        closeAt: '23:00',
      }
    })
    console.log(`✅ Restaurant "${RESTAURANT_NAME}" créé !`)
  } else {
    console.log(`✅ Restaurant existant : "${restaurant.name}"`)
  }

  console.log('\n═══════════════════════════════════════════')
  console.log('📋 RESTAURANT ID :')
  console.log(`   ${restaurant.id}`)
  console.log('\n👉 Copiez cet ID dans frontend/.env :')
  console.log(`   VITE_RESTAURANT_ID=${restaurant.id}`)
  console.log('═══════════════════════════════════════════\n')

  // 3. Créer des catégories de démo si le menu est vide
  const catCount = await prisma.category.count()
  if (catCount === 0) {
    const defaultCategories = [
      { name: 'Entrées', displayOrder: 1 },
      { name: 'Plats principaux', displayOrder: 2 },
      { name: 'Pizzas', displayOrder: 3 },
      { name: 'Burgers', displayOrder: 4 },
      { name: 'Desserts', displayOrder: 5 },
      { name: 'Boissons', displayOrder: 6 },
    ]
    for (const cat of defaultCategories) {
      await prisma.category.create({
        data: { ...cat, restaurantId: restaurant.id }
      })
    }
    console.log('✅ 6 catégories de démo créées (Entrées, Plats, Pizzas, Burgers, Desserts, Boissons)')
  } else {
    console.log(`ℹ️  ${catCount} catégorie(s) déjà en base — pas de création.`)
  }

  console.log('\n🎉 Setup terminé ! Rechargez le frontend.')
}

main()
  .catch((e) => { console.error('❌ Erreur :', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect(); await pool.end() })
