import { afterAll } from 'bun:test'
import { execFileSync } from 'child_process'
import { join } from 'path'
import { PrismaClient } from '../../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'

const url = process.env.DATABASE_URL!
const prismaBinary = join(process.cwd(), 'node_modules', '.bin', 'prisma')

console.log('[setup] pushing schema to test db...')
execFileSync(prismaBinary, ['db', 'push', '--accept-data-loss'], {
  env: process.env,
  stdio: 'inherit',
  timeout: 30_000,
})
console.log('[setup] schema pushed')

const adapter = new PrismaPg({ connectionString: url })
export const prisma = new PrismaClient({ adapter })

afterAll(async () => {
  await prisma.$disconnect()
})
