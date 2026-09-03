import { Hono } from "hono";
import { auth } from "@/middlewares/auth.js";
import { validateMiddlewares } from "@/middlewares/validate.js";
import {
  createCategorySchema,
  updateCategorySchema,
  categoryIdParamSchema,
  categoryQuerySchema,
} from "@/validations/category.js";
import { CategoryController }  from "@/controllers/index.js";

const categoryRoute = new Hono();

categoryRoute.get( "/", auth(), validateMiddlewares.validateQuery(categoryQuerySchema), CategoryController.list, );

categoryRoute.post( "/", auth(), validateMiddlewares.validateJson(createCategorySchema), CategoryController.create,);

categoryRoute.put( "/:id", auth(), validateMiddlewares.validateParam(categoryIdParamSchema), validateMiddlewares.validateJson(updateCategorySchema), CategoryController.update, );

categoryRoute.delete( "/:id", auth(), validateMiddlewares.validateParam(categoryIdParamSchema), CategoryController.remove,);

export default categoryRoute;