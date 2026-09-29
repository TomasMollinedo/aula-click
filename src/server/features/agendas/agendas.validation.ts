import { z } from '@hono/zod-openapi'
import { ESTADOS_TURNO, TIPOS_TURNO } from '@/server/features/turnos/ocurrencias.condiciones'
import { qBusqueda } from '@/server/shared/busqueda'
import { paginacionQuerySchema, paginatedSchema } from '@/server/shared/paginacion'
import { diaSemana, fechaISO, horaHHmm } from '@/server/shared/zod'

// Schemas Zod de entrada, salida y params de las agendas (salieron de `turnos` en T-30, con el
// mismo contrato salvo la URL). Son la fuente del OpenAPI. Sin reglas de negocio: el rango máximo
// y las fechas por defecto los decide el service.

function idQuery(name: string, description: string, example: number) {
  return z.coerce
    .number({ error: 'Debe ser un número' })
    .int({ error: 'Debe ser un número entero' })
    .positive({ error: 'Debe ser mayor a 0' })
    .openapi({ param: { name, in: 'query' }, description, example })
}

// ---------------------------------------------------------------------------------------------
// Agenda diaria (T-23)
// ---------------------------------------------------------------------------------------------

/**
 * Query de la agenda diaria (T-23, decisiones T-35, T-36 y T-42): paginación + `fecha` (sin ella,
 * hoy) + filtros opcionales por materia, aula y profesor (por id) + `q` (búsqueda por nombre;
 * de alumno o profesor, o sólo de alumno si ya se filtró por `profesorId`).
 */
export const agendaQuerySchema = paginacionQuerySchema.extend({
  fecha: fechaISO.optional().openapi({
    param: { name: 'fecha', in: 'query' },
    description: 'Día a consultar (YYYY-MM-DD). Sin fecha, el de hoy (zona del negocio)',
    example: '2026-09-28',
  }),
  q: qBusqueda.openapi({
    description:
      'Búsqueda por palabras (decisión T-36): sin `profesorId`, coinciden todas en el nombre del alumno o todas en el del profesor (nunca mezcladas entre los dos). Con `profesorId` (T-42, vista personal del profesor), busca sólo por alumno. No distingue mayúsculas ni tildes',
  }),
  materiaId: idQuery('materiaId', 'Filtra por materia', 2).optional(),
  aulaId: idQuery('aulaId', 'Filtra por aula', 1).optional(),
  profesorId: idQuery(
    'profesorId',
    'Filtra por profesor: vista personal de su agenda ese día (decisión T-42). Combinado con `q`, la búsqueda pasa a ser solo por alumno',
    3,
  ).optional(),
})

export type AgendaQuery = z.infer<typeof agendaQuerySchema>

/** Ítem de la agenda: alumno, profesor, materia, aula, horario y estado (siempre `ACTIVO`: la
 * consulta excluye las ocurrencias canceladas). Sin `fecha`: es la misma para toda la página. */
export const agendaItemSchema = z
  .object({
    id: z.number().int(),
    alumno: z.object({
      id: z.number().int(),
      apellido: z.string(),
      nombre: z.string(),
    }),
    profesor: z.object({
      id: z.number().int(),
      apellido: z.string(),
      nombre: z.string(),
    }),
    materia: z.object({ id: z.number().int(), nombre: z.string() }),
    aula: z.object({ id: z.number().int(), nombre: z.string() }),
    horaInicio: horaHHmm,
    horaFin: horaHHmm,
    estado: z.enum(ESTADOS_TURNO),
  })
  .openapi('AgendaItem')

export type AgendaItem = z.infer<typeof agendaItemSchema>

export const agendaListadoSchema = paginatedSchema(agendaItemSchema)

export type AgendaListado = z.infer<typeof agendaListadoSchema>

/** Query de los selectores de materias y aulas con turno: `fecha` (sin ella, hoy). */
const fechaSelectorQuerySchema = z.object({
  fecha: fechaISO.optional().openapi({
    param: { name: 'fecha', in: 'query' },
    description: 'Día a consultar (YYYY-MM-DD). Sin fecha, el de hoy (zona del negocio)',
    example: '2026-09-28',
  }),
})

/** Query del selector de materias con turno: `fecha` (sin ella, hoy), como en la agenda. */
export const materiasConTurnoQuerySchema = fechaSelectorQuerySchema

export type MateriasConTurnoQuery = z.infer<typeof materiasConTurnoQuerySchema>

/**
 * Ítem del selector de materias con turno en una fecha (id y nombre, como el resto de los
 * selectores de catálogo). Es su propio componente porque vive en `agendas`: una feature no
 * importa la validation de otra.
 */
export const materiaConTurnoSchema = z
  .object({ id: z.number().int(), nombre: z.string() })
  .openapi('MateriaConTurno')

