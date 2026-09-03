import { ApiError } from '@/utils/ApiError.js';
import type { Context, Next } from 'hono';
import { ZodError, type ZodType } from 'zod';
import * as httpStatusCode from 'stoker/http-status-codes';
import { ValidationType } from '@/models/auth.js';
import { sanitizeObject } from './sanitize.js';

const parsers = {
  [ValidationType.BODY]: async (c: Context) => await c.req.parseBody(),
  [ValidationType.QUERY]: (c: Context) => c.req.query(),
  [ValidationType.PARAM]: (c: Context) => c.req.param(),
  [ValidationType.HEADER]: (c: Context) => c.req.header(),
  [ValidationType.JSON]: async (c: Context) => await c.req.json(),
};

export class ValidateMiddlewares {
    createValidator(schema: ZodType, type: ValidationType, contextKey: string = 'parsedData') {
        return async (c: Context, next: Next) => {
            try {
                const parser = parsers[type];
                const data = await parser(c);
                const sanitizedData = sanitizeObject(data);
                const validatedData = schema.parse(sanitizedData);
                c.set(contextKey, validatedData);
                await next();
            } catch(error) {
                if (error instanceof SyntaxError) {
                    throw new ApiError(httpStatusCode.BAD_REQUEST, 'Invalid JSON format');
                } else if (error instanceof ZodError) {
                    throw new ApiError(httpStatusCode.BAD_REQUEST, error.issues.map(({ message }) => ({ message })));
                } else {
                    throw error;
                }
            }
         }
    }

    validateForm = (schema: ZodType) => {
        return this.createValidator(schema, ValidationType.BODY, 'parsedBody');
    };

    validateQuery = (schema: ZodType) => {
        return this.createValidator(schema, ValidationType.QUERY, 'parsedQuery');
    };

    validateJson = (schema: ZodType) => {
        return this.createValidator(schema, ValidationType.JSON, 'parsedJson');
    };

    validateParam = (schema: ZodType) => {
        return this.createValidator(schema, ValidationType.PARAM, 'parsedParam');
    };

    validateHeader = (schema: ZodType) => {
        return this.createValidator(schema, ValidationType.HEADER, 'parsedHeader');
    };
}

export const validateMiddlewares = new ValidateMiddlewares();
