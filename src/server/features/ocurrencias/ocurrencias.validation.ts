import { z } from '@hono/zod-openapi'
import { PRIORIDADES } from '@/server/features/examenes/examenes.condiciones'
import { ESTADOS_OCURRENCIA, TIPOS_TURNO } from '@/server/features/turnos/ocurrencias.condiciones'
import { ROLES } from '@/server/shared/actor'
import { auditoriaSchema, usuarioAuditoriaSchema } from '@/server/shared/auditoria'
import { diaSemana, fechaISO, horaHHmm } from '@/server/shared/zod'

// Valores de enums que ningún `*.condiciones.ts` publica como array (a diferencia de `TIPOS_TURNO`
// y `ESTADOS_OCURRENCIA`): se declaran acá para no importar `@/generated/*` ni `turnos.reglas.ts`
// fuera de un repository (lo prohíbe ESLint). `ESTADOS_OCURRENCIA` (el estado de una ocurrencia,
// T-74) es distinto del `Turno.estado` de `ESTADOS_TURNO`, que es ACTIVO/CANCELADO.
/** Los de `Ocurrencia.pago.estado` (`EstadoPagoOcurrencia` del motor). */
const ESTADOS_PAGO = ['PENDIENTE', 'PAGADO'] as const
/** Los de `Ocurrencia.asistencia.estado` (`EstadoAsistencia` del motor). */
const ESTADOS_ASISTENCIA = ['PRESENTE', 'AUSENTE'] as const
const MOTIVOS_CANCELACION = [
  'CANCELACION_ALUMNO',
  'CANCELACION_PROFESOR',
  'PROBLEMA_ADMINISTRATIVO',
  'OTRO',
] as const

// Schemas Zod de `ocurrencias` (T-43). Son la fuente del OpenAPI. Sin reglas de negocio: los
// defaults y el rango máximo de `GET /ocurrencias` los decide el service (`ocurrencias.reglas.ts`),
// igual que el resto de las agendas.

// ---------------------------------------------------------------------------------------------
// GET /ocurrencias/{turnoId}/{fecha}
// ---------------------------------------------------------------------------------------------

export const ocurrenciaParamsSchema = z.object({
  turnoId: z.coerce
    .number({ error: 'Debe ser un número' })
    .int({ error: 'Debe ser un número entero' })
    .positive({ error: 'Debe ser mayor a 0' })
    .openapi({ param: { name: 'turnoId', in: 'path' }, description: 'Id del turno', example: 12 }),
  fecha: fechaISO.openapi({
    param: { name: 'fecha', in: 'path' },
    description: 'Fecha de la ocurrencia (YYYY-MM-DD)',
    example: '2026-10-05',
  }),
})

export type OcurrenciaParams = z.infer<typeof ocurrenciaParamsSchema>

const accionCancelarSchema = z
  .object({
    visible: z.boolean(),
    habilitada: z.boolean(),
    motivo: z.string().optional().openapi({
      description: 'Por qué está deshabilitada. Sólo viene con `visible` y sin `habilitada`',
      example: 'El turno está pagado: no se puede cancelar',
    }),
  })
  .openapi('AccionCancelar')

const accionSimpleSchema = z.object({ visible: z.boolean() }).openapi('AccionSimple')

const accionesSchema = z
  .object({
    cancelar: accionCancelarSchema,
    finalizar: accionSimpleSchema,
    reprogramar: accionSimpleSchema,
    registrarPago: accionSimpleSchema,
    registrarAsistencia: accionSimpleSchema.openapi({
      description:
        'Sólo para el profesor del turno, con el plazo de asistencia abierto. Registrar y corregir usan `PUT /asistencias`',
    }),
  })
  .openapi('Acciones')

const finalizacionSchema = z
  .object({
    fechaDesde: fechaISO.openapi({ description: 'Desde qué fecha quedó finalizada la serie' }),
    motivo: z.enum(MOTIVOS_CANCELACION),
    detalle: z.string().nullable(),
    createdBy: auditoriaSchema.shape.createdBy,
    createdAt: auditoriaSchema.shape.createdAt,
  })
  .openapi('Finalizacion')

