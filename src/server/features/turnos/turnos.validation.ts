import { z } from '@hono/zod-openapi'
import { auditoriaSchema } from '@/server/shared/auditoria'
import { qBusqueda } from '@/server/shared/busqueda'
import type { Estado } from '@/server/shared/estado'
import { paginacionQuerySchema, paginatedSchema } from '@/server/shared/paginacion'
import { diaSemana, diaSemanaQuery, fechaISO, horaHHmm, textoOpcional } from '@/server/shared/zod'

// Schemas Zod de entrada, salida y params. Son la fuente del OpenAPI. Sin reglas de negocio: que
// las fechas caigan en el día del bloque, la capacidad y los solapamientos los decide el service
// (con `turnos.reglas.ts`).

/** Valores del enum `TipoTurno` de Prisma. */
export const TIPOS_TURNO = ['RECURRENTE', 'SESION_UNICA'] as const
export type TipoTurno = (typeof TIPOS_TURNO)[number]

/** Valores del enum `EstadoTurno` de Prisma. La UI muestra `ACTIVO` como "Agendado". */
export const ESTADOS_TURNO = ['ACTIVO', 'CANCELADO'] as const
export type EstadoTurno = (typeof ESTADOS_TURNO)[number]

const MAX_HORAS_TURNO = 24
const MAX_MOTIVO = 500

function idQuery(name: string, description: string, example: number) {
  return z.coerce
    .number({ error: 'Debe ser un número' })
    .int({ error: 'Debe ser un número entero' })
    .positive({ error: 'Debe ser mayor a 0' })
    .openapi({ param: { name, in: 'query' }, description, example })
}

function idBody(description: string, example: number) {
  return z
    .number({ error: 'Debe ser un número' })
    .int({ error: 'Debe ser un número entero' })
    .positive({ error: 'Debe ser mayor a 0' })
    .openapi({ description, example })
}

// ---------------------------------------------------------------------------------------------
// Disponibilidad
// ---------------------------------------------------------------------------------------------

/**
 * Query de `GET /turnos/disponibilidad`: `materiaId` obligatorio; `diaSemana`, `profesorId` y
 * `fecha` opcionales y combinables. Que `fecha` no sea pasada ni contradiga a `diaSemana` lo
 * decide el service (depende de hoy).
 */
export const disponibilidadQuerySchema = z.object({
  materiaId: idQuery('materiaId', 'Id de la materia (obligatorio)', 3),
  diaSemana: diaSemanaQuery.optional().openapi({
    param: { name: 'diaSemana', in: 'query' },
    description: 'Día de la semana, ISO: 1 = lunes … 7 = domingo',
    example: 1,
  }),
  profesorId: idQuery('profesorId', 'Id del profesor', 4).optional(),
  fecha: fechaISO.optional().openapi({
    param: { name: 'fecha', in: 'query' },
    description:
      'Fecha (AAAA-MM-DD, hoy o posterior) para la que se calcula la ocupación; el día de la semana sale de ella. Sin `fecha`, la próxima ocurrencia de cada día (hoy incluido)',
    example: '2026-09-28',
  }),
})

export type DisponibilidadQuery = z.infer<typeof disponibilidadQuerySchema>

const profesorResumenSchema = z
  .object({ id: z.number().int(), nombre: z.string(), apellido: z.string() })
  .openapi('TurnoProfesor')

const aulaResumenSchema = z
  .object({ id: z.number().int(), nombre: z.string() })
  .openapi('TurnoAula')

/** Una hora (una fila de `bloque_agenda`) dentro de un resultado de disponibilidad. */
export const horaDisponibleSchema = z
  .object({
    bloqueId: z.number().int().openapi({ description: 'Id de la fila (hora)', example: 10 }),
    horaInicio: horaHHmm,
    horaFin: horaHHmm,
    capacidadEfectiva: z.number().int().openapi({
      description: 'min(profesor.capacidad, aula.capacidad), calculada al leer',
      example: 6,
    }),
    ocupacion: z.number().int().openapi({
      description: 'Turnos que ocupan lugar en esta hora en `fecha`',
      example: 6,
    }),
    lleno: z.boolean().openapi({ description: 'ocupacion >= capacidadEfectiva', example: true }),
  })
  .openapi('TurnoHoraDisponible')

