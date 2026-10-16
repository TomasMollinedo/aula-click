import type { ApiError } from '@/utils/fetch-json'

// Error de `GET /caja` en lo que muestra la caja diaria (docs/arquitectura-frontend.md → Manejo de
// errores en la UI). El 401 y el 403 `USUARIO_INHABILITADO` los resuelve `providers.tsx` (redirige
// a /login); acá sólo se elige el texto y dónde va. Es el único lugar de `caja` que conoce la forma
// de los `details` del 400.

/** Los parámetros que valida la API: un `details` con `path: [<campo>]` va junto a ese campo. */
export const CAMPOS_CAJA = ['fecha', 'tipo', 'formaPago'] as const
export type CampoCaja = (typeof CAMPOS_CAJA)[number]

export type ErrorCaja = {
  /**
   * `validacion`: un 400 (una fecha futura o inválida, un `tipo` o una `formaPago` que no existen).
   * `sinPermiso`: 403, la caja es sólo del gerente. `general`: cualquier otro (500, red).
   */
  tipo: 'validacion' | 'sinPermiso' | 'general'
  /** Lo que va en el lugar del contenido; en un 400, lo que no se pudo ubicar en un campo. */
  mensaje: string | null
  /** Sólo en un 400: el `message` de la API de cada campo, tal cual. */
  campos: Partial<Record<CampoCaja, string>>
  /** Si tiene sentido ofrecer "Reintentar" (no con 400 ni 403: daría lo mismo). */
  reintentar: boolean
}

export const MENSAJE_CAJA_INVALIDA = 'No se pudo consultar la caja. Revisá la fecha y los filtros.'

const camposValidos = new Set<string>(CAMPOS_CAJA)

/** Un detalle con la forma de Zod, de un solo campo conocido: `path: ['fecha']` y `message`. */
function campoDelDetalle(detalle: unknown): { campo: CampoCaja; mensaje: string } | null {
  if (typeof detalle !== 'object' || detalle === null) return null
  const { path, message } = detalle as { path?: unknown; message?: unknown }
  if (!Array.isArray(path) || path.length !== 1 || typeof message !== 'string') return null
  const [campo] = path
  return typeof campo === 'string' && camposValidos.has(campo)
    ? { campo: campo as CampoCaja, mensaje: message }
    : null
}

/**
 * El 400 `VALIDACION`: una fecha futura ("No se puede consultar la caja de una fecha futura", en
 * `["fecha"]`), una fecha mal formada o un `tipo` o una `formaPago` que no existen. Cada `details`
 * sale junto a su campo, con el `message` de la API (el primero de cada campo). Si alguno no se
 * puede ubicar, o no hay `details`, queda además el error general.
 */
function errorDeValidacion(details: unknown): ErrorCaja {
  const detalles = Array.isArray(details) ? details : []
  const campos: ErrorCaja['campos'] = {}
  let sinUbicar = detalles.length === 0
  for (const detalle of detalles) {
    const ubicado = campoDelDetalle(detalle)
    if (!ubicado) sinUbicar = true
    else campos[ubicado.campo] ??= ubicado.mensaje
  }
  return {
    tipo: 'validacion',
    mensaje: sinUbicar ? MENSAJE_CAJA_INVALIDA : null,
    campos,
    reintentar: false,
  }
}

/**
 * - 400: ver `errorDeValidacion`.
 * - 403: sin permiso (la caja es sólo del gerente).
 * - Cualquier otro (404, 500, red, desconocido): mensaje genérico con reintentar. Un error de red
 *   lo lanza `fetch` y no es un `ApiError`, así que `status` puede no estar.
 *
 * No hay 404 propio: un día sin movimientos es 200 con la lista vacía y el resumen en 0.
 */
export function interpretarErrorCaja(error: ApiError | null | undefined): ErrorCaja {
  switch (error?.status) {
    case 400:
      return errorDeValidacion(error.details)
    case 403:
      return {
        tipo: 'sinPermiso',
        mensaje: 'No tenés permiso para ver la caja',
        campos: {},
        reintentar: false,
      }
    default:
      return {
        tipo: 'general',
        mensaje: 'No se pudo cargar la caja. Revisá la conexión e intentá de nuevo.',
        campos: {},
        reintentar: true,
      }
  }
}
