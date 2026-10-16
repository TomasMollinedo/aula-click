// La sección del tablero en la URL (HU-39). Funciones puras: este es el **único lugar** que conoce
// el parámetro `seccion`. No se usa `useVistaEnUrl` (`utils/vista-en-url.ts`) porque ese arma la URL
// de cero al cambiar y descarta lo que no esté en `conservar`: acá el período, la paginación y el
// orden de las tablas tienen que sobrevivir al cambio de pestaña.
//
// URL: sin parámetros, "General" (la sección por defecto no se escribe). `?seccion=asistencia` o
// `?seccion=finanzas` para las otras, y un valor desconocido cae en la default: la URL nunca rompe
// la pantalla.

export const SECCIONES = ['general', 'asistencia', 'finanzas'] as const

export type Seccion = (typeof SECCIONES)[number]

export const SECCION_POR_DEFECTO: Seccion = 'general'

export const ETIQUETA_SECCION: Record<Seccion, string> = {
  general: 'General',
  asistencia: 'Asistencia',
  finanzas: 'Finanzas',
}

function esSeccion(valor: string | null): valor is Seccion {
  return valor !== null && (SECCIONES as readonly string[]).includes(valor)
}

/** La sección de la URL; cualquier otro valor (o ninguno) es la por defecto. */
export function leerSeccion(params: URLSearchParams): Seccion {
  const valor = params.get('seccion')
  return esSeccion(valor) ? valor : SECCION_POR_DEFECTO
}

/**
 * Los parámetros de la URL para mostrar `seccion`, a partir de los actuales (sin mutarlos): los
 * demás se conservan (el período y el estado de las tablas) y la sección por defecto no se escribe.
 */
export function paramsConSeccion(actuales: URLSearchParams, seccion: Seccion): URLSearchParams {
  const params = new URLSearchParams(actuales)
  if (seccion === SECCION_POR_DEFECTO) params.delete('seccion')
  else params.set('seccion', seccion)
  return params
}
