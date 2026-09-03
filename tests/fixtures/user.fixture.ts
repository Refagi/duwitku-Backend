import { faker } from '@faker-js/faker'
import { prisma } from '../setup/db-setup.js'
import { DEFAULT_CATEGORIES } from '@/utils/defaultCategories.js'

export function buildUser(
  overrides: Partial<{ name: string; email: string; password: string }> = {},
) {
  return {
    name: overrides.name ?? faker.person.fullName(),
    email: overrides.email ?? faker.internet.email({ provider: 'gmail.com' }).toLowerCase(),
    rawPassword: overrides.password ?? 'Password1!',
  }
}

export async function insertUser(overrides?: Parameters<typeof buildUser>[0]) {
  const data = buildUser(overrides)
  const hashedPassword = await Bun.password.hash(data.rawPassword, {
    algorithm: 'argon2id',
    memoryCost: 19456,
    timeCost: 2,
  })

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password: hashedPassword,
      categories: { create: DEFAULT_CATEGORIES.map((cat) => ({ ...cat, isDefault: true })) },
    },
  })

  return { user, rawPassword: data.rawPassword }
}
