import { Hono } from "hono";
import { auth } from "@/middlewares/auth.js";
import { validateMiddlewares } from "@/middlewares/validate.js";
import {
  createAccountSchema,
  updateAccountSchema,
  accountIdParamSchema,
} from "@/validations/account.js";
import { AccountController } from "@/controllers/index.js";

// const accountRoute = new Hono<{ Variables: { userId: string } }>();
// accountRoute.use("*", auth());
const accountRoute = new Hono();
accountRoute.get("/", auth(), AccountController.list);

accountRoute.post(
  "/",
  auth(),
  validateMiddlewares.validateJson(createAccountSchema),
  AccountController.create,
);

accountRoute.put(
  "/:id",
  auth(),
  validateMiddlewares.validateParam(accountIdParamSchema),
  validateMiddlewares.validateJson(updateAccountSchema),
  AccountController.update,
);

accountRoute.delete(
  "/:id",
  auth(),
  validateMiddlewares.validateParam(accountIdParamSchema),
  AccountController.remove,
);

export default accountRoute;