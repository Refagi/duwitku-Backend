import { Hono } from "hono";
import { auth } from "@/middlewares/auth.js";
import { validateMiddlewares } from "@/middlewares/validate.js";
import {
  createTransactionSchema,
  updateTransactionSchema,
  transactionIdParamSchema,
  transactionQuerySchema,
} from "@/validations/transaction.js";
import { TransactionController } from "@/controllers/index.js";

const transactionRoute = new Hono();

transactionRoute.get(
  "/",
  auth(),
  validateMiddlewares.validateQuery(transactionQuerySchema),
  TransactionController.list,
);

transactionRoute.post(
  "/",
  auth(),
  validateMiddlewares.validateJson(createTransactionSchema),
  TransactionController.create,
);

transactionRoute.put(
  "/:id",
  auth(),
  validateMiddlewares.validateParam(transactionIdParamSchema),
  validateMiddlewares.validateJson(updateTransactionSchema),
  TransactionController.update,
);

transactionRoute.delete(
  "/:id",
  auth(),
  validateMiddlewares.validateParam(transactionIdParamSchema),
  TransactionController.remove,
);

export default transactionRoute;