const serieSchema = z
  .object({
    fechaInicio: fechaISO,
    fechaFin: fechaISO.nullable().openapi({ description: 'null en un recurrente sin fin' }),
    finalizacion: finalizacionSchema.nullable(),
  })
  .openapi('Serie')

const cancelacionSchema = z
  .object({
    motivo: z.enum(MOTIVOS_CANCELACION),
    detalle: z.string().nullable(),
    createdBy: auditoriaSchema.shape.createdBy,
    createdAt: auditoriaSchema.shape.createdAt,
  })
  .openapi('Cancelacion')

const pagoPendienteSchema = z
  .object({
    estado: z.literal('PENDIENTE'),
    importeVigente: z.number().nullable().openapi({
      description:
        'Precio por hora vigente de la materia, en pesos: lo que se cobraría hoy. `null` si la materia no tiene precio',
      example: 8000,
    }),
  })
  .openapi('PagoDeOcurrenciaPendiente')

const pagoHechoSchema = z
  .object({
    estado: z.literal('PAGADO'),
    pagoId: z.number().int().openapi({ description: 'Id del pago (`GET /pagos/{id}`)' }),
    numeroComprobante: z.number().int(),
    importe: z.number().openapi({
      description: 'Importe aplicado al pagar (no cambia si después cambia el precio)',
      example: 8000,
    }),
    formaPago: z.object({ id: z.number().int(), nombre: z.string() }),
    fechaPago: fechaISO,
    registradoPor: usuarioAuditoriaSchema,
    registradoEl: z.iso.datetime().openapi({
      description: 'Instante del registro, ISO 8601 en UTC',
      example: '2026-10-05T14:30:00.000Z',
    }),
  })
  .openapi('PagoDeOcurrenciaPagado')

/** El pago de la ocurrencia: pendiente con lo que costaría, o pagado con los datos de su pago. */
const pagoSchema = z.discriminatedUnion('estado', [pagoPendienteSchema, pagoHechoSchema])

const examenQueDeterminaSchema = z
  .object({
    id: z.number().int(),
    fecha: fechaISO,
    materiaNombre: z.string(),
    dias: z.number().int(),
  })
  .openapi('ExamenQueDetermina')

/**
 * Plazo para registrar la asistencia, tal como lo da el motor (`plazoDeAsistencia`). Sin nombre de
 * componente: `PlazoAsistencia` ya es el de `asistencias`.
 */
const plazoAsistenciaSchema = z
  .object({
    vence: fechaISO.openapi({
      description: 'Último día para registrar o corregir la asistencia (hasta las 23:59)',
    }),
    vencido: z.boolean().openapi({ description: 'Ya pasó `vence`' }),
  })
  .nullable()
  .openapi({ description: '`null` en una ocurrencia cancelada o posterior a hoy' })

const instanteAsistencia = z.iso.datetime().nullable().openapi({
  description: 'Instante ISO 8601 en UTC. `null` en una cerrada por el sistema',
  example: '2026-10-05T14:30:00.000Z',
})

/**
 * La asistencia de **esa hora** (T-84): registrada (`REALIZADO` o `AUSENTE`), con su auditoría, o
 * cerrada por el sistema (un "Sin registrar" con el plazo vencido, sin estado ni personas: la fecha
 * del cierre es `plazoAsistencia.vence`, decisión T-138).
 */
