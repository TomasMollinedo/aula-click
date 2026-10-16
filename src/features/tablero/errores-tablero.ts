import type { ApiError } from '@/utils/fetch-json'

// Error de la lectura del tablero en lo que muestra la pantalla (docs/arquitectura-frontend.md →
// Manejo de errores en la UI). El 401 y el 403 `USUARIO_INHABILITADO` los resuelve `providers.tsx`
// (redirige a /login); acá solo se elige el texto y dónde va. Es el único lugar de `tablero` que
// conoce la forma de los `details` del 400.

/** Los campos del período, que se muestran junto al selector. */
export const CAMPOS_PERIODO = ['desde', 'hasta'] as const

/**
 * Los parámetros propios de la sección "Asistencia" (HU-39): la página de cada tabla, el orden y
 * el filtro. Un 400 sobre uno de ellos no invalida el período, así que se muestra en la sección.
 */
export const CAMPOS_ASISTENCIA = [
  'paginaProfesores',
  'paginaMaterias',
  'orden',
  'direccion',
  'soloSinRegistrar',
] as const

/**
 * Los parámetros propios de la sección "Finanzas" (HU-47): la página y el orden de la tabla por
 * profesor. Como los de "Asistencia", un 400 sobre uno de ellos no invalida el período. `orden` y
 * `direccion` son los mismos nombres que usa "Asistencia": sólo una sección está activa a la vez.
 */
export const CAMPOS_FINANZAS = ['page', 'orden', 'direccion'] as const

export type CampoTablero =
  | (typeof CAMPOS_PERIODO)[number]
  | (typeof CAMPOS_ASISTENCIA)[number]
  | (typeof CAMPOS_FINANZAS)[number]

export type ErrorTablero = {
  /**
   * `periodo`: un 400 que toca el período (o que no se pudo ubicar). `parametros`: un 400 sólo
   * sobre los parámetros de las tablas de la sección ("Asistencia" o "Finanzas"), con el período
   * válido (el PDF sigue disponible). `sinPermiso`: 403. `general`: cualquier otro.
   */
  tipo: 'periodo' | 'parametros' | 'sinPermiso' | 'general'
  /** El texto del lugar del contenido; en un 400, el general si algo no se ubicó en un campo. */
  mensaje: string | null
  /** Solo en un 400: el `message` de la API sobre cada campo, tal cual. */
  campos: Partial<Record<CampoTablero, string>>
  /** Si tiene sentido ofrecer "Reintentar" (no con 400 ni 403: daría lo mismo). */
  reintentar: boolean
}

export const MENSAJE_PERIODO_INVALIDO = 'El período no es válido. Revisá las fechas.'

// `orden` y `direccion` están en las dos secciones: se repiten, lo que para `includes` da igual.
const CAMPOS: readonly CampoTablero[] = [
  ...CAMPOS_PERIODO,
  ...CAMPOS_ASISTENCIA,
  ...CAMPOS_FINANZAS,
]

function esCampo(valor: unknown): valor is CampoTablero {
  return typeof valor === 'string' && (CAMPOS as readonly string[]).includes(valor)
}

/** Un detalle de Zod de un solo campo conocido: `path: ['hasta']` y `message`. */
function campoDelDetalle(detalle: unknown): { campo: CampoTablero; mensaje: string } | null {
  if (typeof detalle !== 'object' || detalle === null) return null
  const { path, message } = detalle as { path?: unknown; message?: unknown }
  if (!Array.isArray(path) || path.length !== 1 || typeof message !== 'string') return null
  const [campo] = path
  return esCampo(campo) ? { campo, mensaje: message } : null
}

/**
 * El 400 de cualquiera de los tres endpoints: cada `details` va a su campo. Si toca el período (o
 * algo no se pudo ubicar) es un error del período, que además deja el documento sin armar; si sólo
 * toca los parámetros de las tablas, el período sigue siendo válido.
 */
function errorDeValidacion(details: unknown): ErrorTablero {
  const detalles = Array.isArray(details) ? details : []
  const campos: ErrorTablero['campos'] = {}
  let sinUbicar = detalles.length === 0
  for (const detalle of detalles) {
    const ubicado = campoDelDetalle(detalle)
    if (!ubicado) sinUbicar = true
    else campos[ubicado.campo] ??= ubicado.mensaje
  }
  const tocaElPeriodo = sinUbicar || CAMPOS_PERIODO.some((campo) => campos[campo] !== undefined)
  return {
    tipo: tocaElPeriodo ? 'periodo' : 'parametros',
    mensaje: sinUbicar ? MENSAJE_PERIODO_INVALIDO : null,
    campos,
    reintentar: false,
  }
}

/** Los mensajes del 400 de los campos de una sección, en el orden en que se muestran. */
function mensajesDe(
  campos: readonly CampoTablero[],
  error: ErrorTablero | null | undefined,
): string[] {
  if (!error) return []
  return campos
    .map((campo) => error.campos[campo])
    .filter((mensaje): mensaje is string => mensaje !== undefined)
}

/** Los mensajes del 400 que no van junto al selector de período: los de las tablas. */
export function mensajesDeAsistencia(error: ErrorTablero | null | undefined): string[] {
  return mensajesDe(CAMPOS_ASISTENCIA, error)
}

/** Lo mismo para "Finanzas": los de su tabla por profesor. */
export function mensajesDeFinanzas(error: ErrorTablero | null | undefined): string[] {
  return mensajesDe(CAMPOS_FINANZAS, error)
}

/**
 * - 400: el período no es válido (hasta anterior a desde, más de 366 días) o un parámetro de las
 *   tablas de "Asistencia" o de "Finanzas" no existe (una página que no es un entero >= 1, un
 *   `orden`, una `direccion` o un `soloSinRegistrar` desconocidos): cada `details` sale junto a su
 *   campo, con el `message` de la API; si alguno no se puede ubicar, o no hay `details`, queda
 *   además el error general.
 * - 403: sin permiso (el tablero es solo del gerente).
 * - Cualquier otro (500, red, desconocido): mensaje genérico con reintentar. Un error de red lo
 *   lanza `fetch` y no es un `ApiError`, así que `status` puede no estar.
 */
export function interpretarErrorTablero(error: ApiError | null | undefined): ErrorTablero {
  switch (error?.status) {
    case 400:
      return errorDeValidacion(error.details)
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
