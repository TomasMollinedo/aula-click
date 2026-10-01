import type { FiltrosCuentaParams, ListarGlobalParams } from '../cuentas.types'

// Todo cuelga de `all`: registrar un pago (T-52) invalida `all` con `useInvalidarCuentas` y alcanza a
// la cuenta de cada alumno (con cualquier filtro) y a las dos vistas globales.
export const cuentasKeys = {
  all: ['cuentas'] as const,
  alumnos: () => [...cuentasKeys.all, 'alumno'] as const,
  /** El `alumnoId` va en la posición 2: `useCuentaDelAlumno` lo lee de la query anterior. */
  alumno: (alumnoId: number, filtros: FiltrosCuentaParams = {}) =>
    [...cuentasKeys.alumnos(), alumnoId, filtros] as const,
  adeudados: () => [...cuentasKeys.all, 'adeudados'] as const,
  adeudadosLista: (params: ListarGlobalParams) => [...cuentasKeys.adeudados(), params] as const,
  proximos: () => [...cuentasKeys.all, 'proximos'] as const,
  proximosLista: (params: ListarGlobalParams) => [...cuentasKeys.proximos(), params] as const,
}
