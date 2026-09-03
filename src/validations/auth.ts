import { z } from 'zod'

export const registerSchema = z.object({
  name: z.string().min(5, { message: 'Name is required' }),
  email: z
    .email({ message: 'Email must be a valid email address' })
    .refine((email) => email.endsWith('@gmail.com'), { message: 'Email must end with @gmail.com' }),
  password: z
    .string()
    .min(8, { message: 'Password must be at least 8 characters' })
    .refine(
      (password) =>
        /[A-Za-z]/.test(password) && /\d/.test(password) && /[!@#$%^&*(),.?":{}|<>]/.test(password),
      {
        message: 'Password must contain at least 1 letter, 1 number, and 1 special character',
      },
    ),
})

export const loginSchema = z.object({
  email: z
    .email({ message: 'Email must be a valid email address' })
    .refine((email) => email.endsWith('@gmail.com'), { message: 'Email must end with @gmail.com' }),
  password: z
    .string()
    .min(8, { message: 'Password must be at least 8 characters' })
    .refine(
      (password) =>
        /[A-Za-z]/.test(password) && /\d/.test(password) && /[!@#$%^&*(),.?":{}|<>]/.test(password),
      {
        message: 'Password must contain at least 1 letter, 1 number, and 1 special character',
      },
    ),
})

export const logoutSchema = z.object({
  refreshToken: z.string().min(1, { message: 'refresh token must exist!' }),
})

export const verifyEmailSchema = z.object({
  token: z.string().min(1, { message: 'verify token must exist!' }),
})

export const forgotPassordSchema = z.object({
  email: z
    .email({ message: 'Email must be a valid email address' })
    .refine((email) => email.endsWith('@gmail.com'), { message: 'Email must end with @gmail.com' }),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1, { message: 'verify token must exist!' }),
  newPassword: z
    .string()
    .min(12, { message: 'Password must be at least 12 characters' })
    .refine(
      (password) =>
        /[A-Za-z]/.test(password) && /\d/.test(password) && /[!@#$%^&*(),.?":{}|<>]/.test(password),
      { message: 'Password must contain at least 1 letter, 1 number, and 1 special character' },
    ),
})

export const googleProfileSchema = z.object({
  email: z.email('Email dari Google tidak valid'),
  name: z.string().optional(),
  picture: z.url().optional(),
})
