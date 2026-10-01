import type { ApiError } from '@/utils/fetch-json'

// Error de una lectura de cuentas en lo que muestra la pantalla (docs/arquitectura-frontend.md →
// Manejo de errores en la UI). El 401 y el 403 `USUARIO_INHABILITADO` los resuelve `providers.tsx`
// (redirige a /login); acá solo se elige el texto que va en el lugar del contenido.

export type ErrorCuenta = {
  tipo: 'noEncontrado' | 'invalido' | 'sinPermiso' | 'general'
  mensaje: string
  /** Si tiene sentido ofrecer "Reintentar" (no con 400, 403 ni 404: daría lo mismo). */
  reintentar: boolean
}

/**
 * - 404: el alumno no existe (el de la ficha o el del filtro de la vista global).
 * - 400: el id del alumno no es válido.
 * - 403: sin permiso (la API de cuentas es solo de mesa de entradas).
 * - Cualquier otro (500, red, desconocido): mensaje genérico con reintentar. Un error de red lo
 *   lanza `fetch` y no es un `ApiError`, así que `status` puede no estar.
 */
export function interpretarErrorCuenta(error: ApiError | null | undefined): ErrorCuenta {
  switch (error?.status) {
    case 404:
      return { tipo: 'noEncontrado', mensaje: 'El alumno no existe', reintentar: false }
    case 400:
      return { tipo: 'invalido', mensaje: 'El alumno indicado no es válido', reintentar: false }
    case 403:
      return {
        tipo: 'sinPermiso',
        mensaje: 'No tenés permiso para ver los pagos',
        reintentar: false,
      }
    default:
      return {
        tipo: 'general',
        mensaje: 'No se pudieron cargar los pagos. Revisá la conexión e intentá de nuevo.',
        reintentar: true,
      }
  }
}
