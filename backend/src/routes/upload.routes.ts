import { NextFunction, Response, Router } from 'express'
import multer from 'multer'
import { Role } from '@prisma/client'
import { uploadImage } from '../controllers/upload.controller'
import { AuthenticatedRequest, authenticateJWT, authorizeRoles } from '../middlewares/auth.middleware'

const router = Router()

const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!allowedImageTypes.includes(file.mimetype)) {
      return callback(new Error('Image invalide. Formats acceptes: PNG, JPG, WEBP ou GIF.'))
    }

    return callback(null, true)
  },
}).single('image')

const handleImageUpload = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  imageUpload(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Image trop volumineuse. Taille maximale: 5 Mo.' })
    }

    if (error instanceof Error) {
      return res.status(400).json({ error: error.message })
    }

    return next()
  })
}

router.post('/images', authenticateJWT, authorizeRoles(Role.ADMIN), handleImageUpload, uploadImage)

export default router
