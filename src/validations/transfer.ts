import { z } from 'zod'

const transferBaseSchema = z.object({
  fromAccountId: z.string().min(1, 'Dompet asal wajib dipilih'),
  toAccountId: z.string().min(1, 'Dompet tujuan wajib dipilih'),
  amount: z.number().positive('Nominal harus lebih dari 0'),
  date: z.string(),
  note: z.string().optional(),
})

export const createTransferSchema = transferBaseSchema.refine(
  (d) => d.fromAccountId !== d.toAccountId,
  { message: 'Dompet asal dan tujuan tidak boleh sama', path: ['toAccountId'] },
)

export const updateTransferSchema = transferBaseSchema
  .partial()
  .refine((d) => !d.fromAccountId || !d.toAccountId || d.fromAccountId !== d.toAccountId, {
    message: 'Dompet asal dan tujuan tidak boleh sama',
    path: ['toAccountId'],
  })

export const transferIdParamSchema = z.object({
  id: z.string().min(1, 'Transfer id wajib diisi'),
})

export const transferQuerySchema = z.object({
  accountId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  minAmount: z.coerce.number().optional(),
  maxAmount: z.coerce.number().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})