/**
 * Un resultado de disponibilidad: horas contiguas del mismo profesor, día y aula (el "bloque" que
 * muestra la UI), cada una con su capacidad y su ocupación en `fecha`.
 */
export const disponibilidadItemSchema = z
  .object({
    profesor: profesorResumenSchema,
    diaSemana,
    fecha: fechaISO.openapi({
      description: 'Fecha de la ocupación: la pedida o la próxima ocurrencia del día',
      example: '2026-09-28',
    }),
    aula: aulaResumenSchema,
    horaInicio: horaHHmm,
    horaFin: horaHHmm,
    horas: z.array(horaDisponibleSchema),
  })
  .openapi('TurnoDisponibilidad')

export type DisponibilidadItem = z.infer<typeof disponibilidadItemSchema>

export const disponibilidadSchema = z.array(disponibilidadItemSchema)

// ---------------------------------------------------------------------------------------------
// Alta
// ---------------------------------------------------------------------------------------------

const motivoConsulta = textoOpcional(MAX_MOTIVO, 'Motivo de consulta', 'Repaso de funciones')

/**
 * Body de `POST /turnos`. Formato solamente: que las filas existan, sean del mismo profesor y día,
 * que las fechas caigan en ese día y no sean pasadas, la capacidad y los solapamientos los decide
 * el service.
 */
export const crearTurnoSchema = z
  .object({
    alumnoId: idBody('Id del alumno', 12),
    materiaId: idBody('Id de la materia', 3),
    bloqueIds: z
      .array(
        z
          .number({ error: 'Debe ser un número' })
          .int({ error: 'Debe ser un número entero' })
          .positive({ error: 'Debe ser mayor a 0' }),
        { error: 'Debe ser una lista de ids de bloques' },
      )
      .min(1, { error: 'Debe elegir al menos una hora' })
      .max(MAX_HORAS_TURNO, { error: `No puede elegir más de ${MAX_HORAS_TURNO} horas` })
      .superRefine((ids, ctx) => {
        ids.forEach((id, i) => {
          if (ids.indexOf(id) !== i) {
            ctx.addIssue({ code: 'custom', message: 'No puede repetir horas', path: [i] })
          }
        })
      })
      .openapi({
        description: 'Ids de las filas (horas) elegidas, del mismo profesor y día',
        example: [10, 12],
      }),
    tipo: z
      .enum(TIPOS_TURNO, { error: `Tipo inválido: debe ser ${TIPOS_TURNO.join(', ')}` })
      .openapi({ example: 'RECURRENTE' }),
    fechaInicio: fechaISO.openapi({
      description: 'Primera fecha (la única en una sesión única). Hoy o posterior',
      example: '2026-10-05',
    }),
    fechaFin: fechaISO
      .openapi({
        description:
          'RECURRENTE: última fecha, o null/omitido si no tiene fin. SESION_UNICA: si viene, igual a fechaInicio',
        example: '2026-11-30',
      })
      .nullable()
      .optional(),
    motivoConsulta,
    asignarDondeHayLugar: z
      .boolean({ error: 'Debe ser verdadero o falso' })
      .default(false)
      .openapi({
        description:
          'Con fechas sin lugar en un RECURRENTE, crearlo solo en las fechas con lugar (en tramos). En SESION_UNICA no cambia nada',
        example: false,
      }),
  })
  .superRefine((datos, ctx) => {
    if (datos.fechaFin === undefined || datos.fechaFin === null) return
    if (datos.tipo === 'SESION_UNICA' && datos.fechaFin !== datos.fechaInicio) {
      ctx.addIssue({
        code: 'custom',
        message: 'En una sesión única, la fecha de fin debe ser igual a la de inicio',
        path: ['fechaFin'],
      })
    }
    // `YYYY-MM-DD`: la comparación de textos es la de fechas.
    if (datos.tipo === 'RECURRENTE' && datos.fechaFin < datos.fechaInicio) {
      ctx.addIssue({
        code: 'custom',
        message: 'La fecha de fin no puede ser anterior a la de inicio',
        path: ['fechaFin'],
      })
    }
  })
  .openapi('TurnoCrear')

