import { faker } from '@faker-js/faker'
import { prisma } from '../setup/db-setup.js'

export function buildAccount(
  overrides: Partial<{ name: string; type: 'CASH' | 'BANK' | 'EWALLET'; balance: number }> = {},
) {
  return {
    name: overrides.name ?? faker.finance.accountName(),
    type: overrides.type ?? 'CASH',
    balance: overrides.balance ?? 0,
  }
}

export async function insertAccount(
  userId: string,
  overrides?: Parameters<typeof buildAccount>[0],
) {
  const data = buildAccount(overrides)
  return prisma.account.create({
    data: { userId, name: data.name, type: data.type, balance: data.balance },
  })
}
