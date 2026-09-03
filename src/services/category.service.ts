import * as HttpStatusCodes from 'stoker/http-status-codes'
import prisma from '@/../prisma/client.js'
import { ApiError } from '@/utils/ApiError.js'
import type { CreateCategoryBody, UpdateCategoryBody, CategoryQuery } from '@/models/category.js'

export class CategoryServices {
  static async list(userId: string, query: CategoryQuery) {
    return prisma.category.findMany({
      where: { userId, ...(query.type ? { type: query.type } : {}) },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    })
  }

  static async getOwned(userId: string, categoryId: string) {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, userId },
    })

    if (!category) {
      throw new ApiError(HttpStatusCodes.NOT_FOUND, 'Kategori tidak ditemukan')
    }

    return category
  }

  static async create(userId: string, body: CreateCategoryBody) {
    return prisma.category.create({
      data: { ...body, userId, isDefault: false },
    })
  }

  static async update(userId: string, categoryId: string, body: UpdateCategoryBody) {
    await this.getOwned(userId, categoryId)

    return prisma.category.update({
      where: { id: categoryId },
      data: body,
    })
  }

  static async remove(userId: string, categoryId: string) {
    const category = await this.getOwned(userId, categoryId)

    if (category.isDefault) {
      throw new ApiError(HttpStatusCodes.CONFLICT, 'Kategori default tidak bisa dihapus')
    }

    const txCount = await prisma.transaction.count({ where: { categoryId } })
    if (txCount > 0) {
      throw new ApiError(
        HttpStatusCodes.CONFLICT,
        'Tidak bisa menghapus kategori yang masih dipakai transaksi',
      )
    }

    await prisma.category.delete({ where: { id: categoryId } })
  }
}

export default CategoryServices
