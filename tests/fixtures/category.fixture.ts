import { faker } from "@faker-js/faker";
import { prisma } from "../setup/db-setup.js";

export function buildCategory(overrides: Partial<{ name: string; type: "INCOME" | "EXPENSE"; icon: string }> = {}) {
  return {
    name: overrides.name ?? faker.commerce.department(),
    type: overrides.type ?? "EXPENSE",
    icon: overrides.icon ?? "wallet",
  };
}

export async function insertCategory(
  userId: string,
  overrides: Partial<{ name: string; type: "INCOME" | "EXPENSE"; icon: string; isDefault: boolean }> = {},
) {
  const data = buildCategory(overrides);
  return prisma.category.create({
    data: {
      userId,
      name: data.name,
      type: data.type,
      icon: data.icon,
      isDefault: overrides.isDefault ?? false,
    },
  });
}