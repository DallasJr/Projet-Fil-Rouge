import { Response } from 'express'
import { AuthenticatedRequest } from '../middlewares/auth.middleware'
import { uploadImageToCloud } from '../services/cloudStorage.service'

export const uploadImage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Image manquante.' })
    }

    const uploadedImage = await uploadImageToCloud({
      fileBuffer: req.file.buffer,
      mimeType: req.file.mimetype,
    })
    return res.status(201).json(uploadedImage)
  } catch (error: any) {
    console.error('Erreur uploadImage:', error)
    return res.status(500).json({ error: error.message || "Impossible d'uploader l'image." })
  }
}
