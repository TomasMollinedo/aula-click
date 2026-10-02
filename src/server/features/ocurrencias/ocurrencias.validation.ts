import { z } from '@hono/zod-openapi'
import { PRIORIDADES } from '@/server/features/examenes/examenes.condiciones'
import { TIPOS_TURNO } from '@/server/features/turnos/ocurrencias.condiciones'
import { auditoriaSchema, usuarioAuditoriaSchema } from '@/server/shared/auditoria'
import { diaSemana, fechaISO, horaHHmm } from '@/server/shared/zod'

// Valores de enums que ningún `*.condiciones.ts` publica como array (a diferencia de
// `TIPOS_TURNO`): se declaran acá para no importar `@/generated/*` ni `turnos.reglas.ts` fuera de
// un repository (lo prohíbe ESLint). `ESTADOS_OCURRENCIA` es el de `turnos.reglas.ts` (definición
// F: sólo estos tres, distinto del `Turno.estado` de `ESTADOS_TURNO`, que es ACTIVO/CANCELADO).
const ESTADOS_OCURRENCIA = ['AGENDADO', 'CANCELADO', 'SIN_REGISTRAR'] as const
/** Los de `Ocurrencia.pago.estado` (`EstadoPagoOcurrencia` del motor). */
const ESTADOS_PAGO = ['PENDIENTE', 'PAGADO'] as const
const MOTIVOS_CANCELACION = [
  'CANCELACION_ALUMNO',
  'CANCELACION_PROFESOR',
  'PROBLEMA_ADMINISTRATIVO',
  'OTRO',
] as const
const TIPOS_EXAMEN = ['PARCIAL', 'FINAL', 'RECUPERATORIO', 'TRABAJO_PRACTICO', 'OTRO'] as const

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
    tipo: z.enum(TIPOS_EXAMEN),
    materiaNombre: z.string(),
    dias: z.number().int(),
  })
  .openapi('ExamenQueDetermina')

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
    acciones: accionesSchema,
    ...auditoriaSchema.shape,
  })
  .openapi('OcurrenciaDetalle')

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
  })
  .openapi('OcurrenciaDelAlumnoItem')

export type OcurrenciaDelAlumnoItem = z.infer<typeof ocurrenciaDelAlumnoItemSchema>

/** Sin paginar, como las agendas de un solo profesor: el rango ya está acotado (T-43). */
export const ocurrenciasDelAlumnoListadoSchema = z.array(ocurrenciaDelAlumnoItemSchema)

export type OcurrenciasDelAlumnoListado = z.infer<typeof ocurrenciasDelAlumnoListadoSchema>
