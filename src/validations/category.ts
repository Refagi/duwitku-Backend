import { z } from "zod";
 
export const createCategorySchema = z.object({
  name: z.string().min(1, "Nama kategori wajib diisi"),
  type: z.enum(["INCOME", "EXPENSE"]),
  icon: z.string().optional(),
});
 
export const updateCategorySchema = createCategorySchema.partial();
 
export const categoryIdParamSchema = z.object({
  id: z.string().min(1, "Category id wajib diisi"),
});
 
export const categoryQuerySchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]).optional(),
});
 