export type CrearTurno = z.infer<typeof crearTurnoSchema>

/** `turnoId` del path. */
export const turnoIdParamsSchema = z.object({
  turnoId: z.coerce
    .number({ error: 'Debe ser un número' })
    .int({ error: 'Debe ser un número entero' })
    .positive({ error: 'Debe ser mayor a 0' })
    .openapi({ param: { name: 'turnoId', in: 'path' }, description: 'Id del turno', example: 55 }),
})

/** Detalle de un turno (una hora, un rango de fechas). */
export const turnoDetalleSchema = z
  .object({
    id: z.number().int(),
    tipo: z.enum(TIPOS_TURNO),
    estado: z.enum(ESTADOS_TURNO).openapi({
      description: 'ACTIVO se muestra como "Agendado" en la UI (no es otro valor del enum)',
    }),
    fechaInicio: fechaISO.openapi({ example: '2026-10-05' }),
    fechaFin: fechaISO
      .openapi({ description: 'null en un recurrente sin fin', example: '2026-10-19' })
      .nullable(),
    diaSemana,
    horaInicio: horaHHmm,
    horaFin: horaHHmm,
    bloqueId: z.number().int(),
    alumno: z
      .object({
        id: z.number().int(),
        nombre: z.string(),
        apellido: z.string(),
        dni: z.string(),
      })
      .openapi('TurnoAlumno'),
    profesor: profesorResumenSchema,
    materia: z.object({ id: z.number().int(), nombre: z.string() }).openapi('TurnoMateria'),
    aula: aulaResumenSchema,
    motivoConsulta: z.string().nullable(),
    ...auditoriaSchema.shape,
  })
  .openapi('TurnoDetalle')

export type TurnoDetalle = z.infer<typeof turnoDetalleSchema>

/** Fechas en las que una hora pedida no tiene lugar y no se creó el turno. */
export const fechasSinTurnoSchema = z
  .object({
    bloqueId: z.number().int(),
    horaInicio: horaHHmm,
    horaFin: horaHHmm,
    fechas: z.array(fechaISO).openapi({ example: ['2026-10-26'] }),
    completoDesde: fechaISO
      .openapi({
        description: 'Desde esta fecha todas las siguientes están completas (o null)',
        example: '2026-11-30',
      })
      .nullable(),
  })
  .openapi('TurnoFechasSinTurno')

export type FechasSinTurno = z.infer<typeof fechasSinTurnoSchema>

/** Respuesta del alta: los turnos creados (uno por hora y tramo) y las fechas salteadas. */
export const turnosAltaSchema = z
  .object({
    cantidad: z.number().int().openapi({
      description: 'Filas creadas: puede ser mayor que la cantidad de horas (tramos)',
      example: 3,
    }),
    turnos: z.array(turnoDetalleSchema),
    fechasSinTurno: z.array(fechasSinTurnoSchema),
  })
  .openapi('TurnosAlta')

export type TurnosAlta = z.infer<typeof turnosAltaSchema>

// ---------------------------------------------------------------------------------------------
// Agenda diaria (T-23)
// ---------------------------------------------------------------------------------------------

/**
 * Query de la agenda diaria (T-23, decisiones T-35 y T-36): paginación + `fecha` (sin ella, hoy) +
 * filtros opcionales por materia y aula (por id) + `q` (búsqueda por nombre de alumno o profesor).
 */
