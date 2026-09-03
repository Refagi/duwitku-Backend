import { TokenServices } from './index.js'
import { ApiError } from '@/utils/ApiError.js'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import prisma from '@/../prisma/client.js'
import { TokenTypes } from '@/models/token.js'
import type { LoginBody, RegisterBody, GoogleProfileBody } from '@/models/auth.js'
import { DEFAULT_CATEGORIES } from '@/utils/defaultCategories.js'

export class AuthServices {
  private static async createUserRecord(data: {
    name: string
    email: string
    password: string | null
  }) {
    return prisma.user.create({
      data: {
        ...data,
        categories: {
          create: DEFAULT_CATEGORIES.map((cat) => ({ ...cat, isDefault: true })),
        },
      },
    })
  }
  static async register(body: RegisterBody) {
    const existing = await prisma.user.findUnique({
      where: { email: body.email },
    })

    if (existing) {
      throw new ApiError(HttpStatusCodes.BAD_REQUEST, 'Email sudah digunakan')
    }

    const hashedPassword = await Bun.password.hash(body.password, {
      algorithm: 'argon2id',
      memoryCost: 19456,
      timeCost: 2,
    })

    const user = await this.createUserRecord({
      name: body.name,
      email: body.email,
      password: hashedPassword,
    })

    return user
  }

  static async login(userBody: LoginBody) {
    const { email, password } = userBody
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      throw new ApiError(HttpStatusCodes.UNAUTHORIZED, 'Email atau Password salah!')
    }

    if (!user.password) {
      throw new ApiError(
        HttpStatusCodes.UNAUTHORIZED,
        'Akun ini terdaftar via Google, silakan login pakai tombol Google',
      )
    }

    const validPassword = await Bun.password.verify(password, user.password)

    if (!validPassword) {
      throw new ApiError(HttpStatusCodes.UNAUTHORIZED, 'Email atau Password salah!')
    }

    await prisma.token.deleteMany({
      where: { userId: user.id, type: 'REFRESH' },
    })

    return user
  }

  static async logout(refreshToken: string) {
    const getRefreshToken = await prisma.token.findFirst({
      where: { token: refreshToken, type: 'REFRESH', blacklisted: false },
    })

    if (!getRefreshToken) {
      throw new ApiError(HttpStatusCodes.NOT_FOUND, 'Kamu telah logout!')
    }
    await prisma.token.delete({ where: { id: getRefreshToken.id } })
  }

  static async refreshToken(tokens: string) {
    try {
      const refreshTokenDoc = await TokenServices.verifyToken(tokens, TokenTypes.REFRESH)

      if (!refreshTokenDoc) {
        throw new ApiError(HttpStatusCodes.UNAUTHORIZED, 'Token tidak valid!')
      }

      await prisma.token.delete({ where: { id: refreshTokenDoc.id } })

      const newToken = await TokenServices.generateAuthTokens(refreshTokenDoc.userId)
      return newToken
    } catch (error) {
      throw new ApiError(HttpStatusCodes.UNAUTHORIZED, 'Silahkan lakukan verifikasi!')
    }
  }

  static async findOrCreateFromGoogle(profile: GoogleProfileBody) {
    const existing = await prisma.user.findUnique({ where: { email: profile.email } })

    if (existing) {
      if (existing.isEmailVerified) return existing
      return prisma.user.update({
        where: { id: existing.id },
        data: { isEmailVerified: true },
      })
    }

    return this.createUserRecord({
      name: profile.name ?? profile.email.split('@')[0],
      email: profile.email,
      password: null,
    })
  }

  static async currentUser(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
      },
    })
  }
}

export default AuthServices
