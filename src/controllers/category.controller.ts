import type { Context } from 'hono'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { CategoryServices } from '@/services/index.js'
import type {
  CategoryQuery,
  CreateCategoryBody,
  CategoryIdParam,
  UpdateCategoryBody,
} from '@/models/category.js'

class CategoryController {
  static list = async (c: Context) => {
    const userId = c.get('userId') as string
    const query = c.get('parsedQuery') as CategoryQuery

    const categories = await CategoryServices.list(userId, query)

    return c.json({
      status: HttpStatusCodes.OK,
      message: 'Daftar kategori berhasil diambil',
      data: { categories },
    })
  }

  static create = async (c: Context) => {
    const userId = c.get('userId') as string
    const body = c.get('parsedJson') as CreateCategoryBody

    const category = await CategoryServices.create(userId, body)

    return c.json(
      {
        status: HttpStatusCodes.CREATED,
        message: 'Kategori berhasil dibuat',
        data: { category },
      },
      HttpStatusCodes.CREATED,
    )
  }

  static update = async (c: Context) => {
    const userId = c.get('userId') as string
    const { id } = c.get('parsedParam') as CategoryIdParam
    const body = c.get('parsedJson') as UpdateCategoryBody

    const category = await CategoryServices.update(userId, id, body)

    return c.json({
      status: HttpStatusCodes.OK,
      message: 'Kategori berhasil diperbarui',
      data: { category },
    })
  }

  static remove = async (c: Context) => {
    const userId = c.get('userId') as string
    const { id } = c.get('parsedParam') as CategoryIdParam

    await CategoryServices.remove(userId, id)

    return c.json({
      status: HttpStatusCodes.OK,
      message: 'Kategori berhasil dihapus',
    })
  }
}

export default CategoryController
