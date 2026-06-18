import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL']! })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// Helper function to fetch remote image and convert to base64
async function fetchAsBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP error ${response.status}`)
    const arrayBuffer = await response.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    // Get mime type if possible, default to image/jpeg
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    return `data:${contentType};base64,${base64}`
  } catch (error) {
    console.error(`⚠️ Could not convert image to base64: ${url}`, error)
    return url // fallback to raw url
  }
}

async function main() {
  console.log('🚀 Seeding 13 plates in total (converting images to base64 for mobile compatibility)...')

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
    { name: 'Entrées', displayOrder: 1 },
    { name: 'Plats principaux', displayOrder: 2 },
    { name: 'Pizzas', displayOrder: 3 },
    { name: 'Burgers', displayOrder: 4 },
    { name: 'Desserts', displayOrder: 5 },
    { name: 'Boissons', displayOrder: 6 },
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

  // Dishes definition (3 original + 10 new) with high-res Unsplash links
  const dishes = [
    {
      name: 'Burger Gourmet',
      price: 14.90,
      description: 'Double steak Black Angus, cheddar affiné, oignons caramélisés & notre sauce secrète maison.',
      imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&auto=format&fit=crop&q=60',
      categoryName: 'Burgers',
      isGlutenFree: false,
      isVegetarian: false,
      isSpicy: false,
    },
    {
      name: 'Pizza Truffe & Prosciutto',
      price: 16.50,
      description: 'Base crème truffe blanche, mozzarella di bufala, prosciutto crudo & roquette fraîche.',
      imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&auto=format&fit=crop&q=60',
      categoryName: 'Pizzas',
      isGlutenFree: false,
      isVegetarian: false,
      isSpicy: false,
    },
    {
      name: 'Poke Bowl Saumon Avocat',
      price: 13.90,
      description: 'Saumon mariné premium, avocat crémeux, riz vinaigré, mangue fraîche & sésame grillé.',
      imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=60',
      categoryName: 'Plats principaux',
      isGlutenFree: true,
      isVegetarian: false,
      isSpicy: false,
    },
    {
      name: 'Burrata Crémeuse',
      price: 9.50,
      description: 'Mozzarella di bufala au cœur crémeux, tomates cerises confites, pesto maison et pignons grillés.',
      imageUrl: 'https://images.unsplash.com/photo-1608897013039-887f21d8c804?w=400&auto=format&fit=crop&q=60',
      categoryName: 'Entrées',
      isGlutenFree: true,
      isVegetarian: true,
      isSpicy: false,
    },
    {
      name: 'Tapas de Patatas Bravas',
      price: 6.80,
      description: 'Pommes de terre croustillantes avec sauce tomate piquante espagnole maison et aïoli.',
      imageUrl: 'https://images.unsplash.com/photo-1541532713592-79a0317b6b77?w=400&auto=format&fit=crop&q=60',
      categoryName: 'Entrées',
      isGlutenFree: true,
      isVegetarian: true,
      isSpicy: true,
    },
    {
      name: 'Crispy Chicken Burger',
      price: 13.90,
      description: 'Poulet croustillant pané, cheddar fondu, salade iceberg, tomates et sauce mayonnaise spicy maison.',
      imageUrl: 'https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?w=400&auto=format&fit=crop&q=60',
      categoryName: 'Burgers',
      isGlutenFree: false,
      isVegetarian: false,
      isSpicy: true,
    },
    {
      name: 'Green Veggie Burger',
      price: 12.90,
      description: 'Galette de quinoa et légumes, avocat frais, oignons rouges, pousses d\'épinards et sauce yaourt-fines herbes.',
      imageUrl: 'https://images.unsplash.com/photo-1525059696034-4967a8e1dca2?w=400&auto=format&fit=crop&q=60',
      categoryName: 'Burgers',
      isGlutenFree: false,
      isVegetarian: true,
      isSpicy: false,
    },
    {
      name: 'Pizza Reine Classique',
      price: 12.50,
      description: 'Sauce tomate maison, mozzarella fondue, jambon blanc aux herbes et champignons frais de Paris.',
      imageUrl: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=400&auto=format&fit=crop&q=60',
      categoryName: 'Pizzas',
      isGlutenFree: false,
      isVegetarian: false,
      isSpicy: false,
    },
    {
      name: 'Pizza Diavola',
      price: 14.00,
      description: 'Sauce tomate, mozzarella, salami piquant italien, n\'duja calabraise et piments frais.',
      imageUrl: 'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?w=400&auto=format&fit=crop&q=60',
      categoryName: 'Pizzas',
      isGlutenFree: false,
      isVegetarian: false,
      isSpicy: true,
    },
    {
      name: 'Pavé de Saumon Rôti',
      price: 18.50,
      description: 'Saumon sauvage rôti, écrasé de pommes de terre à l\'huile d\'olive, légumes de saison glacés au miel.',
      imageUrl: 'https://images.unsplash.com/photo-1485921325833-c519f76c4927?w=400&auto=format&fit=crop&q=60',
      categoryName: 'Plats principaux',
      isGlutenFree: true,
      isVegetarian: false,
      isSpicy: false,
    },
    {
      name: 'Tiramisu Café Maison',
      price: 7.00,
      description: 'Recette traditionnelle italienne au café, mascarpone onctueux et biscuits cuillères imbibés.',
      imageUrl: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400&auto=format&fit=crop&q=60',
      categoryName: 'Desserts',
      isGlutenFree: false,
      isVegetarian: true,
      isSpicy: false,
    },
    {
      name: 'Fondant Chocolat Intense',
      price: 6.50,
      description: 'Cœur coulant au chocolat noir 70%, servi chaud avec une boule de glace vanille Bourbon.',
      imageUrl: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400&auto=format&fit=crop&q=60',
      categoryName: 'Desserts',
      isGlutenFree: false,
      isVegetarian: true,
      isSpicy: false,
    },
    {
      name: 'Thé Glacé Pêche Maison',
      price: 4.50,
      description: 'Thé noir infusé à froid, nectar de pêche jaune locale, menthe fraîche et une touche de citron pressé.',
      imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&auto=format&fit=crop&q=60',
      categoryName: 'Boissons',
      isGlutenFree: true,
      isVegetarian: true,
      isSpicy: false,
    }
  ]

  for (const dish of dishes) {
    const categoryId = categoriesMap[dish.categoryName]
    if (!categoryId) {
      throw new Error(`Category ${dish.categoryName} was not found or created.`)
    }

    console.log(`⏳ Converting and fetching image for ${dish.name}...`)
    const base64Image = await fetchAsBase64(dish.imageUrl)

    const existingItem = await prisma.item.findFirst({
      where: { name: dish.name, categoryId }
    })

    if (existingItem) {
      await prisma.item.update({
        where: { id: existingItem.id },
        data: {
          price: dish.price,
          description: dish.description,
          imageUrl: base64Image,
          isGlutenFree: dish.isGlutenFree,
          isVegetarian: dish.isVegetarian,
          isSpicy: dish.isSpicy,
        }
      })
      console.log(`✅ Updated plate: ${dish.name}`)
    } else {
      await prisma.item.create({
        data: {
          name: dish.name,
          price: dish.price,
          description: dish.description,
          imageUrl: base64Image,
          categoryId,
          isGlutenFree: dish.isGlutenFree,
          isVegetarian: dish.isVegetarian,
          isSpicy: dish.isSpicy,
        }
      })
      console.log(`✅ Created plate: ${dish.name}`)
    }
  }

  console.log('🎉 All 13 plates with base64 images seeded successfully!')
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
