import { AppError, type AppErrorOptions } from './app-error'

export class UnauthorizedError extends AppError {
  constructor(message: string, options: AppErrorOptions = {}) {
    super(message, 401, { code: 'NO_AUTENTICADO', ...options })
  }
}
