import axiosClient from './axiosClient'

interface UploadImageResponse {
  url: string
  publicId: string
  width?: number
  height?: number
}

export const uploadImage = async (file: File): Promise<UploadImageResponse> => {
  const formData = new FormData()
  formData.append('image', file)

  const res = await axiosClient.post<UploadImageResponse>('/uploads/images', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

  return res.data
}
