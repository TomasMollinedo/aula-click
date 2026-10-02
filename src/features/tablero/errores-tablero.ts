import type { ApiError } from '@/utils/fetch-json'

// Error de la lectura del tablero en lo que muestra la pantalla (docs/arquitectura-frontend.md →
// Manejo de errores en la UI). El 401 y el 403 `USUARIO_INHABILITADO` los resuelve `providers.tsx`
// (redirige a /login); acá solo se elige el texto y dónde va. Es el único lugar de `tablero` que
// conoce la forma de los `details` del 400.

export type ErrorTablero = {
  tipo: 'periodo' | 'sinPermiso' | 'general'
  /** El texto del lugar del contenido; con `tipo: 'periodo'`, el general si no se ubicó en un campo. */
  mensaje: string | null
  /** Solo con `tipo: 'periodo'`: el `message` de la API sobre cada extremo, tal cual. */
  campos: { desde?: string; hasta?: string }
  /** Si tiene sentido ofrecer "Reintentar" (no con 400 ni 403: daría lo mismo). */
  reintentar: boolean
}

export const MENSAJE_PERIODO_INVALIDO = 'El período no es válido. Revisá las fechas.'

/** Un detalle de Zod de un solo campo conocido: `path: ['hasta']` y `message`. */
function campoDelDetalle(detalle: unknown): { campo: 'desde' | 'hasta'; mensaje: string } | null {
  if (typeof detalle !== 'object' || detalle === null) return null
  const { path, message } = detalle as { path?: unknown; message?: unknown }
  if (!Array.isArray(path) || path.length !== 1 || typeof message !== 'string') return null
  const [campo] = path
  return campo === 'desde' || campo === 'hasta' ? { campo, mensaje: message } : null
}

function errorDelPeriodo(details: unknown): ErrorTablero {
  const detalles = Array.isArray(details) ? details : []
  const campos: ErrorTablero['campos'] = {}
  let sinUbicar = detalles.length === 0
  for (const detalle of detalles) {
    const ubicado = campoDelDetalle(detalle)
    if (!ubicado) sinUbicar = true
    else campos[ubicado.campo] ??= ubicado.mensaje
  }
  return {
    tipo: 'periodo',
    mensaje: sinUbicar ? MENSAJE_PERIODO_INVALIDO : null,
    campos,
    reintentar: false,
  }
}

/**
 * - 400: el período no es válido (hasta anterior a desde, más de 366 días): cada `details` sobre un
 *   extremo sale junto a ese campo, con el `message` de la API; si alguno no se puede ubicar, o no
 *   hay `details`, queda además el error general.
 * - 403: sin permiso (el tablero es solo del gerente).
 * - Cualquier otro (500, red, desconocido): mensaje genérico con reintentar. Un error de red lo
 *   lanza `fetch` y no es un `ApiError`, así que `status` puede no estar.
 */
export function interpretarErrorTablero(error: ApiError | null | undefined): ErrorTablero {
  switch (error?.status) {
    case 400:
      return errorDelPeriodo(error.details)
    case 403:
      return {
        tipo: 'sinPermiso',
        mensaje: 'No tenés permiso para ver el tablero',
        campos: {},
        reintentar: false,
      }
    default:
      return {
        tipo: 'general',
        mensaje: 'No se pudo cargar el tablero. Revisá la conexión e intentá de nuevo.',
        campos: {},
        reintentar: true,
      }
  }
}
