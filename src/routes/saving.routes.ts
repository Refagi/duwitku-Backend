import { Hono } from 'hono'
import { auth } from '@/middlewares/auth.js'
import { validateMiddlewares } from '@/middlewares/validate.js'
import {
  createSavingsGoalSchema,
  updateSavingsGoalSchema,
  savingsGoalIdParamSchema,
  allocateSavingsSchema,
} from '@/validations/saving.js'
import { SavingController } from '@/controllers/index.js'

const savingsGoalRoute = new Hono()

savingsGoalRoute.get('/', auth(), SavingController.list)
savingsGoalRoute.get(
  '/:id',
  auth(),
  validateMiddlewares.validateParam(savingsGoalIdParamSchema),
  SavingController.detail,
)
savingsGoalRoute.post(
  '/',
  auth(),
  validateMiddlewares.validateJson(createSavingsGoalSchema),
  SavingController.create,
)
savingsGoalRoute.put(
  '/:id',
  auth(),
  validateMiddlewares.validateParam(savingsGoalIdParamSchema),
  validateMiddlewares.validateJson(updateSavingsGoalSchema),
  SavingController.update,
)
savingsGoalRoute.delete(
  '/:id',
  auth(),
  validateMiddlewares.validateParam(savingsGoalIdParamSchema),
  SavingController.remove,
)

savingsGoalRoute.post(
  '/:id/deposit',
  auth(),
  validateMiddlewares.validateParam(savingsGoalIdParamSchema),
  validateMiddlewares.validateJson(allocateSavingsSchema),
  SavingController.deposit,
)
savingsGoalRoute.post(
  '/:id/withdraw',
  auth(),
  validateMiddlewares.validateParam(savingsGoalIdParamSchema),
  validateMiddlewares.validateJson(allocateSavingsSchema),
  SavingController.withdraw,
)

export default savingsGoalRoute
