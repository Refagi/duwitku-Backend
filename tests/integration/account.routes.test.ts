import { describe, it, expect } from 'bun:test'
import app from '@/app.js'
import { prisma } from '../setup/db-setup.js'
import { withCleanDb } from '../setup/reset-db.js'
import { insertUser } from '../fixtures/user.fixture.js'
import { insertAccount } from '../fixtures/account.fixture.js'
import { insertCategory } from '../fixtures/category.fixture.js'
import { insertTransaction } from '../fixtures/transaction.fixture.js'
import { insertTransfer } from '../fixtures/transfer.fixture.js'
import { getAccessToken, authCookieHeader } from '../fixtures/auth.fixture.js'
import * as HttpStatusCodes from 'stoker/http-status-codes'

describe('Account routes', () => {
  withCleanDb()

  describe('GET /v1/accounts', () => {
    it('401 tanpa token', async () => {
      const res = await app.request('/v1/accounts')
      expect(res.status).toBe(HttpStatusCodes.UNAUTHORIZED)
    })

    it('200 dan hanya mengembalikan dompet milik user sendiri, urut createdAt asc', async () => {
      const { user } = await insertUser()
      const { user: otherUser } = await insertUser()
      const token = await getAccessToken(user.id)

      const first = await insertAccount(user.id, { name: 'Tunai' })
      const second = await insertAccount(user.id, { name: 'BCA' })
      await insertAccount(otherUser.id, { name: 'Punya Orang Lain' })

      const res = await app.request('/v1/accounts', { headers: authCookieHeader(token) })

      expect(res.status).toBe(HttpStatusCodes.OK)
      const body = await res.json()
      expect(body.data.accounts.length).toBe(2)
      expect(body.data.accounts.map((a: any) => a.id)).toEqual([first.id, second.id])
      expect(body.data.accounts.every((a: any) => a.userId === user.id)).toBe(true)
    })
  })

  describe('POST /v1/accounts', () => {
    it('201 dan berhasil membuat dompet baru', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)

      const res = await app.request('/v1/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authCookieHeader(token) },
        body: JSON.stringify({ name: 'DANA', type: 'EWALLET', balance: 100000 }),
      })

      expect(res.status).toBe(HttpStatusCodes.CREATED)
      const body = await res.json()
      expect(body.data.account).toMatchObject({ name: 'DANA', type: 'EWALLET', userId: user.id })
      expect(Number(body.data.account.balance)).toBe(100000)
    })

    it('balance default 0 jika tidak dikirim', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)

      const res = await app.request('/v1/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authCookieHeader(token) },
        body: JSON.stringify({ name: 'Tunai', type: 'CASH' }),
      })

      const body = await res.json()
      expect(Number(body.data.account.balance)).toBe(0)
    })

    it('400 jika type bukan CASH/BANK/EWALLET', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)

      const res = await app.request('/v1/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authCookieHeader(token) },
        body: JSON.stringify({ name: 'Crypto', type: 'CRYPTO' }),
      })

      expect(res.status).toBe(HttpStatusCodes.BAD_REQUEST)
    })

    it('400 jika name kosong', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)

      const res = await app.request('/v1/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authCookieHeader(token) },
        body: JSON.stringify({ name: '', type: 'CASH' }),
      })

      expect(res.status).toBe(HttpStatusCodes.BAD_REQUEST)
    })

    it('401 tanpa token', async () => {
      const res = await app.request('/v1/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Tunai', type: 'CASH' }),
      })
      expect(res.status).toBe(HttpStatusCodes.UNAUTHORIZED)
    })
  })

  describe('PUT /v1/accounts/:id', () => {
    it('200 dan berhasil update dompet milik sendiri', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)
      const account = await insertAccount(user.id, { name: 'Lama', balance: 0 })

      const res = await app.request(`/v1/accounts/${account.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authCookieHeader(token) },
        body: JSON.stringify({ name: 'Baru', balance: 500000 }),
      })

      expect(res.status).toBe(HttpStatusCodes.OK)
      const body = await res.json()
      expect(body.data.account.name).toBe('Baru')
      expect(Number(body.data.account.balance)).toBe(500000)
    })

    it('404 jika dompet tidak ditemukan', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)

      const res = await app.request('/v1/accounts/nonexistent-id', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authCookieHeader(token) },
        body: JSON.stringify({ name: 'Baru' }),
      })

      expect(res.status).toBe(HttpStatusCodes.NOT_FOUND)
    })

    it('404 jika mencoba update dompet milik user lain (ownership check)', async () => {
      const { user } = await insertUser()
      const { user: otherUser } = await insertUser()
      const token = await getAccessToken(user.id)
      const otherAccount = await insertAccount(otherUser.id, { name: 'Punya Orang Lain' })

      const res = await app.request(`/v1/accounts/${otherAccount.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authCookieHeader(token) },
        body: JSON.stringify({ name: 'Coba Curi' }),
      })

      expect(res.status).toBe(HttpStatusCodes.NOT_FOUND)
      const stillOriginal = await prisma.account.findUnique({ where: { id: otherAccount.id } })
      expect(stillOriginal!.name).not.toBe('Coba Curi')
    })
  })

  describe('DELETE /v1/accounts/:id', () => {
    it('200 dan berhasil hapus dompet tanpa transaksi/transfer', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)
      const account = await insertAccount(user.id)

      const res = await app.request(`/v1/accounts/${account.id}`, {
        method: 'DELETE',
        headers: authCookieHeader(token),
      })

      expect(res.status).toBe(HttpStatusCodes.OK)
      const found = await prisma.account.findUnique({ where: { id: account.id } })
      expect(found).toBeNull()
    })

    it('409 jika dompet masih punya riwayat transaksi', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)
      const account = await insertAccount(user.id)
      const category = await insertCategory(user.id)
      await insertTransaction(user.id, account.id, category.id)

      const res = await app.request(`/v1/accounts/${account.id}`, {
        method: 'DELETE',
        headers: authCookieHeader(token),
      })

      expect(res.status).toBe(HttpStatusCodes.CONFLICT)
      const stillExists = await prisma.account.findUnique({ where: { id: account.id } })
      expect(stillExists).not.toBeNull()
    })

    it('409 jika dompet masih dipakai sebagai fromAccount di transfer', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)
      const from = await insertAccount(user.id, { name: 'Sumber' })
      const to = await insertAccount(user.id, { name: 'Tujuan' })
      await insertTransfer(user.id, from.id, to.id)

      const res = await app.request(`/v1/accounts/${from.id}`, {
        method: 'DELETE',
        headers: authCookieHeader(token),
      })

      expect(res.status).toBe(HttpStatusCodes.CONFLICT)
    })

    it('409 jika dompet masih dipakai sebagai toAccount di transfer', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)
      const from = await insertAccount(user.id, { name: 'Sumber' })
      const to = await insertAccount(user.id, { name: 'Tujuan' })
      await insertTransfer(user.id, from.id, to.id)

      const res = await app.request(`/v1/accounts/${to.id}`, {
        method: 'DELETE',
        headers: authCookieHeader(token),
      })

      expect(res.status).toBe(HttpStatusCodes.CONFLICT)
    })

    it('404 jika mencoba hapus dompet milik user lain (ownership check)', async () => {
      const { user } = await insertUser()
      const { user: otherUser } = await insertUser()
      const token = await getAccessToken(user.id)
      const otherAccount = await insertAccount(otherUser.id)

      const res = await app.request(`/v1/accounts/${otherAccount.id}`, {
        method: 'DELETE',
        headers: authCookieHeader(token),
      })

      expect(res.status).toBe(HttpStatusCodes.NOT_FOUND)
      const stillExists = await prisma.account.findUnique({ where: { id: otherAccount.id } })
      expect(stillExists).not.toBeNull()
    })
  })
})
