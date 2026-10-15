import { z } from '@hono/zod-openapi'
import { ESTADOS_OCURRENCIA } from '@/server/features/turnos/ocurrencias.condiciones'
import { fechaISO, horaHHmm } from '@/server/shared/zod'

// Schemas Zod de `historiales` (T-108, HU-31 y HU-33). Son la fuente del OpenAPI. Sin reglas de
// negocio: el período por defecto, el tope de días, la agrupación en bloques de horas seguidas y
// los porcentajes los decide `historiales.reglas.ts`.
//
// `MOTIVOS_CANCELACION` se declara acá, como en `ocurrencias.validation.ts`: ningún
// `*.condiciones.ts` lo publica como array y ESLint no deja importar `@/generated/*` fuera de un
// repository.
const MOTIVOS_CANCELACION = [
  'CANCELACION_ALUMNO',
  'CANCELACION_PROFESOR',
  'PROBLEMA_ADMINISTRATIVO',
  'OTRO',
] as const

const idPositivo = (description: string, example: number) =>
  z.coerce
    .number({ error: 'Debe ser un número' })
    .int({ error: 'Debe ser un número entero' })
    .positive({ error: 'Debe ser mayor a 0' })
    .openapi({ description, example })

/** Un mes de calendario, `YYYY-MM` (el filtro del portal, HU-33). */
export const mesISO = z
  .string({ error: 'Debe ser un texto' })
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, {
    error: 'Mes inválido: debe tener formato AAAA-MM',
  })
  .openapi({ description: 'Mes de calendario (AAAA-MM)', example: '2026-10' })

// ---------------------------------------------------------------------------------------------
// Piezas comunes: un bloque de horas seguidas y sus clases
// ---------------------------------------------------------------------------------------------

/** "Qué se trabajó" e "Indicaciones para la próxima sesión" (`textosDeHorasSeguidas`). */
const textosAsistenciaSchema = z
  .object({ trabajado: z.string().nullable(), indicaciones: z.string().nullable() })
  .openapi('TextosDelHistorial')

/**
 * Plazo para registrar la asistencia, tal como lo da el motor. Sin nombre de componente:
 * `PlazoAsistencia` ya es el de `asistencias`.
 */
const plazoAsistenciaSchema = z
  .object({
    vence: fechaISO.openapi({
      description: 'Último día para registrar o corregir la asistencia (hasta las 23:59)',
    }),
    vencido: z.boolean().openapi({ description: 'Ya pasó `vence`' }),
  })
  .nullable()
  .openapi({ description: '`null` en una clase cancelada o posterior a hoy' })

/**
 * Una **clase** del historial: una hora, con su propio estado (cada hora cuenta como un turno).
 * Los textos del bloque no se repiten acá: sólo vienen los `textosPropios`, cuando difieren.
 */
const claseSchema = z
  .object({
    turnoId: z.number().int().openapi({ description: 'Para abrir el detalle del turno' }),
    fecha: fechaISO,
    horaInicio: horaHHmm,
    horaFin: horaHHmm,
    estado: z.enum(ESTADOS_OCURRENCIA),
    plazoAsistencia: plazoAsistenciaSchema,
    cerradaPorSistema: z.boolean().openapi({
      description: 'Un "Sin registrar" con el plazo vencido: definitivo y de sólo lectura',
    }),
    textosPropios: textosAsistenciaSchema.nullable().openapi({
      description:
        'Los de esta hora si es presente y difieren de los `textos` del bloque; si no, null',
    }),
    observacion: z.string().nullable().openapi({
      description:
        'La de la asistencia si la hora es `AUSENTE`, o la del cierre del sistema en una cerrada por el sistema; si no, null',
    }),
    cancelacion: z
      .object({ motivo: z.enum(MOTIVOS_CANCELACION), detalle: z.string().nullable() })
      .nullable()
      .openapi({ description: 'Sólo si la hora está cancelada (HU-13)' }),
  })
  .openapi('ClaseDelHistorial')

export type ClaseDelHistorial = z.infer<typeof claseSchema>

/**
 * Un **bloque**: las horas seguidas de un día (`agruparHorasSeguidas`), con "Qué se trabajó" e
 * indicaciones **una sola vez**. Una hora suelta, o una cancelada, es un bloque de una.
 */
