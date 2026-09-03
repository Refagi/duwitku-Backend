import { z } from 'zod'
import {
  registerSchema,
  loginSchema,
  logoutSchema,
  verifyEmailSchema,
  forgotPassordSchema,
  resetPasswordSchema,
  googleProfileSchema,
} from '@/validations/auth.js'

export type RegisterBody = z.infer<typeof registerSchema>
export type LoginBody = z.infer<typeof loginSchema>
export type LogoutBody = z.infer<typeof logoutSchema>
export type VerifyEmailBody = z.infer<typeof verifyEmailSchema>
export type ForgotPasswordBody = z.infer<typeof forgotPassordSchema>
export type ResetPasswordBody = z.infer<typeof resetPasswordSchema>
export type GoogleProfileBody = z.infer<typeof googleProfileSchema>

export enum ValidationType {
  BODY = 'body',
  QUERY = 'query',
  PARAM = 'param',
  HEADER = 'header',
  JSON = 'json',
}
