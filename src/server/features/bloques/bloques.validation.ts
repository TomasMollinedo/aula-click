import { z } from '@hono/zod-openapi'
import { horaAMinutos, horaHHmm } from '@/server/shared/zod'

/**
 * `horaAMinutos` sin excepción: si el formato ya es inválido, `horaHHmm` lo reporta solo (su
 * propio mensaje de formato); acá alcanza con no volver a fallar el `.refine()` por lo mismo.
 */
function minutosSeguro(hora: string): number | null {
  try {
    return horaAMinutos(hora)
  } catch {
    return null
  }
}

// Schemas Zod de entrada, salida y params. Son la fuente del OpenAPI. Sin reglas de negocio.

/** Día de la semana, ISO: 1 = lunes … 7 = domingo (contrato-api.md → Formatos). */
export const diaSemanaSchema = z
  .number({ error: 'Debe ser un número' })
  .int({ error: 'Debe ser un número entero' })
  .min(1, { error: 'Debe ser un día de la semana válido (1 a 7)' })
  .max(7, { error: 'Debe ser un día de la semana válido (1 a 7)' })
  .openapi({ description: 'Día de la semana, ISO: 1 = lunes … 7 = domingo', example: 1 })

const profesorId = z
  .number({ error: 'Debe ser un número' })
  .int({ error: 'Debe ser un número entero' })
  .positive({ error: 'Debe ser mayor a 0' })
  .openapi({ description: 'Id del profesor', example: 3 })

const aulaId = z
  .number({ error: 'Debe ser un número' })
  .int({ error: 'Debe ser un número entero' })
  .positive({ error: 'Debe ser mayor a 0' })
  .openapi({ description: 'Id del aula', example: 3 })

/**
 * Body de la carga de un bloque. Un rango de varias horas (por ejemplo 14:00 a 18:00) crea varias
 * filas de una hora cada una (T-17, T-29 de `decisiones.md`): no hay una fila que abarque varias
 * horas. Con las dos horas en punto y el fin posterior al inicio, la duración ya es múltiplo de
 * una hora: no hace falta un chequeo aparte de duración mínima.
 */
export const crearBloqueSchema = z
  .object({
    profesorId,
    diaSemana: diaSemanaSchema,
    horaInicio: horaHHmm.openapi({ example: '14:00' }),
    horaFin: horaHHmm.openapi({ example: '18:00' }),
    aulaId,
  })
  .refine((datos) => (minutosSeguro(datos.horaInicio) ?? 0) % 60 === 0, {
    error: 'Debe ser una hora en punto (por ejemplo 14:00)',
    path: ['horaInicio'],
  })
  .refine((datos) => (minutosSeguro(datos.horaFin) ?? 0) % 60 === 0, {
    error: 'Debe ser una hora en punto (por ejemplo 15:00)',
    path: ['horaFin'],
  })
  .refine(
    (datos) => {
      const inicio = minutosSeguro(datos.horaInicio)
      const fin = minutosSeguro(datos.horaFin)
      // Si alguna hora ya tiene formato inválido, ese error alcanza: no se compara.
      return inicio === null || fin === null || fin > inicio
    },
    { error: 'La hora de fin debe ser posterior a la de inicio', path: ['horaFin'] },
  )
  .openapi('BloqueCrear')

export type CrearBloque = z.infer<typeof crearBloqueSchema>

/** Una fila creada (una hora exacta), tal como viaja en la respuesta. */
export const bloqueCreadoSchema = z
  .object({
    id: z.number().int(),
    diaSemana: diaSemanaSchema,
    horaInicio: horaHHmm,
    horaFin: horaHHmm,
    aula: z.object({ id: z.number().int(), nombre: z.string() }).openapi('BloqueAula'),
  })
  .openapi('BloqueCreado')

export type BloqueCreado = z.infer<typeof bloqueCreadoSchema>

/** Respuesta del alta: cuántas filas se crearon y el detalle de cada una. */
export const bloquesCreadosSchema = z
  .object({
    cantidad: z.number().int().openapi({ description: 'Cantidad de filas creadas', example: 4 }),
    bloques: z.array(bloqueCreadoSchema),
  })
  .openapi('BloquesCreados')

export type BloquesCreados = z.infer<typeof bloquesCreadosSchema>

/** Una hora ya partida, en minutos desde medianoche (uso interno: no viaja por HTTP). */
export type HoraPedida = { horaInicio: number; horaFin: number }

/** Datos ya validados que necesita el repository para crear las filas. No viaja por HTTP. */
export type DatosCrearBloques = {
  profesorId: number
  aulaId: number
  diaSemana: number
  horas: HoraPedida[]
}
