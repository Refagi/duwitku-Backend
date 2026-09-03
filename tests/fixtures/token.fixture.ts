import dayjs from 'dayjs'
import { prisma } from '../setup/db-setup.js'
import { TokenServices } from '@/services/index.js'
import { TokenTypes } from '@/models/token.js'

export async function insertRefreshToken(
  userId: string,
  overrides: Partial<{ expires: dayjs.Dayjs; blacklisted: boolean }> = {},
) {
  const expires = overrides.expires ?? dayjs().add(7, 'days')
  const token = await TokenServices.generateToken(userId, expires, TokenTypes.REFRESH)

  return TokenServices.saveToken({
    token,
    userId,
    expires,
    type: TokenTypes.REFRESH,
    blacklisted: overrides.blacklisted ?? false,
  })
}

export async function insertExpiredRefreshToken(userId: string) {
  const expires = dayjs().subtract(1, 'day')
  const token = await TokenServices.generateToken(userId, expires, TokenTypes.REFRESH)
  return prisma.token.create({
    data: {
      token,
      userId,
      expires: expires.toDate(),
      type: TokenTypes.REFRESH,
      blacklisted: false,
    },
  })
}
