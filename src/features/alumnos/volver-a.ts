// Ida y vuelta al alta de alumno desde otra pantalla (por ejemplo, registrar un turno): el alta se
// abre con `?volverA=<destino>` y, al crear o al cancelar, vuelve ahí. Es el único lugar que conoce
// los destinos: `volverA` es una **lista blanca** de nombres, nunca una URL, así el query no puede
// mandar al usuario a cualquier lado (open redirect). Un valor que no está en la lista se ignora y
// el alta se comporta como siempre.
//
// Para sumar un destino: agregarlo a `DESTINOS` con sus dos rutas, relativas al segmento del rol
// (la feature no conoce el segmento: lo pasa la página).

const DESTINOS = {
  turnos: {
    alCrear: (alumnoId: number) => `/turnos?alumnoId=${alumnoId}`,
    alCerrar: '/turnos',
  },
} as const

export type DestinoVolverA = keyof typeof DESTINOS

/** Nombre del parámetro del query. */
export const PARAM_VOLVER_A = 'volverA'

/** El destino del query si está en la lista blanca; si no (o no viene), `null`. */
export function parsearVolverA(valor: string | null | undefined): DestinoVolverA | null {
  return valor !== null && valor !== undefined && Object.hasOwn(DESTINOS, valor)
    ? (valor as DestinoVolverA)
    : null
}

/**
 * Adónde ir al crear y al cerrar el alta con `volverA`. `rutaSegmento` es el segmento del rol
 * (por ejemplo `/mesa`).
 */
export function rutasDeVuelta(destino: DestinoVolverA, rutaSegmento: string) {
  const { alCrear, alCerrar } = DESTINOS[destino]
  return {
    alCrear: (alumnoId: number) => `${rutaSegmento}${alCrear(alumnoId)}`,
    alCerrar: `${rutaSegmento}${alCerrar}`,
  }
}

/**
 * URL del alta de alumno que vuelve a `destino`: `'/mesa/alumnos/nuevo?volverA=turnos'`.
 * `rutaAlumnos` es el listado de alumnos en el segmento del rol.
 */
export function hrefAltaConVuelta(rutaAlumnos: string, destino: DestinoVolverA): string {
  return `${rutaAlumnos}/nuevo?${new URLSearchParams({ [PARAM_VOLVER_A]: destino })}`
}
