import type { ApiError } from '@/utils/fetch-json'

// Error de `GET /pagos` en lo que muestra "Pagos realizados" (docs/arquitectura-frontend.md →
// Manejo de errores en la UI). El 401 y el 403 `USUARIO_INHABILITADO` los resuelve `providers.tsx`
// (redirige a /login); acá solo se elige el texto y dónde va. Es el único lugar de los pagos
// realizados que conoce la forma de los `details` del 400.

/** Los filtros que valida la API: un `details` con `path: [<campo>]` va junto a ese campo. */
export const CAMPOS_FILTRO_PAGOS = [
  'desde',
  'hasta',
  'alumnoId',
  'materiaId',
  'profesorId',
  'formaPago',
] as const
export type CampoFiltroPagos = (typeof CAMPOS_FILTRO_PAGOS)[number]

export type ErrorPagosRealizados = {
  tipo: 'filtros' | 'sinPermiso' | 'general'
  /**
   * Lo que va en el lugar del contenido. Con `tipo: 'filtros'`, el error de los filtros que no se
   * pudo ubicar en un campo, o `null` si todo quedó en `campos`.
   */
  mensaje: string | null
  /** Solo con `tipo: 'filtros'`: el `message` de la API de cada campo, tal cual. */
  campos: Partial<Record<CampoFiltroPagos, string>>
  /** Si tiene sentido ofrecer "Reintentar" (no con 400 ni 403: daría lo mismo). */
  reintentar: boolean
}

export const MENSAJE_FILTROS_INVALIDOS = 'Los filtros no son válidos. Revisalos o limpialos.'

const camposValidos = new Set<string>(CAMPOS_FILTRO_PAGOS)

/** Un detalle con la forma de Zod, de un solo campo conocido: `path: ['hasta']` y `message`. */
function campoDelDetalle(detalle: unknown): { campo: CampoFiltroPagos; mensaje: string } | null {
  if (typeof detalle !== 'object' || detalle === null) return null
  const { path, message } = detalle as { path?: unknown; message?: unknown }
  if (!Array.isArray(path) || path.length !== 1 || typeof message !== 'string') return null
  const [campo] = path
  return typeof campo === 'string' && camposValidos.has(campo)
    ? { campo: campo as CampoFiltroPagos, mensaje: message }
    : null
}

/**
 * El 400 `VALIDACION` de los filtros (el período: `hasta` anterior a `desde`). Cada `details` con
 * `path: [<campo>]` sale como error de ese campo, con el `message` de la API (el primero de cada
 * campo). Si alguno no se puede ubicar, o no hay `details`, queda además el error general.
 */
function errorDeFiltros(details: unknown): ErrorPagosRealizados {
  const detalles = Array.isArray(details) ? details : []
  const campos: Partial<Record<CampoFiltroPagos, string>> = {}
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
 * - 400: un filtro no es válido (ver `errorDeFiltros`).
 * - 403: sin permiso (`GET /pagos` es de mesa de entradas y el gerente).
 * - Cualquier otro (500, red, desconocido): mensaje genérico con reintentar. Un error de red lo
 *   lanza `fetch` y no es un `ApiError`, así que `status` puede no estar.
 *
 * No hay 404: un alumno, una materia o un profesor que no existen dan una lista vacía.
 */
export function interpretarErrorPagosRealizados(
  error: ApiError | null | undefined,
): ErrorPagosRealizados {
  switch (error?.status) {
    case 400:
      return errorDeFiltros(error.details)
    case 403:
      return {
        tipo: 'sinPermiso',
        mensaje: 'No tenés permiso para ver los pagos realizados',
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
