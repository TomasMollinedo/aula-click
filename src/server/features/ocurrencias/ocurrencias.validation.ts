import { z } from '@hono/zod-openapi'
import { PRIORIDADES } from '@/server/features/examenes/examenes.condiciones'
import { TIPOS_TURNO } from '@/server/features/turnos/ocurrencias.condiciones'
import { auditoriaSchema } from '@/server/shared/auditoria'
import { diaSemana, fechaISO, horaHHmm } from '@/server/shared/zod'

// Valores de enums que ningún `*.condiciones.ts` publica como array (a diferencia de
// `TIPOS_TURNO`): se declaran acá para no importar `@/generated/*` ni `turnos.reglas.ts` fuera de
// un repository (lo prohíbe ESLint). `ESTADOS_OCURRENCIA` es el de `turnos.reglas.ts` (definición
// F: sólo estos tres, distinto del `Turno.estado` de `ESTADOS_TURNO`, que es ACTIVO/CANCELADO).
const ESTADOS_OCURRENCIA = ['AGENDADO', 'CANCELADO', 'SIN_REGISTRAR'] as const
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
//
// El campo `pago` que pide el ticket original no está: no hay hoy una fuente de datos de `Pago`
// de la que traerlo (decisión explícita, no un olvido — ver `ocurrencias.reglas.ts`).

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
    description: 'Primer día del rango (YYYY-MM-DD). Sin `desde`, 30 días atrás de hoy',
    example: '2026-08-30',
  }),
  hasta: fechaISO.optional().openapi({
    param: { name: 'hasta', in: 'query' },
    description: 'Último día del rango, incluido. Sin `hasta`, 8 semanas adelante de hoy',
    example: '2026-11-24',
  }),
})

export type OcurrenciasDelAlumnoQuery = z.infer<typeof ocurrenciasDelAlumnoQuerySchema>

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
