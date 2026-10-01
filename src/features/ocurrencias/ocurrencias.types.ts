// Tipos de la API de `ocurrencias` (docs/contrato-api.md → Ocurrencias). Las respuestas son
// `OcurrenciaDetalle` y `OcurrenciaDeAlumno[]` de `@/types/ocurrencia` (las comparten varias
// features); acá solo los parámetros de cada pedido.

/** `GET /ocurrencias/{turnoId}/{fecha}`: la ocurrencia se identifica por los dos. */
export type ObtenerOcurrenciaParams = {
  turnoId: number
  fecha: string
}

/**
 * `GET /ocurrencias?alumnoId&desde?&hasta?`. Sin `desde`, la API usa 30 días atrás de hoy; sin
 * `hasta`, 8 semanas adelante.
 */
export type OcurrenciasDelAlumnoParams = {
  alumnoId: number
  desde?: string
  hasta?: string
}
