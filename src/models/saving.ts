import type { z } from "zod";
import type {
  createSavingsGoalSchema, updateSavingsGoalSchema,
  savingsGoalIdParamSchema, allocateSavingsSchema,
} from "../validations/saving.js";

export type CreateSavingsGoalBody = z.infer<typeof createSavingsGoalSchema>;
export type UpdateSavingsGoalBody = z.infer<typeof updateSavingsGoalSchema>;
export type SavingsGoalIdParam = z.infer<typeof savingsGoalIdParamSchema>;
export type AllocateSavingsBody = z.infer<typeof allocateSavingsSchema>;