import { beforeEach } from "bun:test";
import { prisma } from "./db-setup.js";

export function withCleanDb() {
  beforeEach(async () => {
    await prisma.$transaction([
      prisma.token.deleteMany(),
      prisma.transaction.deleteMany(),
      prisma.transfer.deleteMany(),
      prisma.savingsGoal.deleteMany(),
      prisma.account.deleteMany(),
      prisma.category.deleteMany(),
      prisma.user.deleteMany(),
    ]);
  });
}