const asistenciaSchema = z
  .object({
    estado: z
      .enum(ESTADOS_ASISTENCIA)
      .nullable()
      .openapi({ description: '`null` en una cerrada por el sistema' }),
    trabajado: z.string().nullable().openapi({ description: 'Qué se trabajó' }),
    indicaciones: z
      .string()
      .nullable()
      .openapi({ description: 'Indicaciones para la próxima sesión' }),
    observacion: z.string().nullable().openapi({
      description: 'La del ausente, o la del cierre del sistema en una cerrada por el sistema',
    }),
    registradaPor: usuarioAuditoriaSchema.nullable(),
    registradaEl: instanteAsistencia,
    modificadaPor: usuarioAuditoriaSchema.nullable(),
    modificadaEl: instanteAsistencia,
    cerradaPorSistema: z.boolean(),
  })
  .openapi('AsistenciaDeOcurrencia')

/** Usuario de auditoría con su rol: dice si el turno lo registró el alumno desde el portal (HU-29). */
const usuarioAuditoriaConRolSchema = usuarioAuditoriaSchema
  .extend({ rol: z.enum(ROLES) })
  .openapi('UsuarioAuditoriaConRol')

/** "Qué se trabajó" e indicaciones de una asistencia presente (`textosDeHorasSeguidas`). */
const textosAsistenciaSchema = z
  .object({ trabajado: z.string().nullable(), indicaciones: z.string().nullable() })
  .openapi('TextosAsistencia')

/** Una hora de unas horas seguidas, con su propio estado. */
const horaSeguidaSchema = z
  .object({
    turnoId: z.number().int(),
    fecha: fechaISO,
    horaInicio: horaHHmm,
    horaFin: horaHHmm,
    estado: z.enum(ESTADOS_OCURRENCIA),
    plazoAsistencia: plazoAsistenciaSchema,
    actual: z.boolean().openapi({ description: 'Es la hora de este detalle' }),
    registrable: z.boolean().openapi({
      description:
        'Quien mira puede registrar su asistencia y la hora no la tiene ni venció: las que ofrece "Aplicar también a…"',
    }),
    textosPropios: textosAsistenciaSchema.nullable().openapi({
      description: 'Los de esta hora si es presente y difieren de `textos` del grupo; si no, null',
    }),
    observacion: z
      .string()
      .nullable()
      .openapi({ description: 'La de la asistencia si la hora es `AUSENTE`; si no, null' }),
  })
  .openapi('HoraSeguida')

/**
 * Las **horas seguidas** de la ocurrencia (Vocabulario del Sprint 3): mismo alumno, profesor,
 * materia y fecha, una a continuación de la otra. Los textos van una sola vez.
 */
const horasSeguidasSchema = z
  .object({
    horaInicio: horaHHmm.openapi({ description: 'La de la primera hora' }),
    horaFin: horaHHmm.openapi({ description: 'La de la última hora' }),
    horas: z.number().int(),
    textos: textosAsistenciaSchema.nullable().openapi({
      description: 'Los de la primera hora presente, que se muestran una sola vez; null si ninguna',
    }),
    ocurrencias: z.array(horaSeguidaSchema),
  })
  .openapi('HorasSeguidas')

/** Detalle de una ocurrencia: todo lo que necesita la pantalla de detalle de un turno (T-44). */
export const ocurrenciaDetalleSchema = z
  .object({
    turnoId: z.number().int(),
    fecha: fechaISO,
    alumno: z.object({
      id: z.number().int(),
      nombre: z.string(),
      apellido: z.string(),
      dni: z.string(),
    }),
    materia: z.object({ id: z.number().int(), nombre: z.string() }),
    profesor: z.object({ id: z.number().int(), nombre: z.string(), apellido: z.string() }),
    aula: z.object({ id: z.number().int(), nombre: z.string() }),
    horaInicio: horaHHmm,
    horaFin: horaHHmm,
    tipo: z.enum(TIPOS_TURNO),
    serie: serieSchema,
    estado: z.enum(ESTADOS_OCURRENCIA),
    observaciones: z.string().nullable(),
    temas: z.string().nullable(),
    cancelacion: cancelacionSchema.nullable(),
    pago: pagoSchema.nullable().openapi({
      description: '`null` para el rol `PROFESOR`, que no ve pagos',
    }),
    prioridad: z
      .enum(PRIORIDADES)
      .nullable()
      .openapi({ description: 'null en una ocurrencia cancelada' }),
    examen: examenQueDeterminaSchema
      .nullable()
      .openapi({ description: 'El examen que determina la prioridad, si hay uno próximo' }),
    plazoAsistencia: plazoAsistenciaSchema,
    asistencia: asistenciaSchema.nullable().openapi({
      description:
        '`null` si está agendada, cancelada o sin registrar dentro del plazo (con su `plazoAsistencia`)',
    }),
    horasSeguidas: horasSeguidasSchema.nullable().openapi({
      description: '`null` si la hora no tiene horas seguidas o si está cancelada',
    }),
    acciones: accionesSchema,
    ...auditoriaSchema.shape,
    createdBy: usuarioAuditoriaConRolSchema.nullable().openapi({
      description:
        'Usuario que registró el turno, con su rol (`ALUMNO` si lo sacó desde el portal)',
    }),
  })
  .openapi('OcurrenciaDetalle')

