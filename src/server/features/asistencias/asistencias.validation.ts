import { z } from '@hono/zod-openapi'
import { fechaISO, horaHHmm, textoOpcional } from '@/server/shared/zod'

// Schemas Zod de entrada, salida y params. Son la fuente del OpenAPI. Sin reglas de negocio: de
// quién es la ocurrencia, si está cancelada, si son horas seguidas y el plazo los decide el
// service, con el motor de `turnos`.

/** Largo máximo de "Qué se trabajó" y de "Indicaciones para la próxima sesión" (HU-22). */
export const TEXTO_PRESENTE_MAX = 1000
/** Largo máximo de la observación de un ausente (HU-22). */
export const OBSERVACION_MAX = 500

/** Mismos valores que el enum `EstadoAsistencia` de Prisma (T-72): no se importa de Prisma acá. */
export const ESTADOS_ASISTENCIA = ['PRESENTE', 'AUSENTE'] as const

/** Mismos valores que `ESTADOS_OCURRENCIA` del motor de `turnos` (T-74). */
const ESTADOS_OCURRENCIA = [
  'AGENDADO',
  'CANCELADO',
  'SIN_REGISTRAR',
  'REALIZADO',
  'AUSENTE',
] as const

// ---------- Entrada ----------

/** Query de `GET /asistencias`: `fecha` (sin ella, hoy). */
export const asistenciasQuerySchema = z.object({
  fecha: fechaISO.optional().openapi({
    param: { name: 'fecha', in: 'query' },
    description: 'Día (YYYY-MM-DD), hoy o anterior. Sin `fecha`, hoy (zona del negocio)',
    example: '2026-10-13',
  }),
})

export type AsistenciasQuery = z.infer<typeof asistenciasQuerySchema>

const ocurrenciaSchema = z
  .object({
    turnoId: z
      .number({ error: 'Debe ser un número' })
      .int({ error: 'Debe ser un número entero' })
      .positive({ error: 'Debe ser mayor a 0' })
      .openapi({ description: 'Id del turno', example: 41 }),
    fecha: fechaISO,
  })
  .openapi('OcurrenciaAsistencia')

/**
 * Un registro: una fila de la pantalla (una o varias horas seguidas del mismo alumno). Con
 * `AUSENTE`, `trabajado` e `indicaciones` no se aceptan (400 en ese campo).
 */
const registroSchema = z
  .object({
    ocurrencias: z
      .array(ocurrenciaSchema)
      .min(1, { error: 'Debe tener al menos una ocurrencia' })
      .openapi({ description: 'Las horas de la fila: `(turnoId, fecha)` de cada una' }),
    estado: z
      .enum(ESTADOS_ASISTENCIA, { error: 'Estado inválido: debe ser PRESENTE o AUSENTE' })
      .openapi({ example: 'PRESENTE' }),
    trabajado: textoOpcional(TEXTO_PRESENTE_MAX, 'Qué se trabajó (solo PRESENTE)'),
    indicaciones: textoOpcional(
      TEXTO_PRESENTE_MAX,
      'Indicaciones para la próxima sesión (solo PRESENTE)',
    ),
    observacion: textoOpcional(OBSERVACION_MAX, 'Observación (solo AUSENTE)'),
  })
  .superRefine((registro, ctx) => {
    if (registro.estado !== 'AUSENTE') return
    for (const campo of ['trabajado', 'indicaciones'] as const) {
      if (registro[campo] !== undefined && registro[campo] !== null) {
        ctx.addIssue({
          code: 'custom',
          path: [campo],
          message: 'No se puede cargar con un ausente',
        })
      }
    }
  })

export const registrarAsistenciasSchema = z
  .object({
    registros: z
      .array(registroSchema)
      .min(1, { error: 'Debe tener al menos un registro' })
      .openapi({ description: 'Una fila por registro. "Ajustar por hora": un registro por hora' }),
  })
  .openapi('AsistenciasRegistrar')

