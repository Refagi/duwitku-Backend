import type { z } from 'zod'
import type {
  createTransferSchema,
  updateTransferSchema,
  transferIdParamSchema,
  transferQuerySchema,
} from '@/validations/transfer.js'

export type CreateTransferBody = z.infer<typeof createTransferSchema>
export type UpdateTransferBody = z.infer<typeof updateTransferSchema>
export type TransferIdParam = z.infer<typeof transferIdParamSchema>
export type TransferQuery = z.infer<typeof transferQuerySchema>
