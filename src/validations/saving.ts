import { z } from 'zod'

export const createSavingsGoalSchema = z.object({
  name: z.string().min(1, 'Nama rencana wajib diisi'),
  targetAmount: z.number().positive('Target nominal harus lebih dari 0'),
  targetDate: z.string().optional(),
  icon: z.string().optional(),
})

export const updateSavingsGoalSchema = createSavingsGoalSchema.partial()

export const savingsGoalIdParamSchema = z.object({
  id: z.string().min(1, 'Savings goal id wajib diisi'),
})

export const allocateSavingsSchema = z.object({
  accountId: z.string().min(1, 'Dompet wajib dipilih'),
  amount: z.number().positive('Nominal harus lebih dari 0'),
  date: z.string().min(1, 'Tanggal wajib diisi'),
  note: z.string().optional(),
})