export type RegistrarAsistencias = z.infer<typeof registrarAsistenciasSchema>
export type RegistroAsistencia = RegistrarAsistencias['registros'][number]

// ---------- Salida ----------

const plazoSchema = z
  .object({
    vence: fechaISO.openapi({ description: 'Último día para registrar o corregir (fecha + 7)' }),
    vencido: z.boolean().openapi({ description: 'Ya pasó `vence`: sólo lectura' }),
  })
  .openapi('PlazoAsistencia')

const asistenciaSchema = z
  .object({
    estado: z.enum(ESTADOS_ASISTENCIA),
    trabajado: z.string().nullable(),
    indicaciones: z.string().nullable(),
    observacion: z.string().nullable(),
  })
  .openapi('AsistenciaRegistrada')

const horaSchema = z
  .object({
    turnoId: z.number().int(),
    fecha: fechaISO,
    horaInicio: horaHHmm,
    horaFin: horaHHmm,
    estado: z.enum(ESTADOS_OCURRENCIA),
    asistencia: asistenciaSchema.nullable().openapi({ description: '`null` si no se registró' }),
  })
  .openapi('HoraAsistencia')

export const filaAsistenciaSchema = z
  .object({
    alumno: z.object({
      id: z.number().int(),
      apellido: z.string(),
      nombre: z.string(),
      fotoUrl: z.string().nullable().openapi({ description: 'URL prefirmada de la foto, o null' }),
    }),
    materia: z.object({ id: z.number().int(), nombre: z.string() }),
    temas: z.string().nullable().openapi({ description: 'Temas a trabajar del turno' }),
    horaInicio: horaHHmm,
    horaFin: horaHHmm,
    horas: z.number().int().openapi({ description: 'Cantidad de horas seguidas', example: 3 }),
    ocurrencias: z.array(horaSchema).openapi({ description: 'Cada hora, con su propio estado' }),
    indicacionesAnteriores: z
      .object({ fecha: fechaISO, indicaciones: z.string() })
      .nullable()
      .openapi({
        description:
          'Las de la última clase presente anterior de ese alumno en esa materia, o null',
      }),
  })
  .openapi('FilaAsistencia')

export type FilaAsistencia = z.infer<typeof filaAsistenciaSchema>

const claseSchema = z
  .object({
    bloqueAgendaId: z.number().int(),
    horaInicio: horaHHmm,
    horaFin: horaHHmm,
    aula: z.object({ id: z.number().int(), nombre: z.string() }),
    filas: z.array(filaAsistenciaSchema).openapi({
      description: 'Cada fila va en la clase de su primera hora',
    }),
  })
  .openapi('ClaseAsistencia')

export type ClaseAsistencia = z.infer<typeof claseSchema>

export const asistenciasDelDiaSchema = z
  .object({
    fecha: fechaISO,
    plazo: plazoSchema,
    editable: z.boolean().openapi({ description: 'El plazo no venció: se puede registrar' }),
    clases: z.array(claseSchema),
  })
  .openapi('AsistenciasDelDia')

export type AsistenciasDelDia = z.infer<typeof asistenciasDelDiaSchema>

export const asistenciasPendientesSchema = z
  .object({
    cantidad: z.number().int().openapi({ example: 3 }),
    masAntiguo: z
      .object({ fecha: fechaISO, vence: fechaISO })
      .nullable()
      .openapi({ description: 'El turno sin registrar más antiguo dentro del plazo, o null' }),
  })
  .openapi('AsistenciasPendientes')

export type AsistenciasPendientes = z.infer<typeof asistenciasPendientesSchema>

export const asistenciasRegistradasSchema = z
  .object({ filas: z.array(filaAsistenciaSchema) })
  .openapi('AsistenciasRegistradas')

export type AsistenciasRegistradas = z.infer<typeof asistenciasRegistradasSchema>
