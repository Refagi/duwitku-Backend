import * as HttpStatusCodes from 'stoker/http-status-codes'
import prisma from '@/../prisma/client.js'
import { Prisma } from '@/generated/prisma/client.js'
import { ApiError } from '@/utils/ApiError.js'
import { AccountServices } from './index.js'
import type { CreateTransferBody, UpdateTransferBody, TransferQuery } from '@/models/transfer.js'

export class TransferServices {
  static async list(userId: string, query: TransferQuery) {
    const where: Prisma.TransferWhereInput = { userId }

    if (query.accountId) {
      where.OR = [{ fromAccountId: query.accountId }, { toAccountId: query.accountId }]
    }

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
      };
    }

    if (query.q) {
      where.note = { contains: query.q, mode: 'insensitive' }
    }

    const [data, total] = await Promise.all([
      prisma.transfer.findMany({
        where,
        include: { fromAccount: true, toAccount: true },
        orderBy: { date: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.transfer.count({ where }),
    ])

    return { data, total, page: query.page, limit: query.limit }
  }

  static async getOwned(userId: string, transferId: string) {
    const transfer = await prisma.transfer.findFirst({ where: { id: transferId, userId } })

    if (!transfer) {
      throw new ApiError(HttpStatusCodes.NOT_FOUND, 'Transfer tidak ditemukan')
    }

    return transfer
  }

  static async create(userId: string, body: CreateTransferBody) {
    const fromAccount = await AccountServices.getOwned(userId, body.fromAccountId)
    await AccountServices.getOwned(userId, body.toAccountId)

    if (Number(fromAccount.balance) < body.amount) {
      throw new ApiError(HttpStatusCodes.BAD_REQUEST, 'Saldo dompet asal tidak mencukupi')
    }

    return prisma.$transaction(async (tx) => {
      const created = await tx.transfer.create({
        data: {
          userId,
          fromAccountId: body.fromAccountId,
          toAccountId: body.toAccountId,
          amount: body.amount,
          date: new Date(body.date),
          note: body.note,
        },
      })

      await tx.account.update({
        where: { id: body.fromAccountId },
        data: { balance: { decrement: body.amount } },
      })
      await tx.account.update({
        where: { id: body.toAccountId },
        data: { balance: { increment: body.amount } },
      })

      return created
    })
  }

  // Pendekatan REVERSE-LALU-APPLY: efek transfer LAMA dikembalikan dulu
  // sepenuhnya (seolah belum pernah terjadi), baru efek BARU diterapkan.
  // Ini menghindari percabangan rumit "dompet sama vs beda" seperti di
  // TransactionServices - 2 dompet di sini bisa berubah independen
  // (fromAccount saja, toAccount saja, atau dua-duanya), jadi menyeragamkan
  // jadi 4 operasi (2 reverse + 2 apply) itu lebih gampang dipastikan
  // benar daripada menghitung kombinasi kasusnya satu-satu.
  static async update(userId: string, transferId: string, body: UpdateTransferBody) {
    const existing = await this.getOwned(userId, transferId)

    if (existing.isEdited) {
      throw new ApiError(
        HttpStatusCodes.CONFLICT,
        'Transaksi ini sudah pernah diedit sebelumnya dan tidak bisa diedit lagi',
      )
    }

    if (body.fromAccountId) await AccountServices.getOwned(userId, body.fromAccountId)
    if (body.toAccountId) await AccountServices.getOwned(userId, body.toAccountId)

    const newFrom = body.fromAccountId ?? existing.fromAccountId
    const newTo = body.toAccountId ?? existing.toAccountId
    const newAmount = body.amount ?? Number(existing.amount)
    const newDate = body.date ? new Date(body.date) : existing.date

    // Cek saldo cukup SEBELUM commit apapun. Kalau newFrom sama dengan
    // dompet asal yang lama, saldo lama dompet itu masih termasuk efek
    // transfer lama (belum di-reverse), jadi tambahkan kembali dulu
    // biar perhitungan "saldo yang sebenarnya tersedia" akurat.
    const freshFromAccount = await AccountServices.getOwned(userId, newFrom)
    const availableBalance =
      newFrom === existing.fromAccountId
        ? Number(freshFromAccount.balance) + Number(existing.amount)
        : Number(freshFromAccount.balance)

    if (availableBalance < newAmount) {
      throw new ApiError(HttpStatusCodes.BAD_REQUEST, 'Saldo dompet asal tidak mencukupi')
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.transfer.update({
        where: { id: transferId },
        data: {
          fromAccountId: newFrom,
          toAccountId: newTo,
          amount: newAmount,
          date: newDate,
          note: body.note,
          isEdited: true,
        },
      })

      // Reverse efek lama
      await tx.account.update({
        where: { id: existing.fromAccountId },
        data: { balance: { increment: Number(existing.amount) } },
      })
      await tx.account.update({
        where: { id: existing.toAccountId },
        data: { balance: { decrement: Number(existing.amount) } },
      })

      // Terapkan efek baru
      await tx.account.update({
        where: { id: newFrom },
        data: { balance: { decrement: newAmount } },
      })
      await tx.account.update({
        where: { id: newTo },
        data: { balance: { increment: newAmount } },
      })

      return updated
    })
  }

  static async remove(userId: string, transferId: string) {
    const existing = await this.getOwned(userId, transferId)

    await prisma.$transaction(async (tx) => {
      await tx.transfer.delete({ where: { id: transferId } })
      await tx.account.update({
        where: { id: existing.fromAccountId },
        data: { balance: { increment: Number(existing.amount) } },
      })
      await tx.account.update({
        where: { id: existing.toAccountId },
        data: { balance: { decrement: Number(existing.amount) } },
      })
    })
  }
}

export default TransferServices