export type MateriaConTurno = z.infer<typeof materiaConTurnoSchema>

export const materiasConTurnoListadoSchema = z.array(materiaConTurnoSchema)

export type MateriasConTurnoListado = z.infer<typeof materiasConTurnoListadoSchema>

/** Query del selector de aulas con turno: `fecha` (sin ella, hoy), como en la agenda. */
export const aulasConTurnoQuerySchema = fechaSelectorQuerySchema

export type AulasConTurnoQuery = z.infer<typeof aulasConTurnoQuerySchema>

/**
 * Ítem del selector de aulas con turno en una fecha (id y nombre, como `aulas.validation.ts` →
 * `AulaGuardada` sin `capacidad`/`estado`). Es su propio componente porque vive en `agendas`.
 */
export const aulaConTurnoSchema = z
  .object({ id: z.number().int(), nombre: z.string() })
  .openapi('AulaConTurno')

export type AulaConTurno = z.infer<typeof aulaConTurnoSchema>

export const aulasConTurnoListadoSchema = z.array(aulaConTurnoSchema)

export type AulasConTurnoListado = z.infer<typeof aulasConTurnoListadoSchema>

// ---------------------------------------------------------------------------------------------
// Agenda propia del profesor (HU-10, T-25) y agenda de un profesor (T-44)
// ---------------------------------------------------------------------------------------------

/**
 * Query de la agenda propia: `desde` (sin ella, hoy) y `hasta` (sin ella, `desde`: un solo día).
 * El profesor no es un parámetro: sale del `Actor` de la sesión. Que el rango esté en orden y no
 * supere `MAX_DIAS_AGENDA` días lo decide el service (`validarRangoAgenda`), porque los dos
 * extremos pueden venir de un default que depende de hoy.
 */
export const agendaPropiaQuerySchema = z.object({
  desde: fechaISO.optional().openapi({
    param: { name: 'desde', in: 'query' },
    description: 'Primer día del rango (YYYY-MM-DD). Sin `desde`, el de hoy (zona del negocio)',
    example: '2026-09-28',
  }),
  hasta: fechaISO.optional().openapi({
    param: { name: 'hasta', in: 'query' },
    description:
      'Último día del rango, incluido (YYYY-MM-DD). Sin `hasta`, el mismo día que `desde`',
    example: '2026-10-04',
  }),
})

export type AgendaPropiaQuery = z.infer<typeof agendaPropiaQuerySchema>

/**
 * Query de la agenda de un profesor para mesa de entradas (T-44): el mismo rango que la agenda
 * propia más `profesorId`, obligatorio. La respuesta es la misma (`agendaPropiaListadoSchema`).
 */
export const agendaProfesorQuerySchema = agendaPropiaQuerySchema.extend({
  profesorId: idQuery('profesorId', 'Id del profesor (obligatorio)', 4),
})

export type AgendaProfesorQuery = z.infer<typeof agendaProfesorQuerySchema>

/**
 * Una **ocurrencia** de un turno propio en una fecha del rango: alumno, materia, aula, horario y
 * estado. Sin profesor (es el de la sesión) ni datos de otros profesores. `turnoId` se repite
 * entre fechas cuando el turno es recurrente: la ocurrencia se identifica por `turnoId` + `fecha`.
 */
export const agendaPropiaItemSchema = z
  .object({
    turnoId: z.number().int().openapi({ description: 'Id del turno (se repite en un recurrente)' }),
    fecha: fechaISO.openapi({ description: 'Fecha de la ocurrencia (YYYY-MM-DD)' }),
    diaSemana: diaSemana.openapi({ description: 'Día de la semana, ISO: 1 = lunes … 7 = domingo' }),
    horaInicio: horaHHmm,
    horaFin: horaHHmm,
    alumno: z.object({
      id: z.number().int(),
      apellido: z.string(),
      nombre: z.string(),
    }),
    materia: z.object({ id: z.number().int(), nombre: z.string() }),
    aula: z.object({ id: z.number().int(), nombre: z.string() }),
    tipo: z.enum(TIPOS_TURNO),
    estado: z.enum(ESTADOS_TURNO).openapi({
      description:
        'Siempre ACTIVO (la consulta excluye las canceladas); la UI lo muestra "Agendado"',
    }),
  })
  .openapi('AgendaPropiaItem')

export type AgendaPropiaItem = z.infer<typeof agendaPropiaItemSchema>

/**
 * Sin paginar (decisión T-43): el rango está acotado y es de un solo profesor. A pesar del nombre,
 * también es la respuesta de `GET /agendas/profesor` (T-44): la misma forma, con el profesor fijo
 * por `profesorId` en lugar de salir de la sesión.
 */
export const agendaPropiaListadoSchema = z.array(agendaPropiaItemSchema)

export type AgendaPropiaListado = z.infer<typeof agendaPropiaListadoSchema>
