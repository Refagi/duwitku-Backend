export type ApiErrorMessage = string | string[] | Array<{ message: string; path?: Array<string | number> }>;

export class ApiError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  constructor(statusCode: number, message: ApiErrorMessage, isOperational: boolean = true, stack?: string) {
    const formattedMessage =
      typeof message === 'string'
        ? message
        : Array.isArray(message)
        ? message
            .map((m) => (typeof m === 'string' ? m : `${m.message}${m.path && m.path.length ? ' at ' + m.path.join('.') : ''}`))
            .join('; ')
        : String(message);

    super(formattedMessage);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    if (stack) {
      this.stack = stack;
    } else if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
