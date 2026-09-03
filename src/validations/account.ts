import { z } from 'zod'

export const createAccountSchema = z.object({
  name: z.string().min(1, 'Nama dompet wajib diisi'),
  type: z.enum(['CASH', 'BANK', 'EWALLET']),
  balance: z.number().default(0),
})

export const updateAccountSchema = createAccountSchema.partial()

export const accountIdParamSchema = z.object({
  id: z.string().min(1, 'Account id wajib diisi'),
})
