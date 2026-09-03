import { describe, it, expect } from 'bun:test'
import app from '@/app.js'
import { prisma } from '../setup/db-setup.js'
import { withCleanDb } from '../setup/reset-db.js'
import { insertUser } from '../fixtures/user.fixture.js'
import { insertAccount } from '../fixtures/account.fixture.js'
import { insertSavingsGoal } from '../fixtures/saving.fixture.js'
import { getAccessToken, authCookieHeader } from '../fixtures/auth.fixture.js'
import * as HttpStatusCodes from 'stoker/http-status-codes'

describe('Saving routes', () => {
  withCleanDb()

  describe('GET /v1/savings', () => {
    it('401 tanpa token', async () => {
      const res = await app.request('/v1/savings')
      expect(res.status).toBe(HttpStatusCodes.UNAUTHORIZED)
    })

    it('200 hanya mengembalikan rencana tabungan milik sendiri, urut createdAt desc', async () => {
      const { user } = await insertUser()
      const { user: otherUser } = await insertUser()
      const token = await getAccessToken(user.id)

      const first = await insertSavingsGoal(user.id, { name: 'Dana Darurat' })
      const second = await insertSavingsGoal(user.id, { name: 'Liburan' })
      await insertSavingsGoal(otherUser.id, { name: 'Punya Orang Lain' })

      const res = await app.request('/v1/savings', { headers: authCookieHeader(token) })

      expect(res.status).toBe(HttpStatusCodes.OK)
      const body = await res.json()
      expect(body.data.goals.length).toBe(2)
      expect(body.data.goals.map((g: any) => g.id)).toEqual([second.id, first.id])
    })
  })

  describe('GET /v1/savings/:id', () => {
    it('200 dan mengembalikan goal + allocations terkait saja', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)
      const account = await insertAccount(user.id, { balance: 500000 })
      const goal = await insertSavingsGoal(user.id, { name: 'Dana Darurat', targetAmount: 1000000 })

      const depositRes = await app.request(`/v1/savings/${goal.id}/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authCookieHeader(token) },
        body: JSON.stringify({
          accountId: account.id,
          amount: 100000,
          date: new Date().toISOString(),
        }),
      })
      expect(depositRes.status).toBe(HttpStatusCodes.CREATED)

      const res = await app.request(`/v1/savings/${goal.id}`, { headers: authCookieHeader(token) })

      expect(res.status).toBe(HttpStatusCodes.OK)
      const body = await res.json()
      expect(body.data.goal.id).toBe(goal.id)
      expect(body.data.allocations.length).toBe(1)
      expect(body.data.allocations[0].account.id).toBe(account.id)
    })

    it('404 jika goal tidak ditemukan / bukan milik sendiri', async () => {
      const { user } = await insertUser()
      const { user: otherUser } = await insertUser()
      const token = await getAccessToken(user.id)
      const otherGoal = await insertSavingsGoal(otherUser.id)

      const res = await app.request(`/v1/savings/${otherGoal.id}`, {
        headers: authCookieHeader(token),
      })
      expect(res.status).toBe(HttpStatusCodes.NOT_FOUND)
    })
  })

  describe('POST /v1/savings', () => {
    it('201 dan currentAmount default 0', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)

      const res = await app.request('/v1/savings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authCookieHeader(token) },
        body: JSON.stringify({ name: 'Dana Darurat', targetAmount: 5000000 }),
      })

      expect(res.status).toBe(HttpStatusCodes.CREATED)
      const body = await res.json()
      expect(body.data.goal.name).toBe('Dana Darurat')
      expect(Number(body.data.goal.targetAmount)).toBe(5000000)
      expect(Number(body.data.goal.currentAmount)).toBe(0)
    })

    it('400 jika targetAmount <= 0', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)

      const res = await app.request('/v1/savings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authCookieHeader(token) },
        body: JSON.stringify({ name: 'Dana Darurat', targetAmount: -1000 }),
      })

      expect(res.status).toBe(HttpStatusCodes.BAD_REQUEST)
    })

    it('401 tanpa token', async () => {
      const res = await app.request('/v1/savings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Dana Darurat', targetAmount: 5000000 }),
      })
      expect(res.status).toBe(HttpStatusCodes.UNAUTHORIZED)
    })
  })

  describe('PUT /v1/savings/:id', () => {
    it('200 dan berhasil update rencana milik sendiri', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)
      const goal = await insertSavingsGoal(user.id, { name: 'Lama' })

      const res = await app.request(`/v1/savings/${goal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authCookieHeader(token) },
        body: JSON.stringify({ name: 'Baru' }),
      })

      expect(res.status).toBe(HttpStatusCodes.OK)
      const body = await res.json()
      expect(body.data.goal.name).toBe('Baru')
    })

    it('404 jika mencoba update rencana milik user lain', async () => {
      const { user } = await insertUser()
      const { user: otherUser } = await insertUser()
      const token = await getAccessToken(user.id)
      const otherGoal = await insertSavingsGoal(otherUser.id)

      const res = await app.request(`/v1/savings/${otherGoal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authCookieHeader(token) },
        body: JSON.stringify({ name: 'Coba Curi' }),
      })

      expect(res.status).toBe(HttpStatusCodes.NOT_FOUND)
    })
  })

  describe('DELETE /v1/savings/:id', () => {
    it('200 dan berhasil hapus rencana dengan currentAmount 0', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)
      const goal = await insertSavingsGoal(user.id, { currentAmount: 0 })

      const res = await app.request(`/v1/savings/${goal.id}`, {
        method: 'DELETE',
        headers: authCookieHeader(token),
      })

      expect(res.status).toBe(HttpStatusCodes.OK)
      const found = await prisma.savingsGoal.findUnique({ where: { id: goal.id } })
      expect(found).toBeNull()
    })

    it('409 jika currentAmount masih > 0', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)
      const goal = await insertSavingsGoal(user.id, { currentAmount: 100000 })

      const res = await app.request(`/v1/savings/${goal.id}`, {
        method: 'DELETE',
        headers: authCookieHeader(token),
      })

      expect(res.status).toBe(HttpStatusCodes.CONFLICT)
      const stillExists = await prisma.savingsGoal.findUnique({ where: { id: goal.id } })
      expect(stillExists).not.toBeNull()
    })

    it('404 jika mencoba hapus rencana milik user lain', async () => {
      const { user } = await insertUser()
      const { user: otherUser } = await insertUser()
      const token = await getAccessToken(user.id)
      const otherGoal = await insertSavingsGoal(otherUser.id)

      const res = await app.request(`/v1/savings/${otherGoal.id}`, {
        method: 'DELETE',
        headers: authCookieHeader(token),
      })

      expect(res.status).toBe(HttpStatusCodes.NOT_FOUND)
    })
  })

  describe('POST /v1/savings/:id/deposit', () => {
    it('201, saldo dompet berkurang dan currentAmount goal bertambah', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)
      const account = await insertAccount(user.id, { balance: 500000 })
      const goal = await insertSavingsGoal(user.id, { targetAmount: 1000000, currentAmount: 0 })

      const res = await app.request(`/v1/savings/${goal.id}/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authCookieHeader(token) },
        body: JSON.stringify({
          accountId: account.id,
          amount: 200000,
          date: new Date().toISOString(),
        }),
      })

      expect(res.status).toBe(HttpStatusCodes.CREATED)
      const body = await res.json()
      expect(body.data.allocation.type).toBe('DEPOSIT')

      const accountAfter = await prisma.account.findUnique({ where: { id: account.id } })
      const goalAfter = await prisma.savingsGoal.findUnique({ where: { id: goal.id } })
      expect(Number(accountAfter!.balance)).toBe(300000)
      expect(Number(goalAfter!.currentAmount)).toBe(200000)
    })

    it('400 jika saldo dompet tidak mencukupi', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)
      const account = await insertAccount(user.id, { balance: 50000 })
      const goal = await insertSavingsGoal(user.id)

      const res = await app.request(`/v1/savings/${goal.id}/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authCookieHeader(token) },
        body: JSON.stringify({
          accountId: account.id,
          amount: 200000,
          date: new Date().toISOString(),
        }),
      })

      expect(res.status).toBe(HttpStatusCodes.BAD_REQUEST)
      const accountAfter = await prisma.account.findUnique({ where: { id: account.id } })
      expect(Number(accountAfter!.balance)).toBe(50000) // tidak berubah, gagal total
    })

    it('404 jika goal bukan milik sendiri', async () => {
      const { user } = await insertUser()
      const { user: otherUser } = await insertUser()
      const token = await getAccessToken(user.id)
      const account = await insertAccount(user.id, { balance: 500000 })
      const otherGoal = await insertSavingsGoal(otherUser.id)

      const res = await app.request(`/v1/savings/${otherGoal.id}/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authCookieHeader(token) },
        body: JSON.stringify({
          accountId: account.id,
          amount: 100000,
          date: new Date().toISOString(),
        }),
      })

      expect(res.status).toBe(HttpStatusCodes.NOT_FOUND)
    })

    it('404 jika accountId bukan milik sendiri', async () => {
      const { user } = await insertUser()
      const { user: otherUser } = await insertUser()
      const token = await getAccessToken(user.id)
      const otherAccount = await insertAccount(otherUser.id, { balance: 500000 })
      const goal = await insertSavingsGoal(user.id)

      const res = await app.request(`/v1/savings/${goal.id}/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authCookieHeader(token) },
        body: JSON.stringify({
          accountId: otherAccount.id,
          amount: 100000,
          date: new Date().toISOString(),
        }),
      })

      expect(res.status).toBe(HttpStatusCodes.NOT_FOUND)
    })
  })

  describe('POST /v1/savings/:id/withdraw', () => {
    it('201, saldo dompet bertambah dan currentAmount goal berkurang', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)
      const account = await insertAccount(user.id, { balance: 100000 })
      const goal = await insertSavingsGoal(user.id, { currentAmount: 300000 })

      const res = await app.request(`/v1/savings/${goal.id}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authCookieHeader(token) },
        body: JSON.stringify({
          accountId: account.id,
          amount: 150000,
          date: new Date().toISOString(),
        }),
      })

      expect(res.status).toBe(HttpStatusCodes.CREATED)
      const body = await res.json()
      expect(body.data.allocation.type).toBe('WITHDRAW')

      const accountAfter = await prisma.account.findUnique({ where: { id: account.id } })
      const goalAfter = await prisma.savingsGoal.findUnique({ where: { id: goal.id } })
      expect(Number(accountAfter!.balance)).toBe(250000)
      expect(Number(goalAfter!.currentAmount)).toBe(150000)
    })

    it('400 jika dana tersimpan tidak mencukupi', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)
      const account = await insertAccount(user.id, { balance: 100000 })
      const goal = await insertSavingsGoal(user.id, { currentAmount: 50000 })

      const res = await app.request(`/v1/savings/${goal.id}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authCookieHeader(token) },
        body: JSON.stringify({
          accountId: account.id,
          amount: 200000,
          date: new Date().toISOString(),
        }),
      })

      expect(res.status).toBe(HttpStatusCodes.BAD_REQUEST)
      const goalAfter = await prisma.savingsGoal.findUnique({ where: { id: goal.id } })
      expect(Number(goalAfter!.currentAmount)).toBe(50000) // tidak berubah
    })

    it('404 jika accountId bukan milik sendiri', async () => {
      const { user } = await insertUser()
      const { user: otherUser } = await insertUser()
      const token = await getAccessToken(user.id)
      const otherAccount = await insertAccount(otherUser.id)
      const goal = await insertSavingsGoal(user.id, { currentAmount: 500000 })

      const res = await app.request(`/v1/savings/${goal.id}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authCookieHeader(token) },
        body: JSON.stringify({
          accountId: otherAccount.id,
          amount: 100000,
          date: new Date().toISOString(),
        }),
      })

      expect(res.status).toBe(HttpStatusCodes.NOT_FOUND)
    })
  })

  describe('Concurrency — deposit/withdraw', () => {
    it('dua withdraw bersamaan yang total melebihi currentAmount: hanya satu yang berhasil, currentAmount tidak pernah minus', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)
      const account = await insertAccount(user.id, { balance: 0 })
      const goal = await insertSavingsGoal(user.id, { currentAmount: 100000 })

      const [resA, resB] = await Promise.all([
        app.request(`/v1/savings/${goal.id}/withdraw`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authCookieHeader(token) },
          body: JSON.stringify({
            accountId: account.id,
            amount: 70000,
            date: new Date().toISOString(),
          }),
        }),
        app.request(`/v1/savings/${goal.id}/withdraw`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authCookieHeader(token) },
          body: JSON.stringify({
            accountId: account.id,
            amount: 70000,
            date: new Date().toISOString(),
          }),
        }),
      ])

      const statuses = [resA.status, resB.status].sort()
      expect(statuses).toEqual([HttpStatusCodes.BAD_REQUEST, HttpStatusCodes.CREATED].sort())

      const goalAfter = await prisma.savingsGoal.findUnique({ where: { id: goal.id } })
      const accountAfter = await prisma.account.findUnique({ where: { id: account.id } })

      expect(Number(goalAfter!.currentAmount)).toBe(30000)
      expect(Number(goalAfter!.currentAmount)).toBeGreaterThanOrEqual(0)
      expect(Number(accountAfter!.balance)).toBe(70000)

      const allocations = await prisma.savingsAllocation.count({
        where: { savingsGoalId: goal.id },
      })
      expect(allocations).toBe(1)
    })

    it('dua deposit bersamaan yang sama-sama valid: dua-duanya berhasil, tidak ada lost update', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)
      const account = await insertAccount(user.id, { balance: 500000 })
      const goal = await insertSavingsGoal(user.id, { currentAmount: 0 })

      const [resA, resB] = await Promise.all([
        app.request(`/v1/savings/${goal.id}/deposit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authCookieHeader(token) },
          body: JSON.stringify({
            accountId: account.id,
            amount: 100000,
            date: new Date().toISOString(),
          }),
        }),
        app.request(`/v1/savings/${goal.id}/deposit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authCookieHeader(token) },
          body: JSON.stringify({
            accountId: account.id,
            amount: 150000,
            date: new Date().toISOString(),
          }),
        }),
      ])

      expect(resA.status).toBe(HttpStatusCodes.CREATED)
      expect(resB.status).toBe(HttpStatusCodes.CREATED)

      const goalAfter = await prisma.savingsGoal.findUnique({ where: { id: goal.id } })
      const accountAfter = await prisma.account.findUnique({ where: { id: account.id } })

      expect(Number(goalAfter!.currentAmount)).toBe(250000)
      expect(Number(accountAfter!.balance)).toBe(250000)
    })

    it('dua deposit bersamaan yang total melebihi saldo dompet: hanya satu yang berhasil, balance tidak pernah minus', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)
      const account = await insertAccount(user.id, { balance: 100000 })
      const goal = await insertSavingsGoal(user.id, { currentAmount: 0 })

      const [resA, resB] = await Promise.all([
        app.request(`/v1/savings/${goal.id}/deposit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authCookieHeader(token) },
          body: JSON.stringify({
            accountId: account.id,
            amount: 70000,
            date: new Date().toISOString(),
          }),
        }),
        app.request(`/v1/savings/${goal.id}/deposit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authCookieHeader(token) },
          body: JSON.stringify({
            accountId: account.id,
            amount: 70000,
            date: new Date().toISOString(),
          }),
        }),
      ])

      const statuses = [resA.status, resB.status].sort()
      expect(statuses).toEqual([HttpStatusCodes.BAD_REQUEST, HttpStatusCodes.CREATED].sort())

      const accountAfter = await prisma.account.findUnique({ where: { id: account.id } })
      expect(Number(accountAfter!.balance)).toBeGreaterThanOrEqual(0)
      expect(Number(accountAfter!.balance)).toBe(30000)
    })
  })
})
