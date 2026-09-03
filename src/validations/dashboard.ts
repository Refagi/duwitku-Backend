import { z } from 'zod'

export const dashboardChartQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).default(new Date().getFullYear()),
})
