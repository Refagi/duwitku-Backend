import { describe, it, expect } from 'bun:test'
import app from '@/app.js'
import { withCleanDb } from '../setup/reset-db.js'
import { insertUser } from '../fixtures/user.fixture.js'
import { insertAccount } from '../fixtures/account.fixture.js'
import { insertCategory } from '../fixtures/category.fixture.js'
import { insertTransaction } from '../fixtures/transaction.fixture.js'
import { getAccessToken, authCookieHeader } from '../fixtures/auth.fixture.js'
import * as HttpStatusCodes from 'stoker/http-status-codes'

describe('Report routes', () => {
  withCleanDb()

  describe('GET /v1/reports/summary', () => {
    it('401 tanpa token', async () => {
      const res = await app.request('/v1/reports/summary?from=2025-03-01&to=2025-03-10')
      expect(res.status).toBe(HttpStatusCodes.UNAUTHORIZED)
    })

    it('400 jika from/to tidak dikirim', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)

      const res = await app.request('/v1/reports/summary', { headers: authCookieHeader(token) })
      expect(res.status).toBe(HttpStatusCodes.BAD_REQUEST)
    })

    it('200 income/expense hanya menghitung transaksi dalam rentang from-to', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)
      const account = await insertAccount(user.id)
      const category = await insertCategory(user.id)

      await insertTransaction(user.id, account.id, category.id, {
        type: 'INCOME',
        amount: 500000,
        date: new Date('2026-03-05'),
      })
      await insertTransaction(user.id, account.id, category.id, {
        type: 'EXPENSE',
        amount: 200000,
        date: new Date('2026-03-06'),
      })
      await insertTransaction(user.id, account.id, category.id, {
        type: 'INCOME',
        amount: 9999999,
        date: new Date('2026-04-15'),
      })

      const res = await app.request('/v1/reports/summary?from=2026-03-01&to=2026-03-10', {
        headers: authCookieHeader(token),
      })

      expect(res.status).toBe(HttpStatusCodes.OK)
      const body = await res.json()
      expect(body.data.income).toBe(500000)
      expect(body.data.expense).toBe(200000)
      expect(body.data.cashFlow).toBe(300000)
    })

    it('200 incomeTrend null jika periode sebelumnya tidak ada transaksi income', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)
      const account = await insertAccount(user.id)
      const category = await insertCategory(user.id)

      await insertTransaction(user.id, account.id, category.id, {
        type: 'INCOME',
        amount: 500000,
        date: new Date('2026-03-05'),
      })

      const res = await app.request('/v1/reports/summary?from=2026-03-01&to=2026-03-10', {
        headers: authCookieHeader(token),
      })

      const body = await res.json()
      expect(body.data.incomeTrend).toBeNull()
    })

    it('200 incomeTrend/expenseTrend terhitung benar terhadap periode sebelumnya', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)
      const account = await insertAccount(user.id)
      const category = await insertCategory(user.id)

      await insertTransaction(user.id, account.id, category.id, {
        type: 'INCOME',
        amount: 600000,
        date: new Date('2026-03-05'),
      })
      await insertTransaction(user.id, account.id, category.id, {
        type: 'EXPENSE',
        amount: 300000,
        date: new Date('2026-03-06'),
      })

      await insertTransaction(user.id, account.id, category.id, {
        type: 'INCOME',
        amount: 300000,
        date: new Date('2026-02-20'),
      })
      await insertTransaction(user.id, account.id, category.id, {
        type: 'EXPENSE',
        amount: 200000,
        date: new Date('2026-02-20'),
      })

      const res = await app.request('/v1/reports/summary?from=2026-03-01&to=2026-03-10', {
        headers: authCookieHeader(token),
      })

      const body = await res.json()
      expect(body.data.incomeTrend).toBeCloseTo(100, 5)
      expect(body.data.expenseTrend).toBeCloseTo(50, 5)
    })

    it('200 categoryBreakdown persentase dihitung benar dan total mendekati 100%', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)
      const account = await insertAccount(user.id)
      const makan = await insertCategory(user.id, { name: 'Makan', type: 'EXPENSE' })
      const transport = await insertCategory(user.id, { name: 'Transport', type: 'EXPENSE' })

      await insertTransaction(user.id, account.id, makan.id, {
        type: 'EXPENSE',
        amount: 300000,
        date: new Date('2026-03-05'),
      })
      await insertTransaction(user.id, account.id, transport.id, {
        type: 'EXPENSE',
        amount: 100000,
        date: new Date('2026-03-06'),
      })

      const res = await app.request('/v1/reports/summary?from=2026-03-01&to=2026-03-10', {
        headers: authCookieHeader(token),
      })

      const body = await res.json()
      const makanBreakdown = body.data.categoryBreakdown.find(
        (b: any) => b.categoryName === 'Makan',
      )
      const transportBreakdown = body.data.categoryBreakdown.find(
        (b: any) => b.categoryName === 'Transport',
      )

      expect(makanBreakdown.total).toBe(300000)
      expect(makanBreakdown.percentage).toBeCloseTo(75, 5)
      expect(transportBreakdown.percentage).toBeCloseTo(25, 5)

      const totalPercentage = body.data.categoryBreakdown.reduce(
        (sum: number, b: any) => sum + b.percentage,
        0,
      )
      expect(totalPercentage).toBeCloseTo(100, 5)
    })

    it('200 categoryBreakdown urut total tertinggi ke terendah', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)
      const account = await insertAccount(user.id)
      const kecil = await insertCategory(user.id, { name: 'Kecil', type: 'EXPENSE' })
      const besar = await insertCategory(user.id, { name: 'Besar', type: 'EXPENSE' })

      await insertTransaction(user.id, account.id, kecil.id, {
        type: 'EXPENSE',
        amount: 50000,
        date: new Date('2026-03-05'),
      })
      await insertTransaction(user.id, account.id, besar.id, {
        type: 'EXPENSE',
        amount: 500000,
        date: new Date('2026-03-06'),
      })

      const res = await app.request('/v1/reports/summary?from=2026-03-01&to=2026-03-10', {
        headers: authCookieHeader(token),
      })

      const body = await res.json()
      expect(body.data.categoryBreakdown[0].categoryName).toBe('Besar')
      expect(body.data.categoryBreakdown[1].categoryName).toBe('Kecil')
    })

    it('200 chart di-bucket per HARI (YYYY-MM-DD) untuk rentang <= 31 hari', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)
      const account = await insertAccount(user.id)
      const category = await insertCategory(user.id)

      await insertTransaction(user.id, account.id, category.id, {
        type: 'INCOME',
        amount: 100000,
        date: new Date('2026-03-05'),
      })
      await insertTransaction(user.id, account.id, category.id, {
        type: 'EXPENSE',
        amount: 40000,
        date: new Date('2026-03-05'),
      })
      await insertTransaction(user.id, account.id, category.id, {
        type: 'INCOME',
        amount: 60000,
        date: new Date('2026-03-08'),
      })

      const res = await app.request('/v1/reports/summary?from=2026-03-01&to=2026-03-10', {
        headers: authCookieHeader(token),
      })

      const body = await res.json()
      expect(body.data.chart.length).toBe(2)
      const day5 = body.data.chart.find((c: any) => c.label === '2026-03-05')
      expect(day5).toMatchObject({ income: 100000, expense: 40000 })
      expect(body.data.chart.map((c: any) => c.label)).toEqual(
        [...body.data.chart.map((c: any) => c.label)].sort(),
      )
    })

    it('200 chart di-bucket per BULAN (YYYY-MM) untuk rentang > 31 hari', async () => {
      const { user } = await insertUser()
      const token = await getAccessToken(user.id)
      const account = await insertAccount(user.id)
      const category = await insertCategory(user.id)

      await insertTransaction(user.id, account.id, category.id, {
        type: 'INCOME',
        amount: 100000,
        date: new Date('2026-01-15'),
      })
      await insertTransaction(user.id, account.id, category.id, {
        type: 'INCOME',
        amount: 50000,
        date: new Date('2026-01-20'),
      })
      await insertTransaction(user.id, account.id, category.id, {
        type: 'EXPENSE',
        amount: 30000,
        date: new Date('2026-06-10'),
      })

      const res = await app.request('/v1/reports/summary?from=2026-01-01&to=2026-12-31', {
        headers: authCookieHeader(token),
      })

      const body = await res.json()
      const jan = body.data.chart.find((c: any) => c.label === '2026-01')
      const jun = body.data.chart.find((c: any) => c.label === '2026-06')
      expect(jan.income).toBe(150000)
      expect(jun.expense).toBe(30000)
    })

    it('200 dan tidak terpengaruh data user lain sama sekali (isolasi penuh)', async () => {
      const { user } = await insertUser()
      const { user: otherUser } = await insertUser()
      const token = await getAccessToken(user.id)

      const otherAccount = await insertAccount(otherUser.id)
      const otherCategory = await insertCategory(otherUser.id)
      await insertTransaction(otherUser.id, otherAccount.id, otherCategory.id, {
        type: 'INCOME',
        amount: 1000000,
        date: new Date('2026-03-05'),
      })

      const res = await app.request('/v1/reports/summary?from=2026-03-01&to=2026-03-10', {
        headers: authCookieHeader(token),
      })

      const body = await res.json()
      expect(body.data.income).toBe(0)
      expect(body.data.expense).toBe(0)
      expect(body.data.categoryBreakdown).toEqual([])
      expect(body.data.chart).toEqual([])
    })
  })
})
