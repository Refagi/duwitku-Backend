// tests/integration/category.routes.test.ts
import { describe, it, expect } from 'bun:test'
import app from '@/app.js'
import { prisma } from '../setup/db-setup.js'
import { withCleanDb } from '../setup/reset-db.js'
import { insertUser } from '../fixtures/user.fixture.js'
import { insertCategory } from '../fixtures/category.fixture.js'
import { getAccessToken, authCookieHeader } from '../fixtures/auth.fixture.js'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { insertAccount } from "../fixtures/account.fixture.js";
import { insertTransaction } from "../fixtures/transaction.fixture.js";

describe('Category routes', () => {
  withCleanDb()

  describe('GET /v1/categories', () => {
    it('401 tanpa token', async () => {
      const res = await app.request('/v1/categories')
      expect(res.status).toBe(HttpStatusCodes.UNAUTHORIZED)
    })

    it('200 dan hanya mengembalikan kategori milik user sendiri', async () => {
      const { user } = await insertUser()
      const { user: otherUser } = await insertUser()
      const token = await getAccessToken(user.id)

      await insertCategory(user.id, { name: 'Gaji', type: 'INCOME' })
      await insertCategory(user.id, { name: 'Makan', type: 'EXPENSE' })
      await insertCategory(otherUser.id, { name: 'Punya Orang Lain', type: 'EXPENSE' })

      const res = await app.request('/v1/categories', {
        headers: authCookieHeader(token),
      })

      expect(res.status).toBe(HttpStatusCodes.OK)
      const body = await res.json()
      expect(body.data.categories.length).toBe(15)
      expect(body.data.categories.every((c: any) => c.userId === user.id)).toBe(true)
    })

    it('200 dan filter berdasarkan query type', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)

      await insertCategory(user.id, { name: 'Gaji', type: 'INCOME' })
      await insertCategory(user.id, { name: 'Makan', type: 'EXPENSE' })

      const res = await app.request('/v1/categories?type=INCOME', {
        headers: authCookieHeader(token),
      })

      const body = await res.json()
      expect(body.data.categories.length).toBe(5)
      expect(body.data.categories[0].type).toBe('INCOME')
    })
  })

  describe('POST /v1/categories', () => {
    it('201 dan isDefault selalu false walau dikirim true di body', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)

      const res = await app.request('/v1/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authCookieHeader(token) },
        body: JSON.stringify({ name: 'Hiburan', type: 'EXPENSE', isDefault: true }),
      })

      expect(res.status).toBe(HttpStatusCodes.CREATED)
      const body = await res.json()
      expect(body.data.category.isDefault).toBe(false)
      expect(body.data.category.userId).toBe(user.id)
    })

    it('400 jika name kosong', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)

      const res = await app.request('/v1/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authCookieHeader(token) },
        body: JSON.stringify({ name: '', type: 'EXPENSE' }),
      })

      expect(res.status).toBe(HttpStatusCodes.BAD_REQUEST)
    })

    it('400 jika type bukan INCOME/EXPENSE', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)

      const res = await app.request('/v1/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authCookieHeader(token) },
        body: JSON.stringify({ name: 'Belanja', type: 'SAVING' }),
      })

      expect(res.status).toBe(HttpStatusCodes.BAD_REQUEST)
    })

    it('401 tanpa token', async () => {
      const res = await app.request('/v1/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Belanja', type: 'EXPENSE' }),
      })
      expect(res.status).toBe(HttpStatusCodes.UNAUTHORIZED)
    })
  })

  describe('PUT /v1/categories/:id', () => {
    it('200 dan berhasil update kategori milik sendiri', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)
      const category = await insertCategory(user.id, { name: 'Lama' })

      const res = await app.request(`/v1/categories/${category.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authCookieHeader(token) },
        body: JSON.stringify({ name: 'Baru' }),
      })

      expect(res.status).toBe(HttpStatusCodes.OK)
      const body = await res.json()
      expect(body.data.category.name).toBe('Baru')
    })

    it('404 jika kategori tidak ditemukan', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)

      const res = await app.request('/v1/categories/nonexistent-id', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authCookieHeader(token) },
        body: JSON.stringify({ name: 'Baru' }),
      })

      expect(res.status).toBe(HttpStatusCodes.NOT_FOUND)
    })

    it('404 jika mencoba update kategori milik user lain', async () => {
      const { user } = await insertUser()
      const { user: otherUser } = await insertUser()
      const token = await getAccessToken(user.id)
      const otherCategory = await insertCategory(otherUser.id)

      const res = await app.request(`/v1/categories/${otherCategory.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authCookieHeader(token) },
        body: JSON.stringify({ name: 'Coba Curi' }),
      })

      expect(res.status).toBe(HttpStatusCodes.NOT_FOUND)
      const stillOriginal = await prisma.category.findUnique({ where: { id: otherCategory.id } })
      expect(stillOriginal!.name).not.toBe('Coba Curi')
    })

    it('400 jika param id kosong (route tidak akan match, tapi pastikan validasi body tetap benar untuk kasus lain)', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)
      const category = await insertCategory(user.id)

      const res = await app.request(`/v1/categories/${category.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authCookieHeader(token) },
        body: JSON.stringify({ type: 'BUKAN_ENUM_VALID' }),
      })

      expect(res.status).toBe(HttpStatusCodes.BAD_REQUEST)
    })
  })

  describe('DELETE /v1/categories/:id', () => {
    it('200 dan berhasil hapus kategori non-default tanpa transaksi', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)
      const category = await insertCategory(user.id, { isDefault: false })

      const res = await app.request(`/v1/categories/${category.id}`, {
        method: 'DELETE',
        headers: authCookieHeader(token),
      })

      expect(res.status).toBe(HttpStatusCodes.OK)
      const found = await prisma.category.findUnique({ where: { id: category.id } })
      expect(found).toBeNull()
    })

    it('409 jika kategori isDefault=true', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)
      const category = await insertCategory(user.id, { isDefault: true })

      const res = await app.request(`/v1/categories/${category.id}`, {
        method: 'DELETE',
        headers: authCookieHeader(token),
      })

      expect(res.status).toBe(HttpStatusCodes.CONFLICT)
      const stillExists = await prisma.category.findUnique({ where: { id: category.id } })
      expect(stillExists).not.toBeNull()
    })

    it('404 jika kategori tidak ditemukan / bukan milik sendiri', async () => {
      const { user } = await insertUser()
      const { user: otherUser } = await insertUser()
      const token = await getAccessToken(user.id)
      const otherCategory = await insertCategory(otherUser.id)

      const res = await app.request(`/v1/categories/${otherCategory.id}`, {
        method: 'DELETE',
        headers: authCookieHeader(token),
      })

      expect(res.status).toBe(HttpStatusCodes.NOT_FOUND)
    })

    it('409 jika kategori masih dipakai oleh transaksi', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)
      const account = await insertAccount(user.id)
      const category = await insertCategory(user.id, { isDefault: false, type: 'EXPENSE' })
      await insertTransaction(user.id, account.id, category.id)

      const res = await app.request(`/v1/categories/${category.id}`, {
        method: 'DELETE',
        headers: authCookieHeader(token),
      })

      expect(res.status).toBe(HttpStatusCodes.CONFLICT)
      const stillExists = await prisma.category.findUnique({ where: { id: category.id } })
      expect(stillExists).not.toBeNull()
    })
  })
})
