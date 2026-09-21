import { AppError, type AppErrorOptions } from './app-error'

export class ValidationError extends AppError {
  constructor(message: string, options: AppErrorOptions = {}) {
    super(message, 400, { code: 'VALIDACION', ...options })
  }
}
