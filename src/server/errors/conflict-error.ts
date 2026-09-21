import { AppError, type AppErrorOptions } from './app-error'

export class ConflictError extends AppError {
  constructor(message: string, options: AppErrorOptions = {}) {
    super(message, 409, { code: 'CONFLICTO', ...options })
  }
}
