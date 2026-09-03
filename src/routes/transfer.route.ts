import { Hono } from 'hono'
import { auth } from '@/middlewares/auth.js'
import { validateMiddlewares } from '@/middlewares/validate.js'
import {
  createTransferSchema,
  updateTransferSchema,
  transferIdParamSchema,
  transferQuerySchema,
} from '@/validations/transfer.js'
import { TransferController } from '@/controllers/index.js'

const transferRoute = new Hono()

transferRoute.get(
  '/',
  auth(),
  validateMiddlewares.validateQuery(transferQuerySchema),
  TransferController.list,
)

transferRoute.post(
  '/',
  auth(),
  validateMiddlewares.validateJson(createTransferSchema),
  TransferController.create,
)

transferRoute.put(
  '/:id',
  auth(),
  validateMiddlewares.validateParam(transferIdParamSchema),
  validateMiddlewares.validateJson(updateTransferSchema),
  TransferController.update,
)

transferRoute.delete(
  '/:id',
  auth(),
  validateMiddlewares.validateParam(transferIdParamSchema),
  TransferController.remove,
)

export default transferRoute
