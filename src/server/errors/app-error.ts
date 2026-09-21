export interface AppErrorOptions {
  code?: string
  details?: unknown
  cause?: unknown
}

export class AppError extends Error {
  readonly statusCode: number
  readonly code: string
  readonly details?: unknown

  constructor(message: string, statusCode = 500, options: AppErrorOptions = {}) {
    super(message, { cause: options.cause })
    this.name = new.target.name
    this.statusCode = statusCode
    this.code = options.code ?? 'ERROR_INTERNO'
    this.details = options.details
  }
}