export type AsistenciaDeOcurrencia = z.infer<typeof asistenciaSchema>
export type HorasSeguidas = z.infer<typeof horasSeguidasSchema>

export type OcurrenciaDetalle = z.infer<typeof ocurrenciaDetalleSchema>

// ---------------------------------------------------------------------------------------------
// GET /ocurrencias?alumnoId&desde?&hasta?
// ---------------------------------------------------------------------------------------------

export const ocurrenciasDelAlumnoQuerySchema = z.object({
  alumnoId: z.coerce
    .number({ error: 'Debe ser un número' })
    .int({ error: 'Debe ser un número entero' })
    .positive({ error: 'Debe ser mayor a 0' })
    .openapi({
      param: { name: 'alumnoId', in: 'query' },
      description: 'Id del alumno',
      example: 12,
    }),
  desde: fechaISO.optional().openapi({
    param: { name: 'desde', in: 'query' },
    description: 'Primer día del rango (YYYY-MM-DD). Sin `desde`, el 1 de enero del año en curso',
    example: '2026-01-01',
  }),
  hasta: fechaISO.optional().openapi({
    param: { name: 'hasta', in: 'query' },
    description: 'Último día del rango, incluido. Sin `hasta`, el 31 de diciembre del año en curso',
    example: '2026-12-31',
  }),
})

export type OcurrenciasDelAlumnoQuery = z.infer<typeof ocurrenciasDelAlumnoQuerySchema>

// ---------------------------------------------------------------------------------------------
// GET /ocurrencias/pdf?alumnoId&desde?&hasta?&estado?&seleccion?
// ---------------------------------------------------------------------------------------------

/** Tope de claves de `seleccion`: acota el largo de la URL (cada clave ocupa unos 15 caracteres). */
export const MAX_SELECCION = 400

export const MENSAJE_SELECCION_FORMATO =
  'Cada turno de la selección debe ser turnoId:fecha (por ejemplo 31:2026-09-28), separados por comas'
export const MENSAJE_SELECCION_REPETIDA = 'La selección no puede repetir un turno'
export const MENSAJE_SELECCION_EXCEDIDA = `La selección no puede tener más de ${MAX_SELECCION} turnos`

const ID_DE_TURNO = /^[1-9]\d*$/

/**
 * `seleccion` del PDF de los turnos de un alumno: las ocurrencias tildadas en la lista, como
 * `turnoId:fecha` separadas por comas. Sale como la lista de claves, ya validada: formato exacto
 * (id entero positivo y fecha real), sin repetidos y hasta `MAX_SELECCION`.
 */
