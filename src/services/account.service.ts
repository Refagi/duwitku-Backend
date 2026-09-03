import * as HttpStatusCodes from 'stoker/http-status-codes'
import prisma from '@/../prisma/client.js';
import { ApiError } from "@/utils/ApiError.js";
import type { CreateAccountBody, UpdateAccountBody } from "@/models/account.js";

export class AccountServices {
  static async list(userId: string) {
    return prisma.account.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
  }

  static async create(userId: string, body: CreateAccountBody) {
    return prisma.account.create({
      data: { ...body, userId },
    });
  }
  
  static async getOwned(userId: string, accountId: string) {
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId },
    });

    if (!account) {
      throw new ApiError(HttpStatusCodes.NOT_FOUND, "Dompet tidak ditemukan");
    }

    return account;
  }

  static async update(userId: string, accountId: string, body: UpdateAccountBody) {
    await this.getOwned(userId, accountId);

    return prisma.account.update({
      where: { id: accountId },
      data: body,
    });
  }

  static async remove(userId: string, accountId: string) {
    await this.getOwned(userId, accountId);

    const txCount = await prisma.transaction.count({ where: { accountId } });
    if (txCount > 0) {
      throw new ApiError(
        HttpStatusCodes.CONFLICT,
        "Tidak bisa menghapus dompet yang masih punya riwayat transaksi",
      );
    }

    const transferCount = await prisma.transfer.count({
      where: { OR: [{ fromAccountId: accountId }, { toAccountId: accountId }] },
    });
    if (transferCount > 0) {
      throw new ApiError(
        HttpStatusCodes.CONFLICT,
        "Tidak bisa menghapus dompet yang masih punya riwayat transfer",
      );
    }

    await prisma.account.delete({ where: { id: accountId } });
  }
}

export default AccountServices;