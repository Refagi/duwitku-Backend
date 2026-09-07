import { Hono } from 'hono'
import { googleAuth } from '@hono/oauth-providers/google'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { TokenServices } from '@/services/index.js'
import { logger } from '@/config/logger.js'
import { ApiError } from '@/utils/ApiError.js'
import { AuthServices } from '@/services/index.js'
import { setAuthCookies } from '@/utils/cookie.js'

const googleAuthRoutes = new Hono()

googleAuthRoutes.use(
  '/',
  googleAuth({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    scope: ['openid', 'email', 'profile'],
  }),
)

googleAuthRoutes.get('/', async (c) => {
  const googleUser = c.get('user-google')

  if (!googleUser?.email) {
    throw new ApiError(HttpStatusCodes.UNAUTHORIZED, 'Google login gagal: email tidak ditemukan')
  }

  if (googleUser.verified_email === false) {
    throw new ApiError(
      HttpStatusCodes.UNAUTHORIZED,
      'Email Google kamu belum diverifikasi oleh Google',
    )
  }

  const user = await AuthServices.findOrCreateFromGoogle({
    email: googleUser.email,
    name: googleUser.name,
    picture: googleUser.picture,
  })

  const tokens = await TokenServices.generateAuthTokens(user.id)
  setAuthCookies(c, tokens)
  logger.info('User logged in via Google', { userId: user.id })

  return c.redirect(`${process.env.FRONTEND_URL}/auth/google/callback`)
})

export default googleAuthRoutes
