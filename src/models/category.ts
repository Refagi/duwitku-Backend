import type { z } from "zod";
import type {
  createCategorySchema,
  updateCategorySchema,
  categoryIdParamSchema,
  categoryQuerySchema,
} from "@/validations/category.js";

export type CreateCategoryBody = z.infer<typeof createCategorySchema>;
export type UpdateCategoryBody = z.infer<typeof updateCategorySchema>;
export type CategoryIdParam = z.infer<typeof categoryIdParamSchema>;
export type CategoryQuery = z.infer<typeof categoryQuerySchema>;