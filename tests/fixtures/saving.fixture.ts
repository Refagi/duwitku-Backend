import { faker } from "@faker-js/faker";
import { prisma } from "../setup/db-setup.js";

export async function insertSavingsGoal(
  userId: string,
  overrides: Partial<{ name: string; targetAmount: number; currentAmount: number; targetDate: Date; icon: string }> = {},
) {
  return prisma.savingsGoal.create({
    data: {
      userId,
      name: overrides.name ?? faker.commerce.productName(),
      targetAmount: overrides.targetAmount ?? 1000000,
      currentAmount: overrides.currentAmount ?? 0,
      targetDate: overrides.targetDate,
      icon: overrides.icon,
    },
  });
}