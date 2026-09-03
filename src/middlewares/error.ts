import { ZodError } from 'zod'
import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { HTTPException } from 'hono/http-exception'
import * as HttpStatusCodes from 'stoker/http-status-codes'

import { config } from '@/config/config.js'
import { logger } from '@/config/logger.js'
import { ApiError } from '../utils/ApiError.js'

// Sesuaikan path ini dengan output generator Prisma kamu.
// Kalau schema.prisma pakai `generator client { output = "../src/generated/prisma" }`
// biarkan seperti ini. Kalau masih default, ganti jadi: `from "@prisma/client"`.
import { Prisma } from '../generated/prisma/client.js'

abstract class ErrorMiddlewareBase {
  protected handlePrismaError(
    err: Prisma.PrismaClientValidationError | Prisma.PrismaClientKnownRequestError,
  ): ApiError {
    if (err instanceof Prisma.PrismaClientValidationError) {
      return new ApiError(
        HttpStatusCodes.BAD_REQUEST,
        'Invalid data. Please check your input.',
        true,
        err.stack,
      )
    }

    const knownError = err as Prisma.PrismaClientKnownRequestError

    switch (knownError.code) {
      case 'P2002':
        return new ApiError(HttpStatusCodes.CONFLICT, 'Data already exists.', true, err.stack)
      case 'P2014':
        return new ApiError(HttpStatusCodes.BAD_REQUEST, 'Invalid ID', true, err.stack)
      case 'P2003':
        return new ApiError(HttpStatusCodes.BAD_REQUEST, 'Invalid input data.', true, err.stack)
      case 'P2025':
        return new ApiError(HttpStatusCodes.NOT_FOUND, 'Data not found.', true, err.stack)
      default:
        return new ApiError(
          HttpStatusCodes.INTERNAL_SERVER_ERROR,
          `Something went wrong: ${err.message}`,
          false,
          err.stack,
        )
    }
  }

  protected handleZodError(err: ZodError): ApiError {
    return new ApiError(
      HttpStatusCodes.BAD_REQUEST,
      `Validation error: ${err.message}`,
      true,
      err.stack,
    )
  }
}

class ErrorConverter extends ErrorMiddlewareBase {
  private convertedError: ApiError

  constructor(error: any) {
    super()

    if (error instanceof ApiError) {
      this.convertedError = error
      return
    }

    if (error instanceof ZodError) {
      logger.debug('Converting ZodError -> ApiError')
      this.convertedError = this.handleZodError(error)
    } else if (
      error instanceof Prisma.PrismaClientValidationError ||
      error instanceof Prisma.PrismaClientKnownRequestError
    ) {
      logger.debug('Converting PrismaError -> ApiError')
      this.convertedError = this.handlePrismaError(error)
    } else {
      if (config.env === 'development') {
        logger.debug('Unhandled error type: {errorType}', {
          errorType: error?.constructor?.name ?? typeof error,
        })
      }

      const statusCode = error?.statusCode ?? HttpStatusCodes.INTERNAL_SERVER_ERROR
      const message = error?.message ?? 'Internal server error'
      this.convertedError = new ApiError(statusCode, message, false, error?.stack)
    }
  }

  public getError(): ApiError {
    return this.convertedError
  }
}

class ErrorResponder extends ErrorMiddlewareBase {
  private error: ApiError
  private context: Context

  constructor(err: Error, c: Context) {
    super()
    const converter = new ErrorConverter(err)
    this.error = converter.getError()
    this.context = c
  }

  private buildResponse() {
    let { statusCode, message, isOperational, stack } = this.error

    // Sembunyikan detail error non-operational (bug internal) di production
    if (config.env === 'production' && !isOperational) {
      statusCode = HttpStatusCodes.INTERNAL_SERVER_ERROR
      message = 'Something went wrong, please try again later.'
    }

    const response: Record<string, unknown> = { code: statusCode, message }

    if (config.env === 'development' && stack) {
      response.stack = stack
    }

    return { response, statusCode }
  }

  private logError() {
    const { method, url, path } = this.context.req

    // LogTape: placeholder {namaField} di message dicocokkan otomatis
    // dengan key di object kedua. Ini yang dipakai buat structured logging.
    logger.error('Request failed: {method} {path} -> {statusCode} {message}', {
      method,
      url,
      path,
      statusCode: this.error.statusCode,
      message: this.error.message,
      isOperational: this.error.isOperational,
      ...(config.env === 'development' && this.error.stack
        ? { stack: this.error.stack.split('\n').slice(0, 10).join('\n') }
        : {}),
    })
  }

  public handle() {
    this.logError()
    const { response, statusCode } = this.buildResponse()
    return this.context.json(response, statusCode as ContentfulStatusCode)
  }
}

export const errorConverter = (err: any): ApiError => {
  return new ErrorConverter(err).getError()
}

// Dipasang lewat app.onError(errorHandler) di app.ts
export const errorHandler = (err: Error, c: Context) => {
  if (err instanceof HTTPException) {
    logger.warn('HTTPException: {status} {message}', {
      status: err.status,
      message: err.message,
    })
    return c.json({ code: err.status, message: err.message }, err.status)
  }

  return new ErrorResponder(err, c).handle()
}
