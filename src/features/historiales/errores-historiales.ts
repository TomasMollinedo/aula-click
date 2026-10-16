import type { ApiError } from '@/utils/fetch-json'

// Error de la lectura del historial en lo que muestra la pantalla (docs/arquitectura-frontend.md →
// Manejo de errores en la UI). El 401 y el 403 `USUARIO_INHABILITADO` los resuelve `providers.tsx`
// (redirige a /login); acá sólo se elige el texto y dónde va. Es el único lugar de `historiales`
// que conoce la forma de los `details` del 400.

/** Los filtros que la API valida: un `details` con `path: [<campo>]` se muestra junto a ese campo. */
export const CAMPOS_FILTRO = ['desde', 'hasta', 'materiaId', 'profesorId'] as const
export type CampoFiltro = (typeof CAMPOS_FILTRO)[number]

export type ErrorHistorial = {
  tipo: 'noEncontrado' | 'filtros' | 'sinPermiso' | 'general'
  /**
   * Lo que va en el lugar del contenido. Con `tipo: 'filtros'` es el error general de los filtros,
   * o `null` si todo el error quedó ubicado en `campos`.
   */
  mensaje: string | null
  /** Sólo con `tipo: 'filtros'`: el `message` de la API de cada campo, tal cual. */
  campos: Partial<Record<CampoFiltro, string>>
  /** Si tiene sentido ofrecer "Reintentar" (no con 400, 403 ni 404: daría lo mismo). */
  reintentar: boolean
}

export const MENSAJE_FILTROS_INVALIDOS = 'Los filtros no son válidos. Revisalos o limpialos.'
export const MENSAJE_ALUMNO_NO_ENCONTRADO = 'El alumno no existe'
export const MENSAJE_SIN_PERMISO = 'No tenés permiso para ver el historial de este alumno'
export const MENSAJE_GENERAL =
  'No se pudo cargar el historial. Revisá la conexión e intentá de nuevo.'

const camposValidos = new Set<string>(CAMPOS_FILTRO)

/**
 * Un detalle con la forma de Zod, de un solo campo conocido: `path: ['hasta']` y `message`. El
 * período del historial es el único 400 que manda la API (decisión T-147).
 */
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
 * El 400 `VALIDACION` de los filtros: un `hasta` anterior al `desde` o un período de más de 366
 * días, los dos con `details` sobre `hasta`. Cada `details` con `path: [<campo>]` sale como error
 * de ese campo, con el `message` de la API (el primero de cada campo). Si alguno no se puede
 * ubicar, o no hay `details`, queda además el error general.
 */
function errorDeFiltros(details: unknown): ErrorHistorial {
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
 * - 404: el alumno de la ficha no existe.
 * - 400: el período no es válido (ver `errorDeFiltros`).
 * - 403: sin permiso; para el profesor, un alumno que no tiene ni tuvo turnos con él (HU-31).
 * - Cualquier otro (500, red, desconocido): mensaje genérico con reintentar. Un error de red lo
 *   lanza `fetch` y no es un `ApiError`, así que `status` puede no estar.
 */
export function interpretarErrorHistorial(error: ApiError | null | undefined): ErrorHistorial {
  switch (error?.status) {
    case 404:
      return {
        tipo: 'noEncontrado',
        mensaje: MENSAJE_ALUMNO_NO_ENCONTRADO,
        campos: {},
        reintentar: false,
      }
    case 400:
      return errorDeFiltros(error.details)
    case 403:
      return { tipo: 'sinPermiso', mensaje: MENSAJE_SIN_PERMISO, campos: {}, reintentar: false }
    default:
      return { tipo: 'general', mensaje: MENSAJE_GENERAL, campos: {}, reintentar: true }
  }
}
