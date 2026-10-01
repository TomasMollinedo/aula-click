import { z } from '@hono/zod-openapi'
import { PRIORIDADES } from '@/server/features/examenes/examenes.condiciones'
import { TIPOS_TURNO } from '@/server/features/turnos/ocurrencias.condiciones'
import { qBusqueda } from '@/server/shared/busqueda'
import { paginacionQuerySchema, paginatedSchema } from '@/server/shared/paginacion'
import { diaSemana, fechaISO, horaHHmm } from '@/server/shared/zod'

// Schemas Zod de entrada, salida y params de las agendas (salieron de `turnos` en T-30; T-57 las
// pasó a ocurrencias con estado, pago y prioridad, y sumó la agenda del centro). Son la fuente del
// OpenAPI. Sin reglas de negocio: el rango máximo y las fechas por defecto los decide el service.

// Valores de enums que ningún `*.condiciones.ts` publica como array (a diferencia de `TIPOS_TURNO`
// y `PRIORIDADES`): se declaran acá para no importar `@/generated/*` ni `turnos.reglas.ts` fuera de
// un repository (lo prohíbe ESLint). `ESTADOS_OCURRENCIA` es el de `turnos.reglas.ts` (definición
// F: sólo estos tres) y `ESTADOS_PAGO` el de `Ocurrencia.pago.estado`.
const ESTADOS_OCURRENCIA = ['AGENDADO', 'CANCELADO', 'SIN_REGISTRAR'] as const
const ESTADOS_PAGO = ['PENDIENTE', 'PAGADO'] as const
const TIPOS_EXAMEN = ['PARCIAL', 'FINAL', 'RECUPERATORIO', 'TRABAJO_PRACTICO', 'OTRO'] as const

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
 * Filtros de estado y prioridad (T-57), iguales en todas las agendas y combinables con los demás.
 * Filtrar por prioridad deja afuera las ocurrencias canceladas: no tienen.
 */
const filtrosEstadoYPrioridad = {
  estado: z
    .enum(ESTADOS_OCURRENCIA)
    .optional()
    .openapi({
      param: { name: 'estado', in: 'query' },
      description: 'Filtra por el estado de la ocurrencia',
      example: 'AGENDADO',
    }),
  prioridad: z
    .enum(PRIORIDADES)
    .optional()
    .openapi({
      param: { name: 'prioridad', in: 'query' },
      description:
        'Filtra por la prioridad del turno (HU-18). Las ocurrencias canceladas no tienen prioridad: no salen',
      example: 'ALTA',
    }),
}

const examenQueDeterminaSchema = z
  .object({
    id: z.number().int(),
    fecha: fechaISO,
    tipo: z.enum(TIPOS_EXAMEN),
    materiaNombre: z.string(),
    dias: z
      .number()
      .int()
      .openapi({ description: 'Días de la ocurrencia al examen (0 = el mismo día)' }),
  })
  .openapi('AgendaExamen')

/** Cupo de la clase de una ocurrencia (HU-19): lugares ocupados y capacidad de esa hora. */
const cupoSchema = z
  .object({
    ocupados: z.number().int().min(0).openapi({
      description:
        'Turnos que ocupan lugar en la clase (los cancelados no). Cuenta todos los turnos de la clase, no sólo los que pasaron los filtros de la agenda',
    }),
    capacidad: z.number().int().min(0).openapi({
      description: 'Capacidad efectiva de la hora: min(profesor.capacidad, aula.capacidad)',
    }),
  })
  .openapi('AgendaCupo')

/**
 * Lo que tiene toda ocurrencia de una agenda (T-57): qué turno, cuándo, quién, con qué estado, si
 * se pagó y su prioridad. `turnoId` se repite entre fechas cuando el turno es recurrente: la
 * ocurrencia se identifica por `turnoId` + `fecha`. Un turno reprogramado es un turno más (sin
 * `fechaOriginal` ni `reprogramada`, definiciones A y B). La agenda diaria y la del centro le
 * suman el profesor; las de un solo profesor no.
 */
