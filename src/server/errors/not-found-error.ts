import { AppError, type AppErrorOptions } from './app-error'

export class NotFoundError extends AppError {
  constructor(message: string, options: AppErrorOptions = {}) {
    super(message, 404, { code: 'NO_ENCONTRADO', ...options })
  }
}
