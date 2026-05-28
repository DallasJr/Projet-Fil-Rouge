import { Response } from 'express'
import { AuthenticatedRequest } from '../middlewares/auth.middleware'
import { prisma } from '../index'

// --- CATEGORIES ---

// Récupérer toutes les catégories
export const getCategories = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { displayOrder: 'asc' },
      include: { items: true } // Inclure les plats de chaque catégorie
    })
    return res.json(categories)
  } catch (error: any) {
    console.error('Erreur getCategories:', error)
    return res.status(500).json({ error: 'Impossible de récupérer les catégories.' })
  }
}

// Créer une catégorie (ADMIN uniquement)
export const createCategory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, displayOrder, restaurantId } = req.body

    if (!name || !restaurantId) {
      return res.status(400).json({ error: 'Le nom de la catégorie et l\'ID du restaurant sont obligatoires.' })
    }

    const category = await prisma.category.create({
      data: {
        name: String(name),
        displayOrder: displayOrder ? Number(displayOrder) : 0,
        restaurantId: String(restaurantId)
      }
    })
    return res.status(201).json(category)
  } catch (error: any) {
    console.error('Erreur createCategory:', error)
    return res.status(500).json({ error: 'Impossible de créer la catégorie.' })
  }
}

// Supprimer une catégorie (ADMIN uniquement)
export const deleteCategory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = String(req.params['id'])

    const category = await prisma.category.findUnique({ where: { id } })
    if (!category) {
      return res.status(404).json({ error: 'Catégorie non trouvée.' })
    }

    await prisma.category.delete({ where: { id } })
    return res.json({ message: 'Catégorie supprimée avec succès.' })
  } catch (error: any) {
    console.error('Erreur deleteCategory:', error)
    return res.status(500).json({ error: 'Impossible de supprimer la catégorie.' })
  }
}


// --- ITEMS (PLATS/PRODUITS) ---

// Récupérer tous les items
export const getItems = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const items = await prisma.item.findMany({
      where: { isAvailable: true },
      include: { category: true }
    })
    return res.json(items)
  } catch (error: any) {
    console.error('Erreur getItems:', error)
    return res.status(500).json({ error: 'Impossible de récupérer les articles.' })
  }
}

// Créer un item (ADMIN uniquement)
export const createItem = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description, price, imageUrl, isAvailable, categoryId } = req.body

    if (!name || price === undefined || !categoryId) {
      return res.status(400).json({ error: 'Les champs name, price et categoryId sont obligatoires.' })
    }

    const item = await prisma.item.create({
      data: {
        name: String(name),
        description: description ? String(description) : null,
        price: parseFloat(price),
        imageUrl: imageUrl ? String(imageUrl) : null,
        isAvailable: isAvailable !== undefined ? Boolean(isAvailable) : true,
        categoryId: String(categoryId)
      }
    })
    return res.status(201).json(item)
  } catch (error: any) {
    console.error('Erreur createItem:', error)
    return res.status(500).json({ error: 'Impossible de créer l\'article.' })
  }
}

// Modifier un item (ADMIN uniquement)
export const updateItem = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    const { name, description, price, imageUrl, isAvailable, categoryId } = req.body

    const itemId = String(id)
    const existingItem = await prisma.item.findUnique({ where: { id: itemId } })
    if (!existingItem) {
      return res.status(404).json({ error: 'Article non trouvé.' })
    }

    const updatedItem = await prisma.item.update({
      where: { id: itemId },
      data: {
        name: name !== undefined ? String(name) : existingItem.name,
        description: description !== undefined ? String(description) : existingItem.description,
        price: price !== undefined ? parseFloat(price) : existingItem.price,
        imageUrl: imageUrl !== undefined ? String(imageUrl) : existingItem.imageUrl,
        isAvailable: isAvailable !== undefined ? Boolean(isAvailable) : existingItem.isAvailable,
        categoryId: categoryId !== undefined ? String(categoryId) : existingItem.categoryId
      }
    })
    return res.json(updatedItem)
  } catch (error: any) {
    console.error('Erreur updateItem:', error)
    return res.status(500).json({ error: 'Impossible de modifier l\'article.' })
  }
}

// Supprimer un item (ADMIN uniquement)
export const deleteItem = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    const itemId = String(id)

    const existingItem = await prisma.item.findUnique({ where: { id: itemId } })
    if (!existingItem) {
      return res.status(404).json({ error: 'Article non trouvé.' })
    }

    await prisma.item.delete({ where: { id: itemId } })
    return res.json({ message: 'Article supprimé avec succès.' })
  } catch (error: any) {
    console.error('Erreur deleteItem:', error)
    return res.status(500).json({ error: 'Impossible de supprimer l\'article.' })
  }
}
