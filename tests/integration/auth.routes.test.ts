import { describe, it, expect } from 'bun:test'
import app from '@/app.js'
import { prisma } from '../setup/db-setup.js'
import { withCleanDb } from '../setup/reset-db.js'
import { buildUser, insertUser } from '../fixtures/user.fixture.js'
import { insertRefreshToken, insertExpiredRefreshToken } from '../fixtures/token.fixture.js'
import * as HttpStatusCodes from 'stoker/http-status-codes'

function extractCookie(res: Response, name: string) {
  return res.headers
    .getSetCookie?.()
    .find((c) => c.startsWith(`${name}=`))
    ?.split(';')[0]
    .split('=')[1]
}

describe('Auth routes', () => {
  withCleanDb()

  describe('POST /v1/auth/register', () => {
    it('201 dan default categories terbuat', async () => {
      const newUser = buildUser()
      const res = await app.request('/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newUser.name,
          email: newUser.email,
          password: newUser.rawPassword,
        }),
      })

      expect(res.status).toBe(HttpStatusCodes.CREATED)
      const dbUser = await prisma.user.findUnique({
        where: { email: newUser.email },
        include: { categories: true },
      })
      expect(dbUser!.categories.length).toBeGreaterThan(0)
      expect(extractCookie(res, 'accessToken')).toBeDefined()
    })
    it('400 jika email sudah dipakai', async () => {
      const { user } = await insertUser()
      const res = await app.request('/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Lain', email: user.email, password: 'Password1!' }),
      })
      expect(res.status).toBe(HttpStatusCodes.BAD_REQUEST)
    })
  })
  it('400 jika password tidak memenuhi kriteria (tidak ada karakter spesial)', async () => {
    const newUser = buildUser()
    const res = await app.request('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newUser.name, email: newUser.email, password: 'password1' }),
    })

    expect(res.status).toBe(HttpStatusCodes.BAD_REQUEST)
  })
  it('400 jika email bukan @gmail.com', async () => {
    const res = await app.request('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Refagi', email: 'refagi@yahoo.com', password: 'Password1!' }),
    })

    expect(res.status).toBe(HttpStatusCodes.BAD_REQUEST)
  })

  describe('POST /v1/auth/login', () => {
    it('200 dan set cookies jika kredensial valid', async () => {
      const { user, rawPassword } = await insertUser()

      const res = await app.request('/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, password: rawPassword }),
      })

      expect(res.status).toBe(HttpStatusCodes.OK)
      const body = await res.json()
      expect(body.data.user.email).toBe(user.email)
      expect(extractCookie(res, 'accessToken')).toBeDefined()
    })

    it('401 jika password salah', async () => {
      const { user } = await insertUser()

      const res = await app.request('/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, password: 'WrongPass1!' }),
      })

      expect(res.status).toBe(HttpStatusCodes.UNAUTHORIZED)
    })

    it('401 jika user terdaftar via Google (password null)', async () => {
      const googleUser = await prisma.user.create({
        data: { name: 'Google User', email: 'googleuser@gmail.com', password: null },
      })

      const res = await app.request('/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: googleUser.email, password: 'Password1!' }),
      })

      expect(res.status).toBe(HttpStatusCodes.UNAUTHORIZED)
    })

    it('menghapus refresh token lama saat login ulang', async () => {
      const { user, rawPassword } = await insertUser()
      await insertRefreshToken(user.id)

      const before = await prisma.token.count({ where: { userId: user.id, type: 'REFRESH' } })
      expect(before).toBe(1)

      await app.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, password: rawPassword }),
      })

      const after = await prisma.token.count({ where: { userId: user.id, type: 'REFRESH' } })
      expect(after).toBe(1)
    })
  })

  describe('POST /v1/auth/logout', () => {
    it('200 dan menghapus refresh token dari DB', async () => {
      const { user } = await insertUser()
      const tokenDoc = await insertRefreshToken(user.id)

      const res = await app.request('/v1/auth/logout', {
        method: 'POST',
        headers: { Cookie: `refreshToken=${tokenDoc.token}` },
      })

      expect(res.status).toBe(HttpStatusCodes.OK)
      const found = await prisma.token.findUnique({ where: { id: tokenDoc.id } })
      expect(found).toBeNull()
    })

    it('404 jika tidak ada cookie refreshToken', async () => {
      const res = await app.request('/v1/auth/logout', { method: 'POST' })
      expect(res.status).toBe(HttpStatusCodes.NOT_FOUND)
    })

    it('404 jika refresh token sudah tidak ada / sudah logout', async () => {
      const res = await app.request('/v1/auth/logout', {
        method: 'POST',
        headers: { Cookie: 'refreshToken=nonexistent-token' },
      })
      expect(res.status).toBe(HttpStatusCodes.NOT_FOUND)
    })
  })

  describe('POST /v1/auth/refresh-token', () => {
    it('200, rotate token, dan token lama dihapus dari DB', async () => {
      const { user } = await insertUser()
      const tokenDoc = await insertRefreshToken(user.id)

      const res = await app.request('/v1/auth/refresh-token', {
        method: 'POST',
        headers: { Cookie: `refreshToken=${tokenDoc.token}` },
      })

      expect(res.status).toBe(HttpStatusCodes.OK)
      const oldTokenStillExists = await prisma.token.findUnique({ where: { id: tokenDoc.id } })
      expect(oldTokenStillExists).toBeNull()

      const newAccessCookie = extractCookie(res, 'accessToken')
      expect(newAccessCookie).toBeDefined()
    })

    it('401 jika refresh token expired', async () => {
      const { user } = await insertUser()
      const expiredToken = await insertExpiredRefreshToken(user.id)

      const res = await app.request('/v1/auth/refresh-token', {
        method: 'POST',
        headers: { Cookie: `refreshToken=${expiredToken.token}` },
      })

      expect(res.status).toBe(HttpStatusCodes.UNAUTHORIZED)
    })

    it('401 jika tidak ada cookie refreshToken sama sekali', async () => {
      const res = await app.request('/v1/auth/refresh-token', { method: 'POST' })
      expect(res.status).toBe(HttpStatusCodes.UNAUTHORIZED)
    })
  })

  describe('GET /v1/auth/me', () => {
    it('200 dan mengembalikan data user jika accessToken valid', async () => {
      const { user, rawPassword } = await insertUser()

      const loginRes = await app.request('/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, password: rawPassword }),
      })
      const accessToken = extractCookie(loginRes, 'accessToken')

      const res = await app.request('/v1/auth/me', {
        headers: { Cookie: `accessToken=${accessToken}` },
      })

      expect(res.status).toBe(HttpStatusCodes.OK)
      const body = await res.json()
      expect(body.data.email).toBe(user.email)
      expect(body.data).not.toHaveProperty('password')
    })

    it('401 jika tanpa token', async () => {
      const res = await app.request('/v1/auth/me')
      expect(res.status).toBe(HttpStatusCodes.UNAUTHORIZED)
    })

    it('401 jika token invalid/asal', async () => {
      const res = await app.request('/v1/auth/me', {
        headers: { Cookie: 'accessToken=random-invalid-token' },
      })
      expect(res.status).toBe(HttpStatusCodes.UNAUTHORIZED)
    })

    it('401 jika pakai refreshToken di tempat accessToken (type mismatch)', async () => {
      const { user } = await insertUser()
      const tokenDoc = await insertRefreshToken(user.id)

      const res = await app.request('/v1/auth/me', {
        headers: { Cookie: `accessToken=${tokenDoc.token}` },
      })
      expect(res.status).toBe(HttpStatusCodes.UNAUTHORIZED)
    })
  })
})
