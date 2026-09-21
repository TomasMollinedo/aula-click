import { AppError, type AppErrorOptions } from './app-error'

export class ForbiddenError extends AppError {
  constructor(message: string, options: AppErrorOptions = {}) {
    super(message, 403, { code: 'SIN_PERMISO', ...options })
  }
}
