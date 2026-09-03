import type { Context } from 'hono'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { AccountServices } from '@/services/index.js'
import type { CreateAccountBody, UpdateAccountBody, AccountIdParam } from '@/models/account.js'

class AccountController {
  static list = async (c: Context) => {
    const userId = c.get('userId') as string
    const accounts = await AccountServices.list(userId)

    return c.json({
      status: HttpStatusCodes.OK,
      message: 'Daftar dompet berhasil diambil',
      data: { accounts },
    })
  }

  static create = async (c: Context) => {
    const userId = c.get('userId') as string
    const body = c.get('parsedJson') as CreateAccountBody

    const account = await AccountServices.create(userId, body)

    return c.json(
      {
        status: HttpStatusCodes.CREATED,
        message: 'Dompet berhasil dibuat',
        data: { account },
      },
      HttpStatusCodes.CREATED,
    )
  }

  static update = async (c: Context) => {
    const userId = c.get('userId') as string
    const { id } = c.get('parsedParam') as AccountIdParam
    const body = c.get('parsedJson') as UpdateAccountBody

    const account = await AccountServices.update(userId, id, body)

    return c.json({
      status: HttpStatusCodes.OK,
      message: 'Dompet berhasil diperbarui',
      data: { account },
    })
  }

  static remove = async (c: Context) => {
    const userId = c.get('userId') as string
    const { id } = c.get('parsedParam') as AccountIdParam

    await AccountServices.remove(userId, id)

    return c.json({
      status: HttpStatusCodes.OK,
      message: 'Dompet berhasil dihapus',
    })
  }
}

export default AccountController