const seleccionDeTurnos = z
  .string()
  .transform((valor, ctx) => {
    const claves = valor.split(',')
    if (claves.length > MAX_SELECCION) {
      ctx.addIssue({ code: 'custom', message: MENSAJE_SELECCION_EXCEDIDA })
      return z.NEVER
    }
    const formatoValido = claves.every((clave) => {
      const [turnoId, fecha, ...resto] = clave.split(':')
      return (
        resto.length === 0 &&
        turnoId !== undefined &&
        ID_DE_TURNO.test(turnoId) &&
        fechaISO.safeParse(fecha).success
      )
    })
    if (!formatoValido) {
      ctx.addIssue({ code: 'custom', message: MENSAJE_SELECCION_FORMATO })
      return z.NEVER
    }
    if (new Set(claves).size !== claves.length) {
      ctx.addIssue({ code: 'custom', message: MENSAJE_SELECCION_REPETIDA })
      return z.NEVER
    }
    return claves
  })
  .openapi({
    type: 'string',
    param: { name: 'seleccion', in: 'query' },
    description: `Las ocurrencias a incluir, como turnoId:fecha separadas por comas, sin repetir y hasta ${MAX_SELECCION}. Con seleccion el documento trae sólo esas (las que estén en el rango) y se ignora estado`,
    example: '31:2026-09-28,31:2026-10-05',
  })

/** Query del PDF de los turnos de un alumno: la de `GET /ocurrencias` más qué turnos van. */
export const turnosDelAlumnoPdfQuerySchema = ocurrenciasDelAlumnoQuerySchema.extend({
  estado: z
    .enum(ESTADOS_OCURRENCIA)
    .optional()
    .openapi({
      param: { name: 'estado', in: 'query' },
      description: 'Sólo los turnos en ese estado. Sin estado, todos. Se ignora si hay seleccion',
      example: 'AGENDADO',
    }),
  seleccion: seleccionDeTurnos.optional(),
})

export type TurnosDelAlumnoPdfQuery = z.infer<typeof turnosDelAlumnoPdfQuerySchema>

/** Ítem de `GET /ocurrencias`: una ocurrencia del alumno, con lo mínimo para listarla. */
export const ocurrenciaDelAlumnoItemSchema = z
  .object({
    turnoId: z.number().int(),
    fecha: fechaISO,
    diaSemana,
    horaInicio: horaHHmm,
    horaFin: horaHHmm,
    profesor: z.object({ id: z.number().int(), nombre: z.string(), apellido: z.string() }),
    materia: z.object({ id: z.number().int(), nombre: z.string() }),
    tipo: z.enum(TIPOS_TURNO),
    estado: z.enum(ESTADOS_OCURRENCIA),
    estadoPago: z.enum(ESTADOS_PAGO).openapi({
      description: 'Una cancelada viene `PENDIENTE`: nunca se cobró',
    }),
    prioridad: z
      .enum(PRIORIDADES)
      .nullable()
      .openapi({ description: 'null en una ocurrencia cancelada' }),
    cancelable: z.boolean().openapi({ description: 'Mismas reglas que `acciones.cancelar`' }),
    plazoAsistencia: plazoAsistenciaSchema,
  })
  .openapi('OcurrenciaDelAlumnoItem')

export type OcurrenciaDelAlumnoItem = z.infer<typeof ocurrenciaDelAlumnoItemSchema>

/** Sin paginar, como las agendas de un solo profesor: el rango ya está acotado (T-43). */
export const ocurrenciasDelAlumnoListadoSchema = z.array(ocurrenciaDelAlumnoItemSchema)

export type OcurrenciasDelAlumnoListado = z.infer<typeof ocurrenciasDelAlumnoListadoSchema>

// ---------------------------------------------------------------------------------------------
// Portal del alumno (HU-30): GET /ocurrencias/mis-turnos y GET /ocurrencias/mis-turnos/{turnoId}/{fecha}
// El alumno sale de la sesión. Nunca se devuelven prioridad, observaciones del turno, ocupación,
// acciones, datos del pago ni auditoría (docs/contrato-api.md → Portal del alumno).
// ---------------------------------------------------------------------------------------------

