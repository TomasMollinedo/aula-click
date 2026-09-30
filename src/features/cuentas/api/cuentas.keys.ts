import type { ListarAdeudadosParams } from '../cuentas.types'

// Todo cuelga de `all`: registrar un pago (T-52) invalida `all` con `useInvalidarCuentas` y alcanza a
// la cuenta de cada alumno y a la vista global.
export const cuentasKeys = {
  all: ['cuentas'] as const,
  alumnos: () => [...cuentasKeys.all, 'alumno'] as const,
  alumno: (alumnoId: number) => [...cuentasKeys.alumnos(), alumnoId] as const,
  adeudados: () => [...cuentasKeys.all, 'adeudados'] as const,
  adeudadosLista: (params: ListarAdeudadosParams) => [...cuentasKeys.adeudados(), params] as const,
}
