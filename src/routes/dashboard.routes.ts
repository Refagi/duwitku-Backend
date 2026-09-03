import { Hono } from 'hono'
import { auth } from '@/middlewares/auth.js'
import { validateMiddlewares } from '@/middlewares/validate.js'
import { dashboardChartQuerySchema } from '@/validations/dashboard.js'
import { DashboardController } from '@/controllers/index.js'

// const dashboardRoute = new Hono<{ Variables: { userId: string } }>();

// dashboardRoute.use("*", authMiddleware);

const dashboardRoute = new Hono()
dashboardRoute.get('/summary', auth(), DashboardController.summary)

dashboardRoute.get(
  '/chart',
  auth(),
  validateMiddlewares.validateQuery(dashboardChartQuerySchema),
  DashboardController.chart,
)

export default dashboardRoute
