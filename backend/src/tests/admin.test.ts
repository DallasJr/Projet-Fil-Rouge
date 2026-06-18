import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../index'

// Generate mock JWT token for testing
const JWT_SECRET = process.env['JWT_SECRET'] || 'super-secret-key-change-this-in-production-12345!'

function generateToken(user: { id: string; email: string; role: string }) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '1h' })
}

// Mock pg.Pool to prevent real db connections
vi.mock('pg', () => {
  class MockPool {
    connect = vi.fn()
    query = vi.fn()
    end = vi.fn()
  }
  return {
    default: {
      Pool: MockPool
    },
    Pool: MockPool
  }
})

// Mock @prisma/client
vi.mock('@prisma/client', async (importOriginal) => {
  const actual = await importOriginal<any>()
  class MockPrismaClient {
    user = {
      findMany: vi.fn().mockResolvedValue([
        { id: '1', email: 'admin@test.com', name: 'Admin', role: 'ADMIN' }
      ]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        id: '2',
        email: 'deliverer@test.com',
        name: 'Deliverer',
        phone: '1234',
        role: 'DELIVERER',
        createdAt: new Date().toISOString()
      }),
      update: vi.fn(),
      delete: vi.fn(),
    }
    order = {
      findMany: vi.fn().mockResolvedValue([]),
      groupBy: vi.fn().mockResolvedValue([]),
    }
    review = {
      aggregate: vi.fn().mockResolvedValue({ _avg: { rating: 0 }, _count: { _all: 0 } }),
      findMany: vi.fn().mockResolvedValue([]),
    }
    orderItem = {
      findMany: vi.fn().mockResolvedValue([]),
    }
    $connect = vi.fn()
    $disconnect = vi.fn()
  }
  return {
    ...actual,
    PrismaClient: MockPrismaClient,
  }
})

describe('Admin Routes Protection (Integration Tests)', () => {
  
  describe('GET /api/admin/users', () => {
    it('should deny access if user is not authenticated (missing token)', async () => {
      const res = await request(app).get('/api/admin/users')
      expect(res.status).toBe(401)
      expect(res.body.error).toBe('Accès non autorisé. Token manquant.')
    })

    it('should deny access if user has CLIENT role', async () => {
      const clientToken = generateToken({ id: 'c1', email: 'client@test.com', role: 'CLIENT' })
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${clientToken}`)
      
      expect(res.status).toBe(403)
      expect(res.body.error).toBe('Accès interdit. Permissions insuffisantes.')
    })

    it('should deny access if user has DELIVERER role', async () => {
      const delivererToken = generateToken({ id: 'd1', email: 'deliverer@test.com', role: 'DELIVERER' })
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${delivererToken}`)
      
      expect(res.status).toBe(403)
      expect(res.body.error).toBe('Accès interdit. Permissions insuffisantes.')
    })

    it('should allow access if user has ADMIN role', async () => {
      const adminToken = generateToken({ id: 'a1', email: 'admin@test.com', role: 'ADMIN' })
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
      
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
    })
  })

  describe('POST /api/admin/users/deliverer', () => {
    it('should deny access if user has CLIENT role', async () => {
      const clientToken = generateToken({ id: 'c1', email: 'client@test.com', role: 'CLIENT' })
      const res = await request(app)
        .post('/api/admin/users/deliverer')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ email: 'new@test.com', name: 'New Deliverer', password: 'Password1!' })
      
      expect(res.status).toBe(403)
    })

    it('should allow access if user has ADMIN role', async () => {
      const adminToken = generateToken({ id: 'a1', email: 'admin@test.com', role: 'ADMIN' })
      const res = await request(app)
        .post('/api/admin/users/deliverer')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'new@test.com', name: 'New Deliverer', password: 'Password1!' })
      
      expect(res.status).toBe(201)
      expect(res.body.email).toBe('deliverer@test.com')
    })
  })
})
