import type { z } from 'zod'
import type {
  createTransactionSchema,
  updateTransactionSchema,
  transactionIdParamSchema,
  transactionQuerySchema,
} from '@/validations/transaction.ts'

export type CreateTransactionBody = z.infer<typeof createTransactionSchema>
export type UpdateTransactionBody = z.infer<typeof updateTransactionSchema>
export type TransactionIdParam = z.infer<typeof transactionIdParamSchema>
export type TransactionQuery = z.infer<typeof transactionQuerySchema>
