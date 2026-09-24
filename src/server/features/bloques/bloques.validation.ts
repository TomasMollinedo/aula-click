import { z } from '@hono/zod-openapi'
import { type Auditoria, auditoriaSchema } from '@/server/shared/auditoria'
import { ESTADOS, type Estado } from '@/server/shared/estado'
import { diaSemana, fechaISO, horaHHmm, rangoHorasEnPunto } from '@/server/shared/zod'

// Schemas Zod de entrada, salida y params. Son la fuente del OpenAPI. Sin reglas de negocio.
// El día de la semana y el rango de horas en punto salen de `shared/zod.ts`: `aulas` valida su
// query con las mismas piezas.

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
    diaSemana,
    horaInicio: horaHHmm.openapi({ example: '14:00' }),
    horaFin: horaHHmm.openapi({ example: '18:00' }),
    aulaId,
  })
  .superRefine(rangoHorasEnPunto({ finPosterior: true }))
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
    diaSemana,
    horaInicio: horaHHmm.openapi({ example: '14:00' }),
    horaFin: horaHHmm.openapi({ example: '15:00' }),
    aulaId,
  })
  .partial()
  .refine((cambios) => Object.values(cambios).some((valor) => valor !== undefined), {
    error: 'Debe enviar al menos un campo',
  })
  // Sin `finPosterior`: puede llegar una sola de las horas; el orden lo valida el service.
  .superRefine(rangoHorasEnPunto({ finPosterior: false }))
  .openapi('BloqueEditar')

export type EditarBloque = z.infer<typeof editarBloqueSchema>

/** Una fila (una hora exacta), tal como viaja en las respuestas del alta y la edición. */
export const bloqueSchema = z
  .object({
    id: z.number().int(),
    diaSemana,
    horaInicio: horaHHmm,
    horaFin: horaHHmm,
    aula: bloqueAulaSchema,
  })
  .openapi('Bloque')

export type Bloque = z.infer<typeof bloqueSchema>

/**
 * Una fila del horario semanal (`GET /api/v1/bloques?profesorId=`, T-17 punto 1): además de lo de
 * `Bloque`, trae la capacidad máxima de esa hora (`min(profesor.capacidad, aula.capacidad)`) y su
 * ocupación en la próxima fecha de ese día de la semana, las dos calculadas al leer.
 */
export const bloqueHorarioSchema = z
  .object({
    id: z.number().int(),
    diaSemana,
    horaInicio: horaHHmm,
    horaFin: horaHHmm,
    aula: bloqueAulaSchema,
    capacidadEfectiva: z.number().int().openapi({
      description: 'min(profesor.capacidad, aula.capacidad), calculada al leer',
      example: 10,
    }),
    proximaFecha: fechaISO.openapi({
      description: 'Próxima fecha de ese día de la semana, a partir de hoy (hoy incluido)',
      example: '2026-09-28',
    }),
    ocupacion: z.number().int().openapi({
      description: 'Turnos ACTIVO de esta hora en `proximaFecha` (los cancelados no cuentan)',
      example: 0,
    }),
  })
  .openapi('BloqueHorario')

export type BloqueHorario = z.infer<typeof bloqueHorarioSchema>

export const horarioSchema = z.array(bloqueHorarioSchema)

/**
 * Detalle de una fila (`GET /api/v1/bloques/{bloqueId}`): lo mismo que en el horario, más su
 * estado (también se puede ver una hora dada de baja), el profesor, la capacidad del aula y la
 * auditoría (quién la cargó y quién la modificó por última vez).
 */
export const bloqueDetalleSchema = z
  .object({
    ...bloqueHorarioSchema.shape,
    estado: z.enum(ESTADOS),
    aula: z
      .object({ id: z.number().int(), nombre: z.string(), capacidad: z.number().int() })
      .openapi('BloqueDetalleAula'),
    profesor: z
      .object({ id: z.number().int(), nombre: z.string(), apellido: z.string() })
      .openapi('BloqueProfesor'),
    ...auditoriaSchema.shape,
  })
  .openapi('BloqueDetalle')

export type BloqueDetalle = z.infer<typeof bloqueDetalleSchema>

/**
 * Respuesta de las operaciones sobre varias filas a la vez (el alta de un rango y la baja de
 * varias horas): cuántas filas se afectaron y el detalle de cada una.
 */
export const bloquesLoteSchema = z
  .object({
    cantidad: z
      .number()
      .int()
      .openapi({ description: 'Cantidad de filas creadas o dadas de baja', example: 4 }),
    bloques: z.array(bloqueSchema),
  })
  .openapi('BloquesLote')

export type BloquesLote = z.infer<typeof bloquesLoteSchema>

/**
 * Body de la baja de varias horas juntas (el bloque que la UI muestra agrupado): los ids de las
 * filas, explícitos, nunca un rango (así no se da de baja nada que el usuario no haya visto).
 * Uno o varios, sin repetir, hasta `MAX_BLOQUES_BAJA` (las horas de un día). Que existan, estén
 * activas, sean del mismo profesor y no tengan turnos vigentes lo decide el service.
 */
const MAX_BLOQUES_BAJA = 24

export const eliminarBloquesSchema = z
  .object({
    bloqueIds: z
      .array(
        z
          .number({ error: 'Debe ser un número' })
          .int({ error: 'Debe ser un número entero' })
          .positive({ error: 'Debe ser mayor a 0' }),
        { error: 'Debe ser una lista de ids de bloques' },
      )
      .min(1, { error: 'Debe enviar al menos un bloque' })
      .max(MAX_BLOQUES_BAJA, {
        error: `No puede enviar más de ${MAX_BLOQUES_BAJA} bloques`,
      })
      .refine((ids) => new Set(ids).size === ids.length, { error: 'No puede repetir bloques' })
      .openapi({ description: 'Ids de las filas (horas) a dar de baja', example: [10, 11, 12] }),
  })
  .openapi('BloquesEliminar')

export type EliminarBloques = z.infer<typeof eliminarBloquesSchema>

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

/**
 * Una fila con todo lo que necesita su detalle, tal como la lee `bloques.repository`: horas en
 * minutos, la capacidad del profesor (para la capacidad efectiva) y la auditoría ya armada. El
 * service le agrega la próxima fecha y la ocupación. No viaja por HTTP así.
 */
export type BloqueDetalleGuardado = {
  id: number
  diaSemana: number
  horaInicio: number
  horaFin: number
  estado: Estado
  aula: { id: number; nombre: string; capacidad: number }
  profesor: { id: number; nombre: string; apellido: string; capacidad: number }
} & Auditoria
