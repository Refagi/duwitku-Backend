import type { z } from "zod";
import type {
  createAccountSchema,
  updateAccountSchema,
  accountIdParamSchema,
} from "@/validations/account.js";

export type CreateAccountBody = z.infer<typeof createAccountSchema>;
export type UpdateAccountBody = z.infer<typeof updateAccountSchema>;
export type AccountIdParam = z.infer<typeof accountIdParamSchema>;