const camposDeOcurrencia = {
  turnoId: z.number().int().openapi({ description: 'Id del turno (se repite en un recurrente)' }),
  fecha: fechaISO.openapi({ description: 'Fecha de la ocurrencia (YYYY-MM-DD)' }),
  bloqueAgendaId: z.number().int().openapi({
    description: 'Id del bloque de horario del profesor: con `fecha`, identifica la clase',
  }),
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
  estado: z.enum(ESTADOS_OCURRENCIA).openapi({
    description:
      'AGENDADO (de hoy o futura), SIN_REGISTRAR (pasada; la asistencia es de HU-22, próximo sprint) o CANCELADO',
  }),
  estadoPago: z.enum(ESTADOS_PAGO).openapi({
    description: 'PAGADO si la ocurrencia tiene un pago aplicado. Una cancelada nunca se cobró',
  }),
  prioridad: z
    .enum(PRIORIDADES)
    .nullable()
    .openapi({ description: 'null en una ocurrencia cancelada' }),
  examen: examenQueDeterminaSchema
    .nullable()
    .openapi({ description: 'El examen que determina la prioridad, si hay uno próximo' }),
  cupo: cupoSchema.openapi({
    description:
      'Cupo de la clase (`fecha` + `bloqueAgendaId`): el mismo para todas las ocurrencias de la clase. La clase está llena si `ocupados >= capacidad`',
  }),
}

/**
 * Query de la agenda diaria (T-23, decisiones T-35, T-36 y T-42): paginación + `fecha` (sin ella,
 * hoy) + filtros opcionales por materia, aula, profesor (por id), estado y prioridad + `q`
 * (búsqueda por nombre; de alumno o profesor, o sólo de alumno si ya se filtró por `profesorId`).
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
  ...filtrosEstadoYPrioridad,
})

export type AgendaQuery = z.infer<typeof agendaQuerySchema>

/**
 * Ítem de la agenda diaria y de la del centro: una ocurrencia con el profesor del bloque (en las
 * agendas de un solo profesor no hace falta: es el de la consulta).
 */
export const agendaItemSchema = z
  .object({
    ...camposDeOcurrencia,
    profesor: z.object({
      id: z.number().int(),
      apellido: z.string(),
      nombre: z.string(),
    }),
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
  ...filtrosEstadoYPrioridad,
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
 * Una **ocurrencia** de un turno de un profesor en una fecha del rango, con su estado, su pago y
 * su prioridad. Sin profesor (es el de la sesión o el de `profesorId`) ni datos de otros
 * profesores. Incluye las canceladas, con su estado y sin prioridad (HU-13).
 */
export const agendaPropiaItemSchema = z.object(camposDeOcurrencia).openapi('AgendaPropiaItem')

export type AgendaPropiaItem = z.infer<typeof agendaPropiaItemSchema>

/**
 * Sin paginar (decisión T-43): el rango está acotado y es de un solo profesor. A pesar del nombre,
 * también es la respuesta de `GET /agendas/profesor` (T-44): la misma forma, con el profesor fijo
 * por `profesorId` en lugar de salir de la sesión.
 */
export const agendaPropiaListadoSchema = z.array(agendaPropiaItemSchema)

export type AgendaPropiaListado = z.infer<typeof agendaPropiaListadoSchema>

// ---------------------------------------------------------------------------------------------
// Agenda del centro (T-57)
// ---------------------------------------------------------------------------------------------

/**
 * Query de la agenda del centro, para el calendario semanal: el rango es **obligatorio** (no hay
 * un día "de hoy" que asumir en una vista de varios días) y los filtros son opcionales. Que esté
 * en orden y no supere `MAX_DIAS_AGENDA` días lo decide el service (`validarRangoAgenda`).
 */
export const agendaCentroQuerySchema = z.object({
  desde: fechaISO.openapi({
    param: { name: 'desde', in: 'query' },
    description: 'Primer día del rango (YYYY-MM-DD)',
    example: '2026-09-28',
  }),
  hasta: fechaISO.openapi({
    param: { name: 'hasta', in: 'query' },
    description: 'Último día del rango, incluido (YYYY-MM-DD). Máximo 31 días desde `desde`',
    example: '2026-10-04',
  }),
  profesorId: idQuery('profesorId', 'Filtra por profesor', 3).optional(),
  materiaId: idQuery('materiaId', 'Filtra por materia', 2).optional(),
  aulaId: idQuery('aulaId', 'Filtra por aula', 1).optional(),
  ...filtrosEstadoYPrioridad,
})

export type AgendaCentroQuery = z.infer<typeof agendaCentroQuerySchema>

/**
 * Sin paginar, como las agendas de un profesor: el rango está acotado (31 días). Son las
 * ocurrencias de todos los profesores; agruparlas por clase (fecha + bloque) es presentación y
 * la hace el frontend.
 */
export const agendaCentroListadoSchema = z.array(agendaItemSchema)

export type AgendaCentroListado = z.infer<typeof agendaCentroListadoSchema>
