import { Hono } from 'hono'
import { auth } from '@/middlewares/auth.js'
import { validateMiddlewares } from '@/middlewares/validate.js'
import { reportQuerySchema } from '@/validations/report.js'
import { ReportController } from '@/controllers/index.js'

const reportRoute = new Hono()
reportRoute.get(
  '/summary',
  auth(),
  validateMiddlewares.validateQuery(reportQuerySchema),
  ReportController.summary,
)
export default reportRoute
