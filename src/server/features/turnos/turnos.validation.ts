import { z } from '@hono/zod-openapi'
import { auditoriaSchema } from '@/server/shared/auditoria'
import type { Estado } from '@/server/shared/estado'
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
const MAX_OBSERVACIONES = 500
const MAX_TEMAS = 500

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

const materiaResumenSchema = z
  .object({ id: z.number().int(), nombre: z.string() })
  .openapi('TurnoMateria')

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

// T-29 renombró la columna motivo_consulta a observaciones; "temas a trabajar" lo agrega HU-08
// (Sprint 2): opcional en RECURRENTE, obligatorio en SESION_UNICA (ver el superRefine de abajo).
const observaciones = textoOpcional(MAX_OBSERVACIONES, 'Observaciones', 'Repaso de funciones')
const temas = textoOpcional(MAX_TEMAS, 'Temas a trabajar', 'Fracciones y ecuaciones')

/**
 * Campos del alta comunes a la mesa (`POST /turnos`) y al portal (`POST /turnos/mis-turnos`):
 * todos salvo el alumno, que la mesa elige y el portal toma de la sesión, y las observaciones,
 * que son internas de la mesa de entrada.
 */
const camposAlta = {
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
  temas,
  asignarDondeHayLugar: z.boolean({ error: 'Debe ser verdadero o falso' }).default(false).openapi({
    description:
      'Con fechas sin lugar en un RECURRENTE, crearlo solo en las fechas con lugar (en tramos). En SESION_UNICA no cambia nada',
    example: false,
  }),
}

/** Reglas de formato entre campos del alta (las mismas para la mesa y el portal). */
function refinarAlta(
  datos: {
    tipo: TipoTurno
    fechaInicio: string
    fechaFin?: string | null
    temas?: string | null
  },
  ctx: z.RefinementCtx,
) {
  if (datos.tipo === 'SESION_UNICA' && (datos.temas === null || datos.temas === undefined)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Los temas a trabajar son obligatorios en una sesión única',
      path: ['temas'],
    })
  }
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
}

/**
 * Body de `POST /turnos`. Formato solamente: que las filas existan, sean del mismo profesor y día,
 * que las fechas caigan en ese día y no sean pasadas, la capacidad y los solapamientos los decide
 * el service.
 */
export const crearTurnoSchema = z
  .object({ alumnoId: idBody('Id del alumno', 12), ...camposAlta, observaciones })
  .superRefine(refinarAlta)
  .openapi('TurnoCrear')

export type CrearTurno = z.infer<typeof crearTurnoSchema>

/**
 * Body de `POST /turnos/mis-turnos` (portal, HU-29): el de `POST /turnos` sin `alumnoId`, que
 * sale de la sesión (un `alumnoId` en el body se descarta, como toda clave desconocida), y sin
 * `observaciones`, que son internas de la mesa de entrada y el alumno no ve. Que las fechas sean
 * desde mañana lo decide el service (depende de hoy).
 */
export const crearMiTurnoSchema = z
  .object(camposAlta)
  .superRefine(refinarAlta)
  .openapi('MiTurnoCrear')

export type CrearMiTurno = z.infer<typeof crearMiTurnoSchema>

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
    materia: materiaResumenSchema,
    aula: aulaResumenSchema,
    observaciones: z.string().nullable(),
    temas: z.string().nullable(),
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
// Portal del alumno (HU-29): `/turnos/mis-turnos/*`
// ---------------------------------------------------------------------------------------------

/** Deuda vencida (HU-29): turnos adeudados de hace 30 días o más y su total en pesos. */
export const deudaVencidaSchema = z
  .object({
    cantidad: z.number().int().openapi({
      description: 'Turnos adeudados de hace 30 días o más (también los de materia sin precio)',
      example: 3,
    }),
    total: z.number().openapi({
      description: 'Su total en pesos (los de materia sin precio no suman)',
      example: 24000,
    }),
  })
  .openapi('DeudaVencida')

export type DeudaVencida = z.infer<typeof deudaVencidaSchema>

/** `GET /turnos/mis-turnos/habilitacion`: si el alumno de la sesión puede sacar un turno nuevo. */
export const habilitacionSchema = z
  .object({
    habilitado: z.boolean().openapi({
      description: 'false si tiene deuda vencida (el tope de deuda, HU-29)',
      example: false,
    }),
    deuda: deudaVencidaSchema
      .nullable()
      .openapi({ description: 'La deuda vencida, o null si no tiene' }),
  })
  .openapi('MisTurnosHabilitacion')

export type Habilitacion = z.infer<typeof habilitacionSchema>

/** Una materia que el alumno puede elegir en el paso 1 de "Sacar turno". */
export const materiaOfertadaSchema = z
  .object({ id: z.number().int(), nombre: z.string() })
  .openapi('MisTurnosMateria')

export type MateriaOfertada = z.infer<typeof materiaOfertadaSchema>

export const materiasOfertadasSchema = z.array(materiaOfertadaSchema)

/**
 * Query de `GET /turnos/mis-turnos/disponibilidad`: el mismo de `GET /turnos/disponibilidad`
 * (materia obligatoria; día, profesor y fecha opcionales). La `fecha`, si viene, es desde mañana.
 */
export const miDisponibilidadQuerySchema = disponibilidadQuerySchema

/**
 * Una hora para el alumno: sólo si se puede elegir. Sin capacidad ni ocupación (el alumno no ve
 * cuántos lugares hay ni quiénes están anotados, HU-29).
 */
