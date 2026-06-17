import axios from 'axios'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Change this to your local machine IP when testing on a physical device
// e.g. 'http://192.168.1.10:3000/api'
export const API_BASE_URL = 'http://192.168.1.92:3000/api'

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
})

// Attach JWT token automatically to every request
client.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token')
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

export default client
