import { prisma } from '../setup/db-setup.js'

export async function insertTransaction(
  userId: string,
  accountId: string,
  categoryId: string,
  overrides: Partial<{
    type: 'INCOME' | 'EXPENSE'
    amount: number
    date: Date
    note: string
  }> = {},
) {
  return prisma.transaction.create({
    data: {
      userId,
      accountId,
      categoryId,
      type: overrides.type ?? 'EXPENSE',
      amount: overrides.amount ?? 50000,
      date: overrides.date ?? new Date(),
      note: overrides.note,
    },
  })
}
