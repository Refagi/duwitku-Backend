import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client.js'

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
})

const prismaCLientSingleton = () => {
  return new PrismaClient({ adapter })
}

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaCLientSingleton>;
} & typeof global;
const prisma = globalThis.prismaGlobal ?? prismaCLientSingleton();

export default prisma
if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma;
