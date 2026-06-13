import crypto from 'crypto'

const CLOUDINARY_UPLOAD_URL = (cloudName: string) =>
  `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`

interface UploadImageInput {
  fileBuffer: Buffer
  mimeType: string
  folder?: string
}

export interface UploadedImage {
  url: string
  publicId: string
  width?: number
  height?: number
}

const buildSignature = (params: Record<string, string>, apiSecret: string) => {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&')

  return crypto.createHash('sha1').update(`${payload}${apiSecret}`).digest('hex')
}

export const uploadImageToCloud = async ({ fileBuffer, mimeType, folder = 'fil-rouge/menu' }: UploadImageInput): Promise<UploadedImage> => {
  const cloudName = process.env['CLOUDINARY_CLOUD_NAME']
  const uploadPreset = process.env['CLOUDINARY_UPLOAD_PRESET']
  const apiKey = process.env['CLOUDINARY_API_KEY']
  const apiSecret = process.env['CLOUDINARY_API_SECRET']

  if (!cloudName) {
    throw new Error('CLOUDINARY_CLOUD_NAME est manquant.')
  }

  const body = new FormData()
  const fileArrayBuffer = fileBuffer.buffer.slice(
    fileBuffer.byteOffset,
    fileBuffer.byteOffset + fileBuffer.byteLength
  ) as ArrayBuffer
  body.set('file', new Blob([fileArrayBuffer], { type: mimeType }))
  body.set('folder', folder)

  if (uploadPreset) {
    body.set('upload_preset', uploadPreset)
  } else {
    if (!apiKey || !apiSecret) {
      throw new Error('CLOUDINARY_API_KEY et CLOUDINARY_API_SECRET sont requis sans upload preset.')
    }

    const timestamp = Math.round(Date.now() / 1000).toString()
    const signatureParams = { folder, timestamp }

    body.set('api_key', apiKey)
    body.set('timestamp', timestamp)
    body.set('signature', buildSignature(signatureParams, apiSecret))
  }

  const response = await fetch(CLOUDINARY_UPLOAD_URL(cloudName), {
    method: 'POST',
    body,
  })

  const data = await response.json() as {
    secure_url?: string
    public_id?: string
    width?: number
    height?: number
    error?: { message?: string }
  }

  if (!response.ok || !data.secure_url || !data.public_id) {
    throw new Error(data.error?.message || 'Upload Cloudinary impossible.')
  }

  return {
    url: data.secure_url,
    publicId: data.public_id,
    width: data.width,
    height: data.height,
  }
}
