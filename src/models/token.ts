import { Prisma } from '@/generated/prisma/client.js';
import dayjs, {type Dayjs} from 'dayjs';
import type { JWTPayload } from 'hono/utils/jwt/types'

export type User = Prisma.UserGetPayload<{}>;
export type Token = Prisma.TokenGetPayload<{}>;

export interface JwtPayload extends JWTPayload {
  sub: string;
  iat?: number;
  exp: number;
  type: string
}

export interface TokenTypeConfig {
  secret: string;
  accessExpirationMinutes: number;
  refreshExpirationDays: number;
  resetPasswordExpirationMinutes: number;
  verifyEmailExpirationMinutes: number;
}


export enum TokenTypes {
  ACCESS = 'ACCESS',
  REFRESH = 'REFRESH',
  RESET_PASSWORD  = 'RESET_PASSWORD',
  VERIFY_EMAIL = 'VERIFY_EMAIL',
  UPDATE_EMAIL = 'UPDATE_EMAIL'
};

export type tokenTypes = 'ACCESS' | 'REFRESH'| 'RESET_PASSWORD' |  'VERIFY_EMAIL' | 'UPDATE_EMAIL';

export interface TypeSaveToken {
  token: string,
  userId: string,
  expires: Dayjs,
  type: tokenTypes,
  newEmail?: string,
  blacklisted?: boolean
}
