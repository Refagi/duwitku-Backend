import { prisma } from '../setup/db-setup.js'

export async function insertTransfer(
  userId: string,
  fromAccountId: string,
  toAccountId: string,
  overrides: Partial<{ amount: number; date: Date; note: string }> = {},
) {
  return prisma.transfer.create({
    data: {
      userId,
      fromAccountId,
      toAccountId,
      amount: overrides.amount ?? 25000,
      date: overrides.date ?? new Date(),
      note: overrides.note,
    },
  })
}
