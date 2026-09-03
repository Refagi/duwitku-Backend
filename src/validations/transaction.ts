import { z } from 'zod'

export const createTransactionSchema = z.object({
  accountId: z.string().min(1, 'Dompet wajib dipilih'),
  categoryId: z.string().min(1, 'Kategori wajib dipilih'),
  type: z.enum(['INCOME', 'EXPENSE']),
  amount: z.number().positive('Nominal harus lebih dari 0'),
  date: z.string(),
  note: z.string().optional(),
  attachmentUrl: z.string().url().optional(),
})

export const updateTransactionSchema = createTransactionSchema.partial()

export const transactionIdParamSchema = z.object({
  id: z.string().min(1, 'Transaction id wajib diisi'),
})

export const transactionQuerySchema = z.object({
  accountId: z.string().optional(),
  categoryId: z.string().optional(),
  type: z.enum(['INCOME', 'EXPENSE']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  minAmount: z.coerce.number().optional(),
  maxAmount: z.coerce.number().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})
