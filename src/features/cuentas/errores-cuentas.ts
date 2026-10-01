import type { ApiError } from '@/utils/fetch-json'

// Error de una lectura de cuentas en lo que muestra la pantalla (docs/arquitectura-frontend.md →
// Manejo de errores en la UI). El 401 y el 403 `USUARIO_INHABILITADO` los resuelve `providers.tsx`
// (redirige a /login); acá solo se elige el texto y dónde va. Es el único lugar de `cuentas` que
// conoce la forma de los `details` del 400.

/** Los filtros que la API valida: un `details` con `path: [<campo>]` se muestra junto a ese campo. */
export const CAMPOS_FILTRO = ['alumnoId', 'desde', 'hasta', 'materiaId', 'profesorId'] as const
export type CampoFiltro = (typeof CAMPOS_FILTRO)[number]

export type ErrorCuenta = {
  tipo: 'noEncontrado' | 'filtros' | 'sinPermiso' | 'general'
  /**
   * Lo que va en el lugar del contenido. Con `tipo: 'filtros'` es el error general de los filtros,
   * o `null` si todo el error quedó ubicado en `campos`.
   */
  mensaje: string | null
  /** Solo con `tipo: 'filtros'`: el `message` de la API de cada campo, tal cual. */
  campos: Partial<Record<CampoFiltro, string>>
  /** Si tiene sentido ofrecer "Reintentar" (no con 400, 403 ni 404: daría lo mismo). */
  reintentar: boolean
}

export const MENSAJE_FILTROS_INVALIDOS = 'Los filtros no son válidos. Revisalos o limpialos.'

const camposValidos = new Set<string>(CAMPOS_FILTRO)

/** Un detalle con la forma de Zod, de un solo campo conocido: `path: ['hasta']` y `message`. */
function campoDelDetalle(detalle: unknown): { campo: CampoFiltro; mensaje: string } | null {
  if (typeof detalle !== 'object' || detalle === null) return null
  const { path, message } = detalle as { path?: unknown; message?: unknown }
  if (!Array.isArray(path) || path.length !== 1 || typeof message !== 'string') return null
  const [campo] = path
  return typeof campo === 'string' && camposValidos.has(campo)
    ? { campo: campo as CampoFiltro, mensaje: message }
    : null
}

/**
 * El 400 `VALIDACION` de los filtros (el período: `hasta` anterior a `desde`). Cada `details` con
 * `path: [<campo>]` sale como error de ese campo, con el `message` de la API (el primero de cada
 * campo). Si alguno no se puede ubicar, o no hay `details`, queda además el error general.
 */
function errorDeFiltros(details: unknown): ErrorCuenta {
  const detalles = Array.isArray(details) ? details : []
  const campos: Partial<Record<CampoFiltro, string>> = {}
  let sinUbicar = detalles.length === 0
  for (const detalle of detalles) {
    const ubicado = campoDelDetalle(detalle)
    if (!ubicado) sinUbicar = true
    else campos[ubicado.campo] ??= ubicado.mensaje
  }
  return {
    tipo: 'filtros',
    mensaje: sinUbicar ? MENSAJE_FILTROS_INVALIDOS : null,
    campos,
    reintentar: false,
  }
}

/**
 * - 404: el alumno no existe (el de la ficha o el del filtro de la vista global).
 * - 400: un filtro no es válido (ver `errorDeFiltros`).
 * - 403: sin permiso (la API de cuentas es solo de mesa de entradas).
 * - Cualquier otro (500, red, desconocido): mensaje genérico con reintentar. Un error de red lo
 *   lanza `fetch` y no es un `ApiError`, así que `status` puede no estar.
 */
export function interpretarErrorCuenta(error: ApiError | null | undefined): ErrorCuenta {
  switch (error?.status) {
    case 404:
      return { tipo: 'noEncontrado', mensaje: 'El alumno no existe', campos: {}, reintentar: false }
    case 400:
      return errorDeFiltros(error.details)
    case 403:
      return {
        tipo: 'sinPermiso',
        mensaje: 'No tenés permiso para ver los pagos',
        campos: {},
        reintentar: false,
      }
    default:
      return {
        tipo: 'general',
        mensaje: 'No se pudieron cargar los pagos. Revisá la conexión e intentá de nuevo.',
        campos: {},
        reintentar: true,
      }
  }
}
