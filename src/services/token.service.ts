import type { Context } from 'hono'
import { jwt, sign, verify } from 'hono/jwt'
import { config } from '@/config/config.js'
import { JwtPayload, TokenTypes, TypeSaveToken } from '@/models/token.js'
import prisma from '~/prisma/client.js'
import dayjs, { type Dayjs } from 'dayjs'
import { ApiError } from '@/utils/ApiError.js'
import * as HttpStatusCodes from 'stoker/http-status-codes'

class TokenService {
  static async generateToken(
    userId: string,
    expires: Dayjs,
    type: TokenTypes,
    secret: string = Bun.env.JWT_SECRET as string,
  ): Promise<string> {
    const now = Math.floor(Date.now() / 1000)
    const exp = expires.unix()

    const payload: JwtPayload = {
      sub: userId,
      iat: now,
      exp,
      type,
    }

    return sign(payload, secret, 'HS256')
  }

  static async saveToken(tokenBody: TypeSaveToken) {
    const { token, userId, expires, type, newEmail, blacklisted = false } = tokenBody

    const tokenDoc = await prisma.token.create({
      data: {
        token,
        userId,
        expires: expires.toDate(),
        type,
        newEmail,
        blacklisted,
      },
    })

    return tokenDoc
  }

  static async verifyToken(token: string, type: TokenTypes) {
    try {
      const payload = await verify(token, Bun.env.JWT_SECRET as string, {
        alg: 'HS256',
      })

      const tokenDoc = await prisma.token.findFirst({
        where: {
          token,
          type,
          userId: payload.sub as string,
          blacklisted: false,
        },
      })

      if (!tokenDoc) {
        throw new ApiError(HttpStatusCodes.UNAUTHORIZED, 'Token not found!')
      }

      return tokenDoc
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Token is invalid!'
      throw new ApiError(HttpStatusCodes.UNAUTHORIZED, message)
    }
  }

  static async generateAuthTokens(userId: string) {
    const accessTokenExpires = dayjs().add(config.jwt.accessExpirationMinutes, 'minutes')
    const accessToken = await this.generateToken(userId, accessTokenExpires, TokenTypes.ACCESS)

    const refreshTokenExpires = dayjs().add(config.jwt.refreshExpirationDays, 'days')
    const refreshToken = await this.generateToken(userId, refreshTokenExpires, TokenTypes.REFRESH)

    await this.saveToken({
      token: refreshToken,
      userId,
      expires: refreshTokenExpires,
      type: TokenTypes.REFRESH,
    })

    return {
      access: {
        token: accessToken,
        expires: accessTokenExpires.toDate(),
      },
      refresh: {
        token: refreshToken,
        expires: refreshTokenExpires.toDate(),
      },
    }
  }

  static async generateVerifyEmailToken(userId: string) {
    await prisma.token.deleteMany({
      where: {
        userId,
        type: TokenTypes.VERIFY_EMAIL,
      },
    })

    const expires = dayjs().add(config.jwt.verifyEmailExpirationMinutes, 'minutes')

    const verifyEmailToken = await this.generateToken(userId, expires, TokenTypes.VERIFY_EMAIL)

    await this.saveToken({
      token: verifyEmailToken,
      userId,
      expires,
      type: TokenTypes.VERIFY_EMAIL,
    })

    return verifyEmailToken
  }

  static async generateResetPasswordToken(userId: string) {
    await prisma.token.deleteMany({
      where: {
        userId,
        type: TokenTypes.RESET_PASSWORD,
      },
    })

    const expires = dayjs().add(config.jwt.resetPasswordExpirationMinutes, 'minutes')

    const resetPasswordToken = await this.generateToken(userId, expires, TokenTypes.RESET_PASSWORD)

    await this.saveToken({
      token: resetPasswordToken,
      userId,
      expires,
      type: TokenTypes.RESET_PASSWORD,
    })

    return resetPasswordToken
  }
}

export default TokenService

// export async function hashPassword(password: string) {
//   return Bun.password.hash(password, {
//     algorithm: "bcrypt",
//     cost: 10,
//   });
// }

// export async function verifyPassword(password: string, hash: string) {
//   return Bun.password.verify(password, hash);
// }
