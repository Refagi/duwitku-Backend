import type { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'
import { jwt, sign, verify } from 'hono/jwt'
import { TokenTypes, JwtPayload } from '@/models/token.js'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { HTTPException } from 'hono/http-exception'
import type { MiddlewareHandler } from 'hono'
import prisma from '~/prisma/client.js'

export const auth = (requiredRole?: string[]): MiddlewareHandler => {
  return async (c, next) => {
    try {
      const authHeader = c.req.header('Authorization')
      const cookiesToken = getCookie(c, 'accessToken')

      let token: string | null = null

      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.slice(7)
      } else if (cookiesToken) {
        token = cookiesToken
      }

      if (!token) {
        throw new HTTPException(HttpStatusCodes.UNAUTHORIZED, {
          message: 'Silahkan lakukan verifikasi!',
        })
      }

      const payload = (await verify(token, Bun.env.JWT_SECRET as string, {
        alg: 'HS256',
      })) as JwtPayload

      if (payload.type !== 'ACCESS') {
        throw new HTTPException(HttpStatusCodes.UNAUTHORIZED, {
          message: 'Silahkan lakukan verifikasi!',
        })
      }

      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
      })

      if (!user) {
        throw new HTTPException(HttpStatusCodes.UNAUTHORIZED, {
          message: 'Silahkan lakukan verifikasi!',
        })
      }

      c.set('userId', user.id)
      await next()
    } catch (err) {
      throw new HTTPException(HttpStatusCodes.UNAUTHORIZED, { message: 'Invalid or expired token' })
    }
  }
}
