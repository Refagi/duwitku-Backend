import * as HttpStatusCodes from 'stoker/http-status-codes';
import prisma from '@/../prisma/client.js';
import { ApiError } from "@/utils/ApiError.js";
import { AccountServices } from "./index.js";
import type {
  CreateSavingsGoalBody, UpdateSavingsGoalBody, AllocateSavingsBody,
} from "../models/saving.js";

export class SavingServices {
  static async list(userId: string) {
    return prisma.savingsGoal.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  }

  static async getOwned(userId: string, id: string) {
    const goal = await prisma.savingsGoal.findFirst({ where: { id, userId } });
    if (!goal) throw new ApiError(HttpStatusCodes.NOT_FOUND, "Rencana tabungan tidak ditemukan");
    return goal;
  }

  static async getDetail(userId: string, id: string) {
    const goal = await this.getOwned(userId, id);
    const allocations = await prisma.savingsAllocation.findMany({
      where: { savingsGoalId: id },
      include: { account: true },
      orderBy: { date: "desc" },
    });
    return { goal, allocations };
  }

  static async create(userId: string, body: CreateSavingsGoalBody) {
    return prisma.savingsGoal.create({
      data: {
        userId,
        name: body.name,
        targetAmount: body.targetAmount,
        icon: body.icon,
        targetDate: body.targetDate ? new Date(body.targetDate) : undefined,
      },
    });
  }

  static async update(userId: string, id: string, body: UpdateSavingsGoalBody) {
    await this.getOwned(userId, id);
    return prisma.savingsGoal.update({
      where: { id },
      data: {
        ...body,
        targetDate: body.targetDate ? new Date(body.targetDate) : undefined,
      },
    });
  }

  static async remove(userId: string, id: string) {
    const goal = await this.getOwned(userId, id);

    if (Number(goal.currentAmount) > 0) {
      throw new ApiError(
        HttpStatusCodes.CONFLICT,
        "Tarik dulu semua dana yang tersimpan sebelum menghapus rencana ini",
      );
    }

    await prisma.savingsGoal.delete({ where: { id } });
  }

  static async deposit(userId: string, savingsGoalId: string, body: AllocateSavingsBody) {
    await this.getOwned(userId, savingsGoalId);
    await AccountServices.getOwned(userId, body.accountId);

    return prisma.$transaction(async (tx) => {
      const accountUpdate = await tx.account.updateMany({
        where: { id: body.accountId, balance: { gte: body.amount } },
        data: { balance: { decrement: body.amount } },
      });

      if (accountUpdate.count === 0) {
        throw new ApiError(HttpStatusCodes.BAD_REQUEST, "Saldo dompet tidak mencukupi");
      }

      const allocation = await tx.savingsAllocation.create({
        data: {
          userId,
          savingsGoalId,
          accountId: body.accountId,
          type: "DEPOSIT",
          amount: body.amount,
          date: new Date(body.date),
          note: body.note,
        },
      });
      await tx.savingsGoal.update({ where: { id: savingsGoalId }, data: { currentAmount: { increment: body.amount } } });
      return allocation;
    });
  }

  static async withdraw(userId: string, savingsGoalId: string, body: AllocateSavingsBody) {
    const goal = await this.getOwned(userId, savingsGoalId);
    await AccountServices.getOwned(userId, body.accountId);

    return prisma.$transaction(async (tx) => {
      const goalUpdate = await tx.savingsGoal.updateMany({
        where: { id: savingsGoalId, userId, currentAmount: { gte: body.amount } },
        data: { currentAmount: { decrement: body.amount } },
      });

      if(goalUpdate.count === 0){
        const goal = await tx.savingsGoal.findFirst({ where: { id: savingsGoalId, userId } });
        if (!goal) {
          throw new ApiError(HttpStatusCodes.NOT_FOUND, "Rencana tabungan tidak ditemukan");
        }
          throw new ApiError(
          HttpStatusCodes.BAD_REQUEST,
          "Dana tersimpan tidak mencukupi untuk ditarik sebesar itu",
        );
      }

      const allocation = await tx.savingsAllocation.create({
        data: {
          userId,
          savingsGoalId,
          accountId: body.accountId,
          type: "WITHDRAW",
          amount: body.amount,
          date: new Date(body.date),
          note: body.note,
        },
      });
      await tx.account.update({ where: { id: body.accountId }, data: { balance: { increment: body.amount } } });
      return allocation;
    });
  }
}

export default SavingServices;