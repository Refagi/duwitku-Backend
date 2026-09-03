import * as HttpStatusCodes from 'stoker/http-status-codes'
import prisma from '@/../prisma/client.js'
import { ApiError } from '@/utils/ApiError.js'
import { AccountServices } from './index.js'
import { CategoryServices } from './index.js'
import type {
  CreateTransactionBody,
  UpdateTransactionBody,
  TransactionQuery,
} from '@/models/transaction.js'
import { Prisma } from '@/generated/prisma/client.js'

export class TransactionServices {
  static async list(userId: string, query: TransactionQuery) {
    const where: Prisma.TransactionWhereInput = { userId }

    if (query.accountId) where.accountId = query.accountId
    if (query.categoryId) where.categoryId = query.categoryId
    if (query.type) where.type = query.type

    if (query.from || query.to) {
      where.date = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      }
    }

    if (query.minAmount !== undefined || query.maxAmount !== undefined) {
      where.amount = {
        ...(query.minAmount !== undefined ? { gte: query.minAmount } : {}),
        ...(query.maxAmount !== undefined ? { lte: query.maxAmount } : {}),
      }
    }

    if (query.q) {
      where.note = { contains: query.q, mode: 'insensitive' }
    }

    const [data, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: { account: true, category: true },
        orderBy: { date: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.transaction.count({ where }),
    ])

    return { data, total, page: query.page, limit: query.limit }
  }

  static async getOwned(userId: string, transactionId: string) {
    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, userId },
    })

    if (!transaction) {
      throw new ApiError(HttpStatusCodes.NOT_FOUND, 'Transaksi tidak ditemukan')
    }

    return transaction
  }

  static async create(userId: string, body: CreateTransactionBody) {
    await AccountServices.getOwned(userId, body.accountId)
    await CategoryServices.getOwned(userId, body.categoryId)

    const balanceDelta = body.type === 'INCOME' ? body.amount : -body.amount

    return prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          userId,
          accountId: body.accountId,
          categoryId: body.categoryId,
          type: body.type,
          amount: body.amount,
          date: new Date(body.date),
          note: body.note,
          attachmentUrl: body.attachmentUrl,
        },
      })

      await tx.account.update({
        where: { id: body.accountId },
        data: { balance: { increment: balanceDelta } },
      })

      return created
    })
  }
  static async update(userId: string, transactionId: string, body: UpdateTransactionBody) {
    const existing = await this.getOwned(userId, transactionId)
    if (existing.isEdited) {
      throw new ApiError(
        HttpStatusCodes.CONFLICT,
        'Transaksi ini sudah pernah diedit sebelumnya dan tidak bisa diedit lagi',
      )
    }

    if (body.accountId) await AccountServices.getOwned(userId, body.accountId)
    if (body.categoryId) await CategoryServices.getOwned(userId, body.categoryId)

    const newAccountId = body.accountId ?? existing.accountId
    const newCategoryId = body.categoryId ?? existing.categoryId
    const newType = body.type ?? existing.type
    const newAmount = body.amount ?? Number(existing.amount)
    const newDate = body.date ? new Date(body.date) : existing.date

    const oldDelta = existing.type === 'INCOME' ? Number(existing.amount) : -Number(existing.amount)
    const newDelta = newType === 'INCOME' ? newAmount : -newAmount

    return prisma.$transaction(async (tx) => {
      const updated = await tx.transaction.update({
        where: { id: transactionId },
        data: {
          accountId: newAccountId,
          categoryId: newCategoryId,
          type: newType,
          amount: newAmount,
          date: newDate,
          note: body.note,
          attachmentUrl: body.attachmentUrl,
          isEdited: true,
        },
      })

      if (existing.accountId === newAccountId) {
        // Dompet sama =  terapkan selisihnya saja (net delta)
        await tx.account.update({
          where: { id: newAccountId },
          data: { balance: { increment: newDelta - oldDelta } },
        })
      } else {
        // Dompet beda = reverse efek lama dari dompet lama,
        // terapkan efek baru ke dompet baru
        await tx.account.update({
          where: { id: existing.accountId },
          data: { balance: { decrement: oldDelta } },
        })
        await tx.account.update({
          where: { id: newAccountId },
          data: { balance: { increment: newDelta } },
        })
      }

      return updated
    })
  }

  static async remove(userId: string, transactionId: string) {
    const existing = await this.getOwned(userId, transactionId)

    const reverseDelta =
      existing.type === 'INCOME' ? -Number(existing.amount) : Number(existing.amount)

    await prisma.$transaction(async (tx) => {
      await tx.transaction.delete({ where: { id: transactionId } })
      await tx.account.update({
        where: { id: existing.accountId },
        data: { balance: { increment: reverseDelta } },
      })
    })
  }
}

export default TransactionServices
