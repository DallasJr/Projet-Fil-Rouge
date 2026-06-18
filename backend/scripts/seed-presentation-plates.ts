import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL']! })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🚀 Seeding the 3 presentation plates...')

  // Get or create restaurant
  let restaurant = await prisma.restaurant.findFirst()
  if (!restaurant) {
    restaurant = await prisma.restaurant.create({
      data: {
        name: 'RestauApp',
        address: '1 Rue de la Gastronomie, Paris',
        isOpen: true,
      }
    })
  }

  // Ensure categories exist
  const categoriesToEnsure = [
    { name: 'Burgers', displayOrder: 4 },
    { name: 'Pizzas', displayOrder: 3 },
    { name: 'Plats principaux', displayOrder: 2 },
  ]

  const categoriesMap: { [key: string]: string } = {}
  for (const cat of categoriesToEnsure) {
    let category = await prisma.category.findFirst({
      where: { name: cat.name, restaurantId: restaurant.id }
    })
    if (!category) {
      category = await prisma.category.create({
        data: {
          name: cat.name,
          displayOrder: cat.displayOrder,
          restaurantId: restaurant.id,
        }
      })
    }
    categoriesMap[cat.name] = category.id
  }

  // Dishes definition
  const dishes = [
    {
      name: 'Burger Gourmet',
      price: 14.90,
      description: 'Double steak Black Angus, cheddar affiné, oignons caramélisés & notre sauce secrète maison.',
      imageUrl: 'http://10.92.6.69:3000/public/burger.png', // Fallback or public assets
      categoryName: 'Burgers',
      isGlutenFree: false,
      isVegetarian: false,
      isSpicy: false,
    },
    {
      name: 'Pizza Truffe & Prosciutto',
      price: 16.50,
      description: 'Base crème truffe blanche, mozzarella di bufala, prosciutto crudo & roquette fraîche.',
      imageUrl: 'http://10.92.6.69:3000/public/pizza.png',
      categoryName: 'Pizzas',
      isGlutenFree: false,
      isVegetarian: false,
      isSpicy: false,
    },
    {
      name: 'Poke Bowl Saumon Avocat',
      price: 13.90,
      description: 'Saumon mariné premium, avocat crémeux, riz vinaigré, mangue fraîche & sésame grillé.',
      imageUrl: 'http://10.92.6.69:3000/public/poke.png',
      categoryName: 'Plats principaux',
      isGlutenFree: true,
      isVegetarian: false,
      isSpicy: false,
    }
  ]

  for (const dish of dishes) {
    const categoryId = categoriesMap[dish.categoryName]
    if (!categoryId) {
      throw new Error(`Category ${dish.categoryName} was not found or created.`)
    }
    // Try to find if item already exists by name
    const existingItem = await prisma.item.findFirst({
      where: { name: dish.name, categoryId }
    })

    const imageUrl = dish.name === 'Burger Gourmet' ? '/burger.png' : dish.name === 'Pizza Truffe & Prosciutto' ? '/pizza.png' : '/poke.png'

    if (existingItem) {
      await prisma.item.update({
        where: { id: existingItem.id },
        data: {
          price: dish.price,
          description: dish.description,
          imageUrl,
          isGlutenFree: dish.isGlutenFree,
          isVegetarian: dish.isVegetarian,
          isSpicy: dish.isSpicy,
        }
      })
      console.log(`Updated plate: ${dish.name}`)
    } else {
      await prisma.item.create({
        data: {
          name: dish.name,
          price: dish.price,
          description: dish.description,
          imageUrl,
          categoryId,
          isGlutenFree: dish.isGlutenFree,
          isVegetarian: dish.isVegetarian,
          isSpicy: dish.isSpicy,
        }
      })
      console.log(`Created plate: ${dish.name}`)
    }
  }

  console.log('🎉 3 presentation plates seeded successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding plates:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
