import prisma from '@/../prisma/client.js';
import type { ReportQuery } from "@/models/report.js";

function daysBetween(from: Date, to: Date) {
  return Math.ceil((to.getTime() - from.getTime()) / 86_400_000);
}

export class ReportServices {
  static async summary(userId: string, query: ReportQuery) {
    const from = new Date(query.from);
    const to = new Date(query.to);
    to.setHours(23, 59, 59, 999);

    const rangeDays = daysBetween(from, to);
    const prevTo = new Date(from.getTime() - 1);
    const prevFrom = new Date(prevTo.getTime() - rangeDays * 86_400_000);

    const [incomeAgg, expenseAgg, prevIncomeAgg, prevExpenseAgg, expenseByCategory, transactions] = await Promise.all([
      prisma.transaction.aggregate({ where: { userId, type: "INCOME", date: { gte: from, lte: to } }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { userId, type: "EXPENSE", date: { gte: from, lte: to } }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { userId, type: "INCOME", date: { gte: prevFrom, lte: prevTo } }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { userId, type: "EXPENSE", date: { gte: prevFrom, lte: prevTo } }, _sum: { amount: true } }),
      prisma.transaction.groupBy({
        by: ["categoryId"],
        where: { userId, type: "EXPENSE", date: { gte: from, lte: to } },
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
      }),
      prisma.transaction.findMany({
        where: { userId, date: { gte: from, lte: to } },
        select: { type: true, amount: true, date: true },
      }),
    ]);

    const income = Number(incomeAgg._sum.amount ?? 0);
    const expense = Number(expenseAgg._sum.amount ?? 0);
    const prevIncome = Number(prevIncomeAgg._sum.amount ?? 0);
    const prevExpense = Number(prevExpenseAgg._sum.amount ?? 0);

    const incomeTrend = prevIncome > 0 ? ((income - prevIncome) / prevIncome) * 100 : null;
    const expenseTrend = prevExpense > 0 ? ((expense - prevExpense) / prevExpense) * 100 : null;

    const categoryIds = expenseByCategory.map((g) => g.categoryId);
    const categories = await prisma.category.findMany({ where: { id: { in: categoryIds } } });

    const categoryBreakdown = expenseByCategory.map((g) => {
      const total = Number(g._sum.amount ?? 0);
      return {
        categoryId: g.categoryId,
        categoryName: categories.find((c) => c.id === g.categoryId)?.name ?? "Tidak diketahui",
        total,
        percentage: expense > 0 ? (total / expense) * 100 : 0,
      };
    });

    const bucketByDay = rangeDays <= 31;
    const buckets = new Map<string, { income: number; expense: number }>();
    for (const t of transactions) {
      const key = bucketByDay
        ? t.date.toISOString().slice(0, 10)
        : `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, "0")}`;
      if (!buckets.has(key)) buckets.set(key, { income: 0, expense: 0 });
      const b = buckets.get(key)!;
      if (t.type === "INCOME") b.income += Number(t.amount);
      else b.expense += Number(t.amount);
    }
    const chart = Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, v]) => ({ label, ...v }));

    return { income, expense, cashFlow: income - expense, incomeTrend, expenseTrend, categoryBreakdown, chart };
  }
}

export default ReportServices;