const bloqueSchema = z
  .object({
    fecha: fechaISO,
    horaInicio: horaHHmm.openapi({ description: 'La de la primera hora' }),
    horaFin: horaHHmm.openapi({ description: 'La de la última hora' }),
    horas: z.number().int().openapi({ description: 'Cantidad de clases (de horas) del bloque' }),
    textos: textosAsistenciaSchema.nullable().openapi({
      description: 'Los de la primera hora presente, que se muestran una sola vez; null si ninguna',
    }),
    clases: z.array(claseSchema),
  })
  .openapi('BloqueDelHistorial')

export type BloqueDelHistorial = z.infer<typeof bloqueSchema>

/** Clases realizadas, ausencias y porcentaje de asistencia de un grupo. */
const resumenSchema = z
  .object({
    realizadas: z.number().int().openapi({ description: 'Horas `REALIZADO`', example: 8 }),
    ausencias: z.number().int().openapi({ description: 'Horas `AUSENTE`', example: 2 }),
    porcentaje: z.number().openapi({
      description:
        'Realizadas sobre realizadas más ausencias, con un decimal. 0 si no hay ninguna de las dos. Los cancelados, los sin registrar y los agendados no cuentan',
      example: 80,
    }),
  })
  .openapi('ResumenDelHistorial')

export type ResumenDelHistorial = z.infer<typeof resumenSchema>

/** Un grupo del historial: una materia con un profesor ("Matemática — Prof. Gómez"). */
const grupoSchema = z
  .object({
    materia: z.object({ id: z.number().int(), nombre: z.string() }),
    profesor: z.object({ id: z.number().int(), nombre: z.string(), apellido: z.string() }),
    resumen: resumenSchema,
    bloques: z.array(bloqueSchema).openapi({
      description: 'De la fecha más reciente a la más antigua',
    }),
  })
  .openapi('GrupoDelHistorial')

export type GrupoDelHistorial = z.infer<typeof grupoSchema>

// ---------------------------------------------------------------------------------------------
// GET /historiales/alumnos/{alumnoId}?desde&hasta&materiaId&profesorId
// ---------------------------------------------------------------------------------------------

export const alumnoIdParamsSchema = z.object({
  alumnoId: idPositivo('Id del alumno', 12).openapi({ param: { name: 'alumnoId', in: 'path' } }),
})

export type AlumnoIdParams = z.infer<typeof alumnoIdParamsSchema>

export const historialQuerySchema = z.object({
  desde: fechaISO.optional().openapi({
    param: { name: 'desde', in: 'query' },
    description: 'Primer día del período, incluido. Sin `desde` ni `hasta`, el mes en curso',
    example: '2026-10-01',
  }),
  hasta: fechaISO.optional().openapi({
    param: { name: 'hasta', in: 'query' },
    description:
      'Último día del período, incluido. No puede ser anterior a `desde`. Las clases van hasta hoy: un `hasta` futuro no agrega nada',
    example: '2026-10-31',
  }),
  materiaId: idPositivo('Sólo las clases de esta materia', 3)
    .optional()
    .openapi({ param: { name: 'materiaId', in: 'query' } }),
  profesorId: idPositivo('Sólo las clases con este profesor (el del bloque)', 4)
    .optional()
    .openapi({ param: { name: 'profesorId', in: 'query' } }),
})

export type HistorialQuery = z.infer<typeof historialQuerySchema>

/** Materias y profesores del **historial completo** del alumno, para los filtros de la pantalla. */
const opcionesSchema = z
  .object({
    materias: z
      .array(z.object({ id: z.number().int(), nombre: z.string() }))
      .openapi({ description: 'Por nombre' }),
    profesores: z
      .array(z.object({ id: z.number().int(), nombre: z.string(), apellido: z.string() }))
      .openapi({ description: 'Por apellido y nombre' }),
  })
  .openapi('OpcionesDelHistorial')

export const historialDelAlumnoSchema = z
  .object({
    alumno: z.object({
      id: z.number().int(),
      nombre: z.string(),
      apellido: z.string(),
      dni: z.string(),
    }),
    desde: fechaISO.openapi({ description: 'Período efectivo: el pedido o el mes en curso' }),
    hasta: fechaISO.openapi({
      description: 'El pedido o el fin del mes en curso (las clases llegan hasta hoy)',
    }),
    grupos: z.array(grupoSchema).openapi({
      description: 'Por materia y profesor. Vacío si no hay clases en el período',
    }),
    opciones: opcionesSchema,
  })
  .openapi('HistorialDelAlumno')

