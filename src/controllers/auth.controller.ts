import * as HttpStatusCodes from 'stoker/http-status-codes'
import { ApiError } from '@/utils/ApiError.js'
import { TokenServices, AuthServices } from '@/services/index.js'
import { type Context } from 'hono'
import { getCookie } from 'hono/cookie'
import type { RegisterBody, LoginBody, LogoutBody } from '@/models/auth.js'
import { setAuthCookies, clearAuthCookies } from '@/utils/cookie.js'

class AuthController {
  static register = async (c: Context) => {
    const body = c.get('parsedJson') as RegisterBody

    const user = await AuthServices.register(body)

    let tokens = await TokenServices.generateAuthTokens(user.id)
    setAuthCookies(c, tokens)
    const { password: _, ...userWithoutPassword } = user
    return c.json(
      {
        status: HttpStatusCodes.CREATED,
        message: 'Registrasi berhasil',
        data: { user: userWithoutPassword },
      },
      HttpStatusCodes.CREATED,
    )
  }

  static login = async (c: Context) => {
    const { email, password } = c.get('parsedJson') as LoginBody
    const userBody = { email, password }
    const user = await AuthServices.login(userBody)
    const tokens = await TokenServices.generateAuthTokens(user.id)
    setAuthCookies(c, tokens)
    const { password: _, ...userWithoutPassword } = user
    return c.json({
      status: HttpStatusCodes.OK,
      message: 'Login is successfully',
      data: { user: userWithoutPassword },
    })
  }

  static logout = async (c: Context) => {
    const getCookies = getCookie(c, 'refreshToken') as LogoutBody['refreshToken']
    if (!getCookies) {
      throw new ApiError(HttpStatusCodes.NOT_FOUND, 'Kamu telah logout!')
    }
    await AuthServices.logout(getCookies)
    clearAuthCookies(c)
    return c.json({ status: HttpStatusCodes.OK, message: 'Logout is successfully' })
  }

  static refreshToken = async (c: Context) => {
    const getToken = getCookie(c, 'refreshToken') as LogoutBody['refreshToken']
    if (!getToken) {
      throw new ApiError(HttpStatusCodes.UNAUTHORIZED, 'Refresh token tidak ditemukan!')
    }
    const newToken = await AuthServices.refreshToken(getToken)
    setAuthCookies(c, newToken)
    return c.json({ status: HttpStatusCodes.OK, message: 'Token berhasil diperbarui' })
  }

  static getCurrentUser = async (c: Context) => {
    const userId = c.get('userId') as string

    if (!userId) {
      throw new ApiError(HttpStatusCodes.UNAUTHORIZED, 'User tidak ditemukan!')
    }

    const user = await AuthServices.currentUser(userId)

    return c.json({
      status: HttpStatusCodes.OK,
      data: user,
    })
  }
}

export default AuthController