export const miHoraDisponibleSchema = z
  .object({
    bloqueId: z.number().int().openapi({ description: 'Id de la fila (hora)', example: 10 }),
    horaInicio: horaHHmm,
    horaFin: horaHHmm,
    disponible: z.boolean().openapi({
      description: 'false si la hora está completa en `fecha` ("Completo": no se puede elegir)',
      example: true,
    }),
  })
  .openapi('MisTurnosHora')

/** Un resultado de la disponibilidad del portal: como el de la mesa, con el valor por clase. */
export const miDisponibilidadItemSchema = z
  .object({
    profesor: profesorResumenSchema,
    diaSemana,
    fecha: fechaISO.openapi({
      description:
        'Fecha de la disponibilidad: la pedida o la próxima ocurrencia del día desde mañana',
      example: '2026-09-28',
    }),
    aula: aulaResumenSchema,
    horaInicio: horaHHmm,
    horaFin: horaHHmm,
    valorPorClase: z.number().nullable().openapi({
      description:
        'Precio por hora vigente de la materia (HU-12), o null si no tiene. Se abona en la mesa de entrada',
      example: 8000,
    }),
    horas: z.array(miHoraDisponibleSchema),
  })
  .openapi('MisTurnosDisponibilidad')

export type MiDisponibilidadItem = z.infer<typeof miDisponibilidadItemSchema>

export const miDisponibilidadSchema = z.array(miDisponibilidadItemSchema)

/** Un turno creado por el alumno, sin observaciones ni auditoría. */
const miTurnoCreadoSchema = z
  .object({
    id: z.number().int(),
    bloqueId: z.number().int(),
    horaInicio: horaHHmm,
    horaFin: horaHHmm,
    fechaInicio: fechaISO.openapi({ example: '2026-10-05' }),
    fechaFin: fechaISO
      .openapi({ description: 'null en un recurrente sin fin', example: '2026-11-30' })
      .nullable(),
  })
  .openapi('MiTurnoCreado')

/**
 * Respuesta de `POST /turnos/mis-turnos`: lo que la UI muestra en "Turno reservado". Sin lo que el
 * alumno no ve (observaciones, auditoría, cupos ni ocupación).
 */
export const turnoReservadoSchema = z
  .object({
    cantidad: z.number().int().openapi({
      description: 'Turnos creados: uno por hora y por tramo',
      example: 1,
    }),
    tipo: z.enum(TIPOS_TURNO),
    diaSemana,
    materia: materiaResumenSchema,
    profesor: profesorResumenSchema,
    aula: aulaResumenSchema,
    temas: z.string().nullable(),
    turnos: z.array(miTurnoCreadoSchema),
    fechasSinTurno: z.array(fechasSinTurnoSchema),
  })
  .openapi('MiTurnoReservado')

export type TurnoReservado = z.infer<typeof turnoReservadoSchema>

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

/** Estado y rango guardado de un turno (fechas `YYYY-MM-DD`; `fechaFin` null = sin fin). */
export type TurnoFechas = { estado: EstadoTurno; fechaInicio: string; fechaFin: string | null }

/**
 * Lo mínimo de una serie para decidir si ocupa lugar en una fecha (docs/convenciones-backend.md →
 * Ocurrencias): su estado, su inicio, su **fin efectivo** (`finEfectivo` de `turnos.reglas.ts`:
 * `fechaFin` acotada por la finalización; `null` = sin fin) y sus fechas canceladas
 * (`CancelacionTurno`), todas `YYYY-MM-DD`.
 */
export type SerieFechas = {
  estado: EstadoTurno
  fechaInicio: string
  finEfectivo: string | null
  canceladas: readonly string[]
}

/**
 * Lo que el service le pasa a `turnosRepository.reservar` para bloquear y leer. `hoy` es el del
 * reloj del service: con él se lee la deuda vencida del alumno dentro de la transacción (HU-29).
 */
export type EntradaReserva = {
  hoy: string
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

/**
 * Turno del alumno que se superpone con lo pedido (`superposicionesDelAlumno`), con lo que el
 * `details` necesita mostrar. `fechaFin` es la guardada (no el fin efectivo), como en el Sprint 1.
 */
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
  /**
   * Series `ACTIVO` de las filas pedidas que se cruzan con el rango pedido, con su fin efectivo y
   * sus fechas canceladas (`leerSeries`).
   */
  ocupantes: (SerieFechas & { bloqueAgendaId: number })[]
  /**
   * Turnos del alumno que chocan con el pedido en alguna fecha no cancelada y dentro de su fin
   * efectivo (`superposicionesDelAlumno`), del mismo día y de alguna hora del rango pedido.
   */
  turnosAlumno: TurnoDelAlumno[]
}

/**
 * Lo que `reservar` le pasa a su callback: el snapshot de `planificarReserva` más la deuda vencida
 * del alumno (`deudaVencida` de `cuentas.condiciones`, T-76), leída con el lock del alumno tomado:
 * el tope de deuda (HU-29) decide con este dato antes de planificar.
 */
export type SnapshotAlta = SnapshotReserva & { deudaVencida: DeudaVencida }

/** Una fila `turno` a insertar (sin auditoría: la completa el repository con el actor). */
export type TurnoNuevo = {
  bloqueAgendaId: number
  alumnoId: number
  materiaId: number
  tipo: TipoTurno
  estado: 'ACTIVO'
  fechaInicio: string
  fechaFin: string | null
  observaciones: string | null
  temas: string | null
  /**
   * La serie del alta (decisión T-103): la misma en todas las filas de un `RECURRENTE`; `null` en
   * una sesión única.
   */
  serieId: string | null
}

/** Lo que decide `planificar`: qué insertar y qué fechas quedaron sin turno. */
export type PlanReserva = { turnos: TurnoNuevo[]; fechasSinTurno: FechasSinTurno[] }
