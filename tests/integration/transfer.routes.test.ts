import { describe, it, expect } from 'bun:test'
import app from '@/app.js'
import { prisma } from '../setup/db-setup.js'
import { withCleanDb } from '../setup/reset-db.js'
import { insertUser } from '../fixtures/user.fixture.js'
import { insertAccount } from '../fixtures/account.fixture.js'
import { insertTransfer } from '../fixtures/transfer.fixture.js'
import { getAccessToken, authCookieHeader } from '../fixtures/auth.fixture.js'
import * as HttpStatusCodes from 'stoker/http-status-codes'

async function createTransferViaApi(
  token: string,
  body: {
    fromAccountId: string
    toAccountId: string
    amount: number
    date?: string
    note?: string
  },
) {
  const res = await app.request('/v1/transfers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authCookieHeader(token) },
    body: JSON.stringify({ date: new Date().toISOString(), ...body }),
  })
  return res
}

describe('Transfer routes', () => {
  withCleanDb()

  describe('GET /v1/transfers', () => {
    it('401 tanpa token', async () => {
      const res = await app.request('/v1/transfers')
      expect(res.status).toBe(HttpStatusCodes.UNAUTHORIZED)
    })

    it('200 hanya mengembalikan transfer milik user sendiri', async () => {
      const { user } = await insertUser()
      const { user: otherUser } = await insertUser()
      const token = await getAccessToken(user.id)
      const from = await insertAccount(user.id, { name: 'Sumber' })
      const to = await insertAccount(user.id, { name: 'Tujuan' })
      const otherFrom = await insertAccount(otherUser.id)
      const otherTo = await insertAccount(otherUser.id)

      const mine = await insertTransfer(user.id, from.id, to.id)
      await insertTransfer(otherUser.id, otherFrom.id, otherTo.id)

      const res = await app.request('/v1/transfers', { headers: authCookieHeader(token) })

      expect(res.status).toBe(HttpStatusCodes.OK)
      const body = await res.json()
      expect(body.data.total).toBe(1)
      expect(body.data.data[0].id).toBe(mine.id)
    })

    it('200 filter accountId mencocokkan baik sebagai fromAccount maupun toAccount', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)
      const accountA = await insertAccount(user.id, { name: 'A' })
      const accountB = await insertAccount(user.id, { name: 'B' })
      const accountC = await insertAccount(user.id, { name: 'C' })

      const asFrom = await insertTransfer(user.id, accountA.id, accountB.id)
      const asTo = await insertTransfer(user.id, accountB.id, accountC.id)
      await insertTransfer(user.id, accountC.id, accountA.id)

      const res = await app.request(`/v1/transfers?accountId=${accountB.id}`, {
        headers: authCookieHeader(token),
      })

      const body = await res.json()
      const ids = body.data.data.map((t: any) => t.id)
      expect(ids.sort()).toEqual([asFrom.id, asTo.id].sort())
    })

    it('200 pencarian note (q) case-insensitive', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)
      const from = await insertAccount(user.id)
      const to = await insertAccount(user.id)

      const match = await insertTransfer(user.id, from.id, to.id, {
        note: 'Transfer buat bayar kos',
      })
      await insertTransfer(user.id, from.id, to.id, { note: 'Lain-lain' })

      const res = await app.request('/v1/transfers?q=kos', { headers: authCookieHeader(token) })

      const body = await res.json()
      expect(body.data.data.length).toBe(1)
      expect(body.data.data[0].id).toBe(match.id)
    })
  })

  describe('POST /v1/transfers', () => {
    it('201 dan saldo asal berkurang, tujuan bertambah', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)
      const from = await insertAccount(user.id, { name: 'Sumber', balance: 100000 })
      const to = await insertAccount(user.id, { name: 'Tujuan', balance: 20000 })

      const res = await createTransferViaApi(token, {
        fromAccountId: from.id,
        toAccountId: to.id,
        amount: 30000,
      })

      expect(res.status).toBe(HttpStatusCodes.CREATED)

      const fromAfter = await prisma.account.findUnique({ where: { id: from.id } })
      const toAfter = await prisma.account.findUnique({ where: { id: to.id } })
      expect(Number(fromAfter!.balance)).toBe(70000)
      expect(Number(toAfter!.balance)).toBe(50000)
    })

    it('400 jika saldo dompet asal tidak mencukupi', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)
      const from = await insertAccount(user.id, { balance: 10000 })
      const to = await insertAccount(user.id, { balance: 0 })

      const res = await createTransferViaApi(token, {
        fromAccountId: from.id,
        toAccountId: to.id,
        amount: 50000,
      })

      expect(res.status).toBe(HttpStatusCodes.BAD_REQUEST)
      const fromAfter = await prisma.account.findUnique({ where: { id: from.id } })
      expect(Number(fromAfter!.balance)).toBe(10000) // tidak berubah
    })

    it('400 jika fromAccountId sama dengan toAccountId (validasi schema)', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)
      const account = await insertAccount(user.id, { balance: 100000 })

      const res = await createTransferViaApi(token, {
        fromAccountId: account.id,
        toAccountId: account.id,
        amount: 10000,
      })

      expect(res.status).toBe(HttpStatusCodes.BAD_REQUEST)
    })

    it('404 jika fromAccountId bukan milik sendiri', async () => {
      const { user } = await insertUser()
      const { user: otherUser } = await insertUser()
      const token = await getAccessToken(user.id)
      const otherFrom = await insertAccount(otherUser.id, { balance: 100000 })
      const to = await insertAccount(user.id)

      const res = await createTransferViaApi(token, {
        fromAccountId: otherFrom.id,
        toAccountId: to.id,
        amount: 10000,
      })

      expect(res.status).toBe(HttpStatusCodes.NOT_FOUND)
    })

    it('404 jika toAccountId bukan milik sendiri', async () => {
      const { user } = await insertUser()
      const { user: otherUser } = await insertUser()
      const token = await getAccessToken(user.id)
      const from = await insertAccount(user.id, { balance: 100000 })
      const otherTo = await insertAccount(otherUser.id)

      const res = await createTransferViaApi(token, {
        fromAccountId: from.id,
        toAccountId: otherTo.id,
        amount: 10000,
      })

      expect(res.status).toBe(HttpStatusCodes.NOT_FOUND)
    })

    it('400 jika amount <= 0', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)
      const from = await insertAccount(user.id, { balance: 100000 })
      const to = await insertAccount(user.id)

      const res = await createTransferViaApi(token, {
        fromAccountId: from.id,
        toAccountId: to.id,
        amount: -100,
      })

      expect(res.status).toBe(HttpStatusCodes.BAD_REQUEST)
    })
  })

  describe('PUT /v1/transfers/:id', () => {
    it('200 dan saldo disesuaikan dengan benar saat amount berubah (dompet tetap sama)', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)
      const from = await insertAccount(user.id, { name: 'Sumber', balance: 100000 })
      const to = await insertAccount(user.id, { name: 'Tujuan', balance: 0 })

      const createRes = await createTransferViaApi(token, {
        fromAccountId: from.id,
        toAccountId: to.id,
        amount: 20000,
      })
      const { data } = await createRes.json()

      const res = await app.request(`/v1/transfers/${data.transfer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authCookieHeader(token) },
        body: JSON.stringify({ amount: 50000 }),
      })

      expect(res.status).toBe(HttpStatusCodes.OK)
      const body = await res.json()
      expect(body.data.transfer.isEdited).toBe(true)

      const fromAfter = await prisma.account.findUnique({ where: { id: from.id } })
      const toAfter = await prisma.account.findUnique({ where: { id: to.id } })
      expect(Number(fromAfter!.balance)).toBe(50000)
      expect(Number(toAfter!.balance)).toBe(50000)
    })

    it('200 dan saldo dipindah dengan benar saat fromAccountId diganti', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)
      const fromOld = await insertAccount(user.id, { name: 'Sumber Lama', balance: 100000 })
      const fromNew = await insertAccount(user.id, { name: 'Sumber Baru', balance: 200000 })
      const to = await insertAccount(user.id, { name: 'Tujuan', balance: 0 })

      const createRes = await createTransferViaApi(token, {
        fromAccountId: fromOld.id,
        toAccountId: to.id,
        amount: 30000,
      })
      const { data } = await createRes.json()

      const res = await app.request(`/v1/transfers/${data.transfer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authCookieHeader(token) },
        body: JSON.stringify({ fromAccountId: fromNew.id }),
      })

      expect(res.status).toBe(HttpStatusCodes.OK)

      const fromOldAfter = await prisma.account.findUnique({ where: { id: fromOld.id } })
      const fromNewAfter = await prisma.account.findUnique({ where: { id: fromNew.id } })
      const toAfter = await prisma.account.findUnique({ where: { id: to.id } })

      expect(Number(fromOldAfter!.balance)).toBe(100000)
      expect(Number(fromNewAfter!.balance)).toBe(170000)
      expect(Number(toAfter!.balance)).toBe(30000)
    })

    it('400 jika saldo tidak cukup untuk amount baru, mempertimbangkan efek lama yang belum di-reverse', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)
      const from = await insertAccount(user.id, { name: 'Sumber', balance: 100000 })
      const to = await insertAccount(user.id, { name: 'Tujuan', balance: 0 })

      const createRes = await createTransferViaApi(token, {
        fromAccountId: from.id,
        toAccountId: to.id,
        amount: 20000,
      })
      const { data } = await createRes.json()

      const okRes = await app.request(`/v1/transfers/${data.transfer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authCookieHeader(token) },
        body: JSON.stringify({ amount: 100000 }),
      })
      expect(okRes.status).toBe(HttpStatusCodes.OK)
    })

    it('400 jika saldo benar-benar tidak cukup untuk amount baru', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)
      const from = await insertAccount(user.id, { balance: 100000 })
      const to = await insertAccount(user.id, { balance: 0 })

      const createRes = await createTransferViaApi(token, {
        fromAccountId: from.id,
        toAccountId: to.id,
        amount: 20000,
      })
      const { data } = await createRes.json()

      const res = await app.request(`/v1/transfers/${data.transfer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authCookieHeader(token) },
        body: JSON.stringify({ amount: 999999 }),
      })

      expect(res.status).toBe(HttpStatusCodes.BAD_REQUEST)
    })

    it('409 jika transfer sudah pernah diedit sebelumnya', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)
      const from = await insertAccount(user.id, { balance: 100000 })
      const to = await insertAccount(user.id, { balance: 0 })

      const createRes = await createTransferViaApi(token, {
        fromAccountId: from.id,
        toAccountId: to.id,
        amount: 10000,
      })
      const { data } = await createRes.json()

      await app.request(`/v1/transfers/${data.transfer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authCookieHeader(token) },
        body: JSON.stringify({ amount: 15000 }),
      })

      const secondEditRes = await app.request(`/v1/transfers/${data.transfer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authCookieHeader(token) },
        body: JSON.stringify({ amount: 20000 }),
      })

      expect(secondEditRes.status).toBe(HttpStatusCodes.CONFLICT)
    })

    it('404 jika transfer bukan milik sendiri', async () => {
      const { user } = await insertUser()
      const { user: otherUser } = await insertUser()
      const token = await getAccessToken(user.id)
      const otherFrom = await insertAccount(otherUser.id)
      const otherTo = await insertAccount(otherUser.id)
      const otherTransfer = await insertTransfer(otherUser.id, otherFrom.id, otherTo.id)

      const res = await app.request(`/v1/transfers/${otherTransfer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authCookieHeader(token) },
        body: JSON.stringify({ amount: 5000 }),
      })

      expect(res.status).toBe(HttpStatusCodes.NOT_FOUND)
    })
  })

  describe('DELETE /v1/transfers/:id', () => {
    it('200 dan saldo dikembalikan penuh ke kedua dompet', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)
      const from = await insertAccount(user.id, { name: 'Sumber', balance: 100000 })
      const to = await insertAccount(user.id, { name: 'Tujuan', balance: 20000 })

      const createRes = await createTransferViaApi(token, {
        fromAccountId: from.id,
        toAccountId: to.id,
        amount: 30000,
      })
      const { data } = await createRes.json()

      const res = await app.request(`/v1/transfers/${data.transfer.id}`, {
        method: 'DELETE',
        headers: authCookieHeader(token),
      })

      expect(res.status).toBe(HttpStatusCodes.OK)
      const found = await prisma.transfer.findUnique({ where: { id: data.transfer.id } })
      expect(found).toBeNull()

      const fromAfter = await prisma.account.findUnique({ where: { id: from.id } })
      const toAfter = await prisma.account.findUnique({ where: { id: to.id } })
      expect(Number(fromAfter!.balance)).toBe(100000)
      expect(Number(toAfter!.balance)).toBe(20000)
    })

    it('404 jika transfer bukan milik sendiri', async () => {
      const { user } = await insertUser()
      const { user: otherUser } = await insertUser()
      const token = await getAccessToken(user.id)
      const otherFrom = await insertAccount(otherUser.id)
      const otherTo = await insertAccount(otherUser.id)
      const otherTransfer = await insertTransfer(otherUser.id, otherFrom.id, otherTo.id)

      const res = await app.request(`/v1/transfers/${otherTransfer.id}`, {
        method: 'DELETE',
        headers: authCookieHeader(token),
      })

      expect(res.status).toBe(HttpStatusCodes.NOT_FOUND)
      const stillExists = await prisma.transfer.findUnique({ where: { id: otherTransfer.id } })
      expect(stillExists).not.toBeNull()
    })
  })
})
