import { z } from '@hono/zod-openapi'
import type { Estado } from '@/server/shared/estado'
import { horaAMinutos, horaHHmm } from '@/server/shared/zod'

/**
 * `horaAMinutos` sin excepción: si el formato ya es inválido, `horaHHmm` lo reporta solo (su
 * propio mensaje de formato); acá alcanza con no volver a fallar el `.refine()` por lo mismo.
 */
function minutosSeguro(hora: string | undefined): number | null {
  if (hora === undefined) return null
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

/** Aula tal como viaja en las respuestas de bloques: solo lo que hace falta para mostrarla. */
const bloqueAulaSchema = z
  .object({ id: z.number().int(), nombre: z.string() })
  .openapi('BloqueAula')

/** `profesorId` de query, para filtrar el horario. */
export const listarBloquesQuerySchema = z.object({
  profesorId: z.coerce
    .number({ error: 'Debe ser un número' })
    .int({ error: 'Debe ser un número entero' })
    .positive({ error: 'Debe ser mayor a 0' })
    .openapi({
      param: { name: 'profesorId', in: 'query' },
      description: 'Id del profesor',
      example: 3,
    }),
})

export type ListarBloquesQuery = z.infer<typeof listarBloquesQuerySchema>

/** `id` del path: el de la fila (una hora), no el del profesor. */
export const bloqueIdParamsSchema = z.object({
  bloqueId: z.coerce
    .number({ error: 'Debe ser un número' })
    .int({ error: 'Debe ser un número entero' })
    .positive({ error: 'Debe ser mayor a 0' })
    .openapi({
      param: { name: 'bloqueId', in: 'path' },
      description: 'Id del bloque',
      example: 10,
    }),
})

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

/**
 * Body de la edición: día, horario y aula de esa única hora (T-17 punto 4). Edición parcial: lo
 * omitido no cambia; el service arma el resultado (actual + cambios) y ahí recién valida que siga
 * siendo una hora exacta y en punto — no se puede a nivel de schema porque depende de la fila
 * actual. Acá solo se valida el formato de lo que sí llega.
 */
export const editarBloqueSchema = z
  .object({
    diaSemana: diaSemanaSchema,
    horaInicio: horaHHmm.openapi({ example: '14:00' }),
    horaFin: horaHHmm.openapi({ example: '15:00' }),
    aulaId,
  })
  .partial()
  .refine((cambios) => Object.values(cambios).some((valor) => valor !== undefined), {
    error: 'Debe enviar al menos un campo',
  })
  .refine((cambios) => (minutosSeguro(cambios.horaInicio) ?? 0) % 60 === 0, {
    error: 'Debe ser una hora en punto (por ejemplo 14:00)',
    path: ['horaInicio'],
  })
  .refine((cambios) => (minutosSeguro(cambios.horaFin) ?? 0) % 60 === 0, {
    error: 'Debe ser una hora en punto (por ejemplo 15:00)',
    path: ['horaFin'],
  })
  .openapi('BloqueEditar')

export type EditarBloque = z.infer<typeof editarBloqueSchema>

/** Una fila (una hora exacta), tal como viaja en las respuestas del alta y la edición. */
export const bloqueSchema = z
  .object({
    id: z.number().int(),
    diaSemana: diaSemanaSchema,
    horaInicio: horaHHmm,
    horaFin: horaHHmm,
    aula: bloqueAulaSchema,
  })
  .openapi('Bloque')

export type Bloque = z.infer<typeof bloqueSchema>

/**
 * Una fila del horario semanal (`GET /api/v1/bloques?profesorId=`, T-17 punto 1): además de lo de
 * `Bloque`, trae la capacidad máxima de esa hora (`min(profesor.capacidad, aula.capacidad)`),
 * calculada al leer.
 */
export const bloqueHorarioSchema = z
  .object({
    id: z.number().int(),
    diaSemana: diaSemanaSchema,
    horaInicio: horaHHmm,
    horaFin: horaHHmm,
    aula: bloqueAulaSchema,
    capacidadEfectiva: z.number().int().openapi({
      description: 'min(profesor.capacidad, aula.capacidad), calculada al leer',
      example: 10,
    }),
  })
  .openapi('BloqueHorario')

export type BloqueHorario = z.infer<typeof bloqueHorarioSchema>

export const horarioSchema = z.array(bloqueHorarioSchema)

/** Respuesta del alta: cuántas filas se crearon y el detalle de cada una. */
export const bloquesCreadosSchema = z
  .object({
    cantidad: z.number().int().openapi({ description: 'Cantidad de filas creadas', example: 4 }),
    bloques: z.array(bloqueSchema),
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

/** La fila tal como la lee el repository para editarla: todo en minutos. No viaja por HTTP. */
export type BloqueGuardado = {
  id: number
  profesorId: number
  aulaId: number
  diaSemana: number
  horaInicio: number
  horaFin: number
  estado: Estado
}

/** Datos ya validados (y ya fusionados con la fila actual) para editar una fila. No viaja por HTTP. */
export type DatosEditarBloque = {
  diaSemana: number
  horaInicio: number
  horaFin: number
  aulaId: number
}

/**
 * Fila activa del horario, con la capacidad del aula (para que el service calcule la capacidad
 * efectiva): todo en minutos, tal como lo lee `bloques.repository`. No viaja por HTTP así.
 */
export type BloqueConAula = {
  id: number
  diaSemana: number
  horaInicio: number
  horaFin: number
  aula: { id: number; nombre: string; capacidad: number }
}