export const misTurnosQuerySchema = z.object({
  desde: fechaISO.openapi({
    param: { name: 'desde', in: 'query' },
    description: 'Primer día del rango (YYYY-MM-DD)',
    example: '2026-10-01',
  }),
  hasta: fechaISO.openapi({
    param: { name: 'hasta', in: 'query' },
    description: 'Último día del rango, incluido (hasta 31 días)',
    example: '2026-10-31',
  }),
})

export type MisTurnosQuery = z.infer<typeof misTurnosQuerySchema>

const profesorDelPortalSchema = z.object({
  id: z.number().int(),
  nombre: z.string(),
  apellido: z.string(),
})

/** Una ocurrencia del alumno de la sesión, para "Mi calendario". */
export const miTurnoItemSchema = z
  .object({
    turnoId: z.number().int(),
    fecha: fechaISO,
    diaSemana,
    horaInicio: horaHHmm,
    horaFin: horaHHmm,
    materia: z.object({ id: z.number().int(), nombre: z.string() }),
    profesor: profesorDelPortalSchema,
    aula: z.object({ id: z.number().int(), nombre: z.string() }),
    tipo: z.enum(TIPOS_TURNO),
    estado: z.enum(ESTADOS_OCURRENCIA),
    estadoPago: z.enum(ESTADOS_PAGO).openapi({
      description: 'Una cancelada viene `PENDIENTE`: nunca se cobró',
    }),
  })
  .openapi('MiTurnoItem')

export type MiTurnoItem = z.infer<typeof miTurnoItemSchema>

/** Sin paginar: el rango ya está acotado a 31 días. */
export const misTurnosSchema = z.array(miTurnoItemSchema)

export type MisTurnos = z.infer<typeof misTurnosSchema>

/** La asistencia de esa hora para el alumno: sin auditoría ni observación. */
const asistenciaDelPortalSchema = z
  .object({
    estado: z
      .enum(ESTADOS_ASISTENCIA)
      .nullable()
      .openapi({ description: '`null` en una cerrada por el sistema' }),
    trabajado: z.string().nullable().openapi({ description: 'Qué se trabajó' }),
    indicaciones: z
      .string()
      .nullable()
      .openapi({ description: 'Indicaciones para la próxima sesión' }),
    cerradaPorSistema: z.boolean(),
  })
  .openapi('AsistenciaDelPortal')

export type AsistenciaDelPortal = z.infer<typeof asistenciaDelPortalSchema>

const horasSeguidasDelPortalSchema = horasSeguidasSchema
  .extend({
    ocurrencias: z.array(
      horaSeguidaSchema
        .omit({ registrable: true, observacion: true })
        .openapi('HoraSeguidaDelPortal'),
    ),
  })
  .openapi('HorasSeguidasDelPortal')

export type HorasSeguidasDelPortal = z.infer<typeof horasSeguidasDelPortalSchema>

/** El detalle de una ocurrencia del alumno de la sesión. */
export const miTurnoDetalleSchema = z
  .object({
    turnoId: z.number().int(),
    fecha: fechaISO,
    horaInicio: horaHHmm,
    horaFin: horaHHmm,
    materia: z.object({ id: z.number().int(), nombre: z.string() }),
    profesor: profesorDelPortalSchema,
    aula: z.object({ id: z.number().int(), nombre: z.string() }),
    tipo: z.enum(TIPOS_TURNO),
    temas: z.string().nullable().openapi({ description: 'Temas a trabajar' }),
    estado: z.enum(ESTADOS_OCURRENCIA),
    plazoAsistencia: plazoAsistenciaSchema,
    estadoPago: z.enum(ESTADOS_PAGO),
    asistencia: asistenciaDelPortalSchema.nullable().openapi({
      description:
        '`null` si está agendada, cancelada o sin registrar dentro del plazo (con su `plazoAsistencia`)',
    }),
    horasSeguidas: horasSeguidasDelPortalSchema.nullable().openapi({
      description: '`null` si la hora no tiene horas seguidas o si está cancelada',
    }),
  })
  .openapi('MiTurnoDetalle')

export type MiTurnoDetalle = z.infer<typeof miTurnoDetalleSchema>
