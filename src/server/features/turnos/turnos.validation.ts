import { z } from '@hono/zod-openapi'
import { paginacionQuerySchema, paginatedSchema } from '@/server/shared/paginacion'
import { fechaISO, horaHHmm } from '@/server/shared/zod'

// Schemas Zod de entrada, salida y params. Son la fuente del OpenAPI. Sin reglas de negocio.

/** Cantidad de turnos vigentes de una materia. No viaja por HTTP: la leen otras features. */
export type TurnosVigentesPorMateria = { materiaId: number; cantidad: number }

/**
 * Turno vigente de un profesor, con los datos que HU-06 pide mostrar antes de la baja: alumno,
 * materia, fecha y horario (del bloque). No viaja por HTTP desde acá: `profesores` lo usa en el
 * `details` del 409 TURNOS_VIGENTES.
 */
export type TurnoVigentePorProfesor = {
  alumno: { id: number; nombre: string; apellido: string }
  materia: { id: number; nombre: string }
  fecha: string
  horaInicio: string
  horaFin: string
}

/** Cantidad de turnos vigentes de una fila de `bloque_agenda`. No viaja por HTTP. */
export type TurnosVigentesPorBloque = { bloqueAgendaId: number; cantidad: number }

/**
 * Turnos que ocupan lugar en una fila de `bloque_agenda` en una fecha (`YYYY-MM-DD`). No viaja
 * por HTTP: lo lee `bloques` para la ocupación del horario.
 */
export type OcupacionPorBloque = { bloqueAgendaId: number; fecha: string; cantidad: number }

/** Valores del enum `EstadoTurno` de Prisma (T-20): propio de turnos, no es la baja lógica genérica
 * de `shared/estado.ts` (que es `ACTIVO` / `INACTIVO`). */
export const ESTADOS_TURNO = ['ACTIVO', 'CANCELADO'] as const

/**
 * Query de la agenda diaria (T-23, decisión T-35): paginación + `fecha` (sin ella, hoy) + filtros
 * opcionales por materia, aula, profesor y alumno.
 */
export const agendaQuerySchema = paginacionQuerySchema.extend({
  fecha: fechaISO.optional().openapi({
    param: { name: 'fecha', in: 'query' },
    description: 'Día a consultar (YYYY-MM-DD). Sin fecha, el de hoy (zona del negocio)',
    example: '2026-09-28',
  }),
  materiaId: z.coerce
    .number({ error: 'Debe ser un número' })
    .int({ error: 'Debe ser un número entero' })
    .positive({ error: 'Debe ser mayor a 0' })
    .optional()
    .openapi({
      param: { name: 'materiaId', in: 'query' },
      description: 'Filtra por materia',
      example: 2,
    }),
  aulaId: z.coerce
    .number({ error: 'Debe ser un número' })
    .int({ error: 'Debe ser un número entero' })
    .positive({ error: 'Debe ser mayor a 0' })
    .optional()
    .openapi({
      param: { name: 'aulaId', in: 'query' },
      description: 'Filtra por aula',
      example: 1,
    }),
  profesorId: z.coerce
    .number({ error: 'Debe ser un número' })
    .int({ error: 'Debe ser un número entero' })
    .positive({ error: 'Debe ser mayor a 0' })
    .optional()
    .openapi({
      param: { name: 'profesorId', in: 'query' },
      description: 'Filtra por profesor',
      example: 3,
    }),
  alumnoId: z.coerce
    .number({ error: 'Debe ser un número' })
    .int({ error: 'Debe ser un número entero' })
    .positive({ error: 'Debe ser mayor a 0' })
    .optional()
    .openapi({
      param: { name: 'alumnoId', in: 'query' },
      description: 'Filtra por alumno',
      example: 12,
    }),
})

export type AgendaQuery = z.infer<typeof agendaQuerySchema>

/** Ítem de la agenda: alumno, profesor, materia, aula, horario y estado (siempre `ACTIVO`: la
 * consulta excluye los `CANCELADO`, dominio.md → Turnos). Sin `fecha`: es la misma para toda la página. */
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

/** Query del selector de materias con turno: `fecha` (sin ella, hoy), como en la agenda. */
export const materiasConTurnoQuerySchema = z.object({
  fecha: fechaISO.optional().openapi({
    param: { name: 'fecha', in: 'query' },
    description: 'Día a consultar (YYYY-MM-DD). Sin fecha, el de hoy (zona del negocio)',
    example: '2026-09-28',
  }),
})

export type MateriasConTurnoQuery = z.infer<typeof materiasConTurnoQuerySchema>

/**
 * Ítem del selector de materias con turno en una fecha (id y nombre, como el resto de los
 * selectores de catálogo: `materias.validation.ts` → `MateriaSelectorItem`). Es su propio
 * componente porque vive en `turnos`: una feature no importa la validation de otra.
 */
export const materiaConTurnoSchema = z
  .object({ id: z.number().int(), nombre: z.string() })
  .openapi('MateriaConTurno')

export type MateriaConTurno = z.infer<typeof materiaConTurnoSchema>

export const materiasConTurnoListadoSchema = z.array(materiaConTurnoSchema)

export type MateriasConTurnoListado = z.infer<typeof materiasConTurnoListadoSchema>

/** Query del selector de profesores con turno: `fecha` (sin ella, hoy), como en la agenda. */
export const profesoresConTurnoQuerySchema = z.object({
  fecha: fechaISO.optional().openapi({
    param: { name: 'fecha', in: 'query' },
    description: 'Día a consultar (YYYY-MM-DD). Sin fecha, el de hoy (zona del negocio)',
    example: '2026-09-28',
  }),
})

export type ProfesoresConTurnoQuery = z.infer<typeof profesoresConTurnoQuerySchema>

/**
 * Ítem del selector de profesores con turno en una fecha: `apellido` y `nombre` por separado
 * (como en el resto de la API: `AgendaItem.profesor`, `ProfesorListadoItem`), no un nombre
 * completo armado. Es su propio componente porque vive en `turnos`.
 */
export const profesorConTurnoSchema = z
  .object({ id: z.number().int(), apellido: z.string(), nombre: z.string() })
  .openapi('ProfesorConTurno')

export type ProfesorConTurno = z.infer<typeof profesorConTurnoSchema>

export const profesoresConTurnoListadoSchema = z.array(profesorConTurnoSchema)

export type ProfesoresConTurnoListado = z.infer<typeof profesoresConTurnoListadoSchema>

/** Query del selector de aulas con turno: `fecha` (sin ella, hoy), como en la agenda. */
export const aulasConTurnoQuerySchema = z.object({
  fecha: fechaISO.optional().openapi({
    param: { name: 'fecha', in: 'query' },
    description: 'Día a consultar (YYYY-MM-DD). Sin fecha, el de hoy (zona del negocio)',
    example: '2026-09-28',
  }),
})

export type AulasConTurnoQuery = z.infer<typeof aulasConTurnoQuerySchema>

/**
 * Ítem del selector de aulas con turno en una fecha (id y nombre, como `aulas.validation.ts` →
 * `AulaGuardada` sin `capacidad`/`estado`). Es su propio componente porque vive en `turnos`.
 */
export const aulaConTurnoSchema = z
  .object({ id: z.number().int(), nombre: z.string() })
  .openapi('AulaConTurno')

export type AulaConTurno = z.infer<typeof aulaConTurnoSchema>

export const aulasConTurnoListadoSchema = z.array(aulaConTurnoSchema)

export type AulasConTurnoListado = z.infer<typeof aulasConTurnoListadoSchema>
