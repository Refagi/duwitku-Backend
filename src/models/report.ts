import type { z } from 'zod'
import type { reportQuerySchema } from '@/validations/report.js'
export type ReportQuery = z.infer<typeof reportQuerySchema>
