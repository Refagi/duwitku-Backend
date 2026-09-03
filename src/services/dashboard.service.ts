import prisma from '@/../prisma/client.js';
import { AccountServices } from "./index.js";
import type { DashboardChartQuery } from "@/models/dashboard.js";

export class DashboardServices {
  static async summary(userId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const accounts = await AccountServices.list(userId);
    const totalBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);

    const [incomeAgg, expenseAgg, topExpenseGroups, recentTransactions] = await Promise.all([
      prisma.transaction.aggregate({
        where: { userId, type: "INCOME", date: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { userId, type: "EXPENSE", date: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amount: true },
      }),
      prisma.transaction.groupBy({
        by: ["categoryId"],
        where: { userId, type: "EXPENSE", date: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
        take: 5,
      }),
      prisma.transaction.findMany({
        where: { userId },
        include: { account: true, category: true },
        orderBy: { date: "desc" },
        take: 5,
      }),
    ]);

    const income = Number(incomeAgg._sum.amount ?? 0);
    const expense = Number(expenseAgg._sum.amount ?? 0);

    const categoryIds = topExpenseGroups.map((g) => g.categoryId);
    const categories = await prisma.category.findMany({ where: { id: { in: categoryIds } } });

    const topExpenses = topExpenseGroups.map((g) => ({
      categoryId: g.categoryId,
      categoryName: categories.find((c) => c.id === g.categoryId)?.name ?? "Tidak diketahui",
      total: Number(g._sum.amount ?? 0),
    }));

    return {
      totalBalance,
      income,
      expense,
      cashFlow: income - expense,
      topExpenses,
      recentTransactions,
    };
  }

  static async chart(userId: string, query: DashboardChartQuery) {
    const { year } = query;

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        date: {
          gte: new Date(`${year}-01-01`),
          lte: new Date(`${year}-12-31T23:59:59`),
        },
      },
      select: { type: true, amount: true, date: true },
    });

    const monthly = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      income: 0,
      expense: 0,
    }));

    for (const t of transactions) {
      const monthIndex = t.date.getMonth();
      if (t.type === "INCOME") {
        monthly[monthIndex].income += Number(t.amount);
      } else {
        monthly[monthIndex].expense += Number(t.amount);
      }
    }

    return { year, data: monthly };
  }
}

export default DashboardServices;