export type HistorialDelAlumno = z.infer<typeof historialDelAlumnoSchema>

// ---------------------------------------------------------------------------------------------
// GET /historiales/mis-materias (portal del alumno, HU-33)
// ---------------------------------------------------------------------------------------------

const misMateriasItemSchema = z
  .object({
    materia: z.object({ id: z.number().int(), nombre: z.string() }),
    profesor: z.object({ id: z.number().int(), nombre: z.string(), apellido: z.string() }),
    proximoTurno: z
      .object({ fecha: fechaISO, horaInicio: horaHHmm, horaFin: horaHHmm })
      .nullable()
      .openapi({
        description:
          'La primera clase no cancelada de hoy en adelante; `null` si no tiene ninguna próxima',
      }),
    porcentaje: z.number().openapi({
      description: 'Asistencia sobre todo su historial en esa materia con ese profesor',
      example: 80,
    }),
  })
  .openapi('MiMateriaItem')

export type MiMateriaItem = z.infer<typeof misMateriasItemSchema>

/** Sin paginar: son las materias que cursa o cursó el alumno. */
export const misMateriasSchema = z.array(misMateriasItemSchema)

export type MisMaterias = z.infer<typeof misMateriasSchema>

// ---------------------------------------------------------------------------------------------
// GET /historiales/mis-materias/{materiaId}/{profesorId}?mes (portal del alumno, HU-33)
// ---------------------------------------------------------------------------------------------

export const miMateriaParamsSchema = z.object({
  materiaId: idPositivo('Id de la materia', 3).openapi({
    param: { name: 'materiaId', in: 'path' },
  }),
  profesorId: idPositivo('Id del profesor', 4).openapi({
    param: { name: 'profesorId', in: 'path' },
  }),
})

export type MiMateriaParams = z.infer<typeof miMateriaParamsSchema>

export const miMateriaQuerySchema = z.object({
  mes: mesISO.optional().openapi({
    param: { name: 'mes', in: 'query' },
    description: 'Mes a mostrar (AAAA-MM). Por defecto, el mes en curso',
    example: '2026-10',
  }),
})

export type MiMateriaQuery = z.infer<typeof miMateriaQuerySchema>

/**
 * Una clase del historial para el alumno: sin la observación interna de la ausencia, sin el motivo
 * de la cancelación y sin el plazo de la asistencia ni el cierre del sistema, porque los
 * "Sin registrar" no se le muestran (HU-33).
 */
const claseDelPortalSchema = claseSchema
  .omit({
    plazoAsistencia: true,
    cerradaPorSistema: true,
    observacion: true,
    cancelacion: true,
  })
  .openapi('ClaseDelPortal')

const bloqueDelPortalSchema = bloqueSchema
  .extend({ clases: z.array(claseDelPortalSchema) })
  .openapi('BloqueDelPortal')

export type BloqueDelPortal = z.infer<typeof bloqueDelPortalSchema>

export const miMateriaSchema = z
  .object({
    materia: z.object({ id: z.number().int(), nombre: z.string() }),
    profesor: z.object({ id: z.number().int(), nombre: z.string(), apellido: z.string() }),
    mes: mesISO.openapi({ description: 'Mes efectivo: el pedido o el mes en curso' }),
    indicacionesProximaClase: z
      .object({
        fecha: fechaISO.openapi({ description: 'Fecha de la clase que las dejó' }),
        indicaciones: z.string(),
      })
      .nullable()
      .openapi({
        description:
          'Las de la última clase realizada con indicaciones, de cualquier fecha (también anterior al mes); `null` si no hay',
      }),
    resumen: resumenSchema.openapi({ description: 'Del mes que se muestra' }),
    bloques: z.array(bloqueDelPortalSchema).openapi({
      description:
        'Las clases del mes en bloques de horas seguidas, de la más reciente a la más antigua. Las "Sin registrar" y las agendadas no se muestran',
    }),
  })
  .openapi('MiMateria')

export type MiMateria = z.infer<typeof miMateriaSchema>