export const agendaQuerySchema = paginacionQuerySchema.extend({
  fecha: fechaISO.optional().openapi({
    param: { name: 'fecha', in: 'query' },
    description: 'Día a consultar (YYYY-MM-DD). Sin fecha, el de hoy (zona del negocio)',
    example: '2026-09-28',
  }),
  q: qBusqueda.openapi({
    description:
      'Búsqueda por palabras sobre el nombre del alumno o del profesor (decisión T-36): todas las palabras deben coincidir en el mismo, alumno o profesor. No distingue mayúsculas ni tildes',
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

// ---------------------------------------------------------------------------------------------
// Tipos internos (no viajan por HTTP así)
// ---------------------------------------------------------------------------------------------

/** Cantidad de turnos vigentes de una materia. No viaja por HTTP: la leen otras features. */
export type TurnosVigentesPorMateria = { materiaId: number; cantidad: number }

/**
 * Turno vigente de un profesor, con los datos que HU-06 pide mostrar antes de la baja: alumno,
 * materia, fechas y horario (del bloque). `fecha` es `fechaInicio` (se conserva por compatibilidad
 * con el frontend); `fechaFin` es `null` en un recurrente sin fin. No viaja por HTTP desde acá:
 * `profesores` lo usa en el `details` del 409 TURNOS_VIGENTES.
 */
export type TurnoVigentePorProfesor = {
  alumno: { id: number; nombre: string; apellido: string }
  materia: { id: number; nombre: string }
  tipo: TipoTurno
  fecha: string
  fechaFin: string | null
  horaInicio: string
  horaFin: string
}

/** Cantidad de turnos vigentes de una fila de `bloque_agenda`. No viaja por HTTP. */
export type TurnosVigentesPorBloque = { bloqueAgendaId: number; cantidad: number }

/**
 * Turnos que ocupan lugar en una fila de `bloque_agenda` en una fecha (`YYYY-MM-DD`). No viaja
 * por HTTP: lo leen `bloques` (horario) y `turnos` (disponibilidad).
 */
export type OcupacionPorBloque = { bloqueAgendaId: number; fecha: string; cantidad: number }

/**
 * Ocupación simultánea máxima de una hora del profesor desde hoy: la fecha en que más turnos
 * ocupan lugar a la vez y cuántos son. No viaja por HTTP así: la lee `profesores` para decidir
 * `CAPACIDAD_INSUFICIENTE` (T-15).
 */
export type OcupacionMaximaPorFila = {
  bloqueId: number
  diaSemana: number
  horaInicio: string
  horaFin: string
  fecha: string
  cantidad: number
}

/** Lo mínimo de un turno para decidir si ocupa lugar en una fecha (fechas `YYYY-MM-DD`). */
export type TurnoFechas = { estado: EstadoTurno; fechaInicio: string; fechaFin: string | null }

/** Lo que el service le pasa a `turnosRepository.reservar` para bloquear y leer. */
export type EntradaReserva = {
  alumnoId: number
  profesorId: number
  materiaId: number
  bloqueIds: number[]
  fechaInicio: string
  fechaFin: string | null
}

/** Una fila de `bloque_agenda` leída bajo lock (horas en minutos). */
export type FilaBloqueado = {
  id: number
  estado: Estado
  profesorId: number
  diaSemana: number
  horaInicio: number
  horaFin: number
  aulaCapacidad: number
}

/** Turno del alumno que se superpone con lo pedido, con lo que el `details` necesita mostrar. */
export type TurnoDelAlumno = TurnoFechas & {
  id: number
  tipo: TipoTurno
  diaSemana: number
  horaInicio: number
  horaFin: number
  profesor: { id: number; nombre: string; apellido: string }
  materia: { id: number; nombre: string }
}

/**
 * Lo que `reservar` lee con los locks tomados y le pasa a `planificar`. `profesor` es `null` si no
 * existe; `materia` también; `asignacion` es `null` si el par profesor–materia no existe.
 */
export type SnapshotReserva = {
  filas: FilaBloqueado[]
  profesor: { id: number; capacidad: number; estado: Estado } | null
  materia: { id: number; estado: Estado } | null
  asignacion: { estado: Estado } | null
  /** Turnos `ACTIVO` de las filas pedidas que se cruzan con el rango pedido. */
  ocupantes: (TurnoFechas & { bloqueAgendaId: number })[]
  /** Turnos `ACTIVO` del alumno en el mismo día y horas, cruzados con el rango pedido. */
  turnosAlumno: TurnoDelAlumno[]
}

/** Una fila `turno` a insertar (sin auditoría: la completa el repository con el actor). */
export type TurnoNuevo = {
  bloqueAgendaId: number
  alumnoId: number
  materiaId: number
  tipo: TipoTurno
  estado: 'ACTIVO'
  fechaInicio: string
  fechaFin: string | null
  motivoConsulta: string | null
}

/** Lo que decide `planificar`: qué insertar y qué fechas quedaron sin turno. */
export type PlanReserva = { turnos: TurnoNuevo[]; fechasSinTurno: FechasSinTurno[] }
