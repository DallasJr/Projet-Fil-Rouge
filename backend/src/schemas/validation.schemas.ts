import { z } from 'zod'
import { Role, OrderStatus, DeliveryStatus, PaymentMethod } from '@prisma/client'

export const registerSchema = z.object({
  email: z.string().trim().email({ message: 'Email invalide.' }),
  name: z.string().trim().min(2, { message: 'Le nom doit contenir au moins 2 caractères.' }),
  password: z.string().min(6, { message: 'Le mot de passe doit contenir au moins 6 caractères.' }),
  phone: z.string().trim().optional().nullable().transform((value) => (value === '' ? null : value)),
  role: z.nativeEnum(Role).optional(),
})

export const loginSchema = z.object({
  email: z.string().trim().email({ message: 'Email invalide.' }),
  password: z.string().min(1, { message: 'Le mot de passe est requis.' }),
})

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, { message: 'Le nom de la catégorie est requis.' }),
  displayOrder: z.coerce.number().int().nonnegative().optional().default(0),
  restaurantId: z.string().trim().min(1, { message: 'restaurantId est requis.' }),
})

export const createItemSchema = z.object({
  name: z.string().trim().min(1, { message: 'Le nom du plat est requis.' }),
  description: z.string().trim().optional().nullable().transform((value) => (value === '' ? null : value)),
  price: z.coerce.number().positive({ message: 'Le prix doit être un nombre positif.' }),
  imageUrl: z.string().trim().optional().nullable().transform((value) => (value === '' ? null : value)),
  isAvailable: z.boolean().optional().default(true),
  categoryId: z.string().trim().min(1, { message: 'categoryId est requis.' }),
})

export const updateItemSchema = createItemSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Au moins un champ est requis pour mettre à jour l\'article.' }
)

export const createOrderSchema = z.object({
  restaurantId: z.string().trim().min(1, { message: 'restaurantId est requis.' }),
  items: z
    .array(
      z.object({
        itemId: z.string().trim().min(1, { message: 'itemId est requis.' }),
        quantity: z.coerce.number().int().positive({ message: 'La quantité doit être un nombre entier positif.' }).default(1),
        note: z.string().trim().optional().nullable().transform((value) => (value === '' ? null : value)),
      })
    )
    .min(1, { message: 'Au moins un article est requis.' }),
  note: z.string().trim().optional().nullable().transform((value) => (value === '' ? null : value)),
  deliveryAddress: z.string().trim().optional().nullable().transform((value) => (value === '' ? null : value)),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  tableNumber: z.string().trim().optional().transform((value) => (value === '' ? undefined : value)),
})

export const updateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus, { message: 'Statut de commande invalide.' }),
})

export const updateDeliveryStatusSchema = z
  .object({
    status: z.nativeEnum(DeliveryStatus).optional(),
    isPaid: z.boolean().optional(),
  })
  .refine((data) => data.status !== undefined || data.isPaid !== undefined, {
    message: 'Au moins un champ doit être fourni pour la mise à jour de la livraison.',
  })

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email({ message: 'Email invalide.' }),
})

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(1, { message: 'Token de réinitialisation requis.' }),
  newPassword: z.string().min(6, { message: 'Le mot de passe doit contenir au moins 6 caractères.' }),
})
