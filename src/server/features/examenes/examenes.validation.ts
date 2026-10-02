import { z } from '@hono/zod-openapi'
import { ROLES } from '@/server/shared/actor'
import { fechaISO, textoOpcional } from '@/server/shared/zod'

// Schemas Zod de entrada, salida y params. Son la fuente del OpenAPI. Sin reglas de negocio:
// la materia activa, el examen pendiente y el permiso del profesor los decide el service.

const OBSERVACIONES_MAX = 500

/** Mismos valores que el enum `TipoExamen` de Prisma (T-29): no se importa de Prisma acá (como
 * `TIPOS_TURNO` en `turnos.validation.ts`), así `shared`/`validation` no dependen del cliente generado. */
export const TIPOS_EXAMEN = [
  'PARCIAL',
  'FINAL',
  'RECUPERATORIO',
  'TRABAJO_PRACTICO',
  'OTRO',
] as const

export type TipoExamen = (typeof TIPOS_EXAMEN)[number]

const idPositivo = (descripcion: string, ejemplo: number) =>
  z
    .number({ error: 'Debe ser un número' })
    .int({ error: 'Debe ser un número entero' })
    .positive({ error: 'Debe ser mayor a 0' })
    .openapi({ description: descripcion, example: ejemplo })

/** `id` del path. */
export const examenIdParamsSchema = z.object({
  id: z.coerce
    .number({ error: 'Debe ser un número' })
    .int({ error: 'Debe ser un número entero' })
    .positive({ error: 'Debe ser mayor a 0' })
    .openapi({ param: { name: 'id', in: 'path' }, description: 'Id del examen', example: 5 }),
})

const alumnoIdQuery = z.coerce
  .number({ error: 'Debe ser un número' })
  .int({ error: 'Debe ser un número entero' })
  .positive({ error: 'Debe ser mayor a 0' })
  .openapi({ param: { name: 'alumnoId', in: 'query' }, description: 'Id del alumno', example: 12 })

/** Query de `GET /examenes` y `GET /examenes/materias`: siempre de un alumno puntual. */
export const examenesQuerySchema = z.object({ alumnoId: alumnoIdQuery })

export type ExamenesQuery = z.infer<typeof examenesQuerySchema>

export const crearExamenSchema = z
  .object({
    alumnoId: idPositivo('Id del alumno', 12),
    materiaId: idPositivo('Id de la materia', 3),
    fecha: fechaISO,
    tipo: z
      .enum(TIPOS_EXAMEN, { error: `Tipo inválido: debe ser ${TIPOS_EXAMEN.join(', ')}` })
      .openapi({ description: 'Tipo de examen', example: 'PARCIAL' }),
    observaciones: textoOpcional(
      OBSERVACIONES_MAX,
      'Observaciones del examen',
      'Trae calculadora y formulario',
    ),
  })
  .openapi('ExamenCrear')

export type CrearExamen = z.infer<typeof crearExamenSchema>

/**
 * Edición parcial: lo omitido no cambia. Sin `alumnoId`: un examen no cambia de alumno.
 * Un body sin ningún campo conocido responde 400.
 */
export const editarExamenSchema = crearExamenSchema
  .omit({ alumnoId: true })
  .partial()
  .refine((cambios) => Object.values(cambios).some((valor) => valor !== undefined), {
    error: 'Debe enviar al menos un campo',
  })
  .openapi('ExamenEditar')

export type EditarExamen = z.infer<typeof editarExamenSchema>

/**
 * Usuario de auditoría de un examen, con su rol (HU-17): a diferencia de `UsuarioAuditoria`
 * (`shared/auditoria.ts`), acá importa **quién** lo cargó o modificó (mesa o profesor), no sólo su
 * nombre. Por eso no se reutiliza el schema compartido: es una necesidad propia de esta feature.
 */
export const examenUsuarioAuditoriaSchema = z
  .object({
    id: z.string(),
    nombre: z.string(),
    apellido: z.string(),
    role: z.enum(ROLES),
  })
  .openapi('ExamenUsuarioAuditoria', {
    example: { id: 'usr_prof_01', nombre: 'Luis', apellido: 'Gómez', role: 'PROFESOR' },
  })

export type ExamenUsuarioAuditoria = z.infer<typeof examenUsuarioAuditoriaSchema>

const instante = z.iso.datetime().openapi({
  description: 'Instante ISO 8601 en UTC',
  example: '2026-09-22T13:45:00.000Z',
})

const materiaExamen = z
  .object({ id: z.number().int(), nombre: z.string() })
  .openapi('MateriaExamen')

/** Lo que devuelve el repository para un examen: sin `materia.nombre` resuelto aparte. */
export type ExamenGuardado = {
  id: number
  alumnoId: number
  materiaId: number
  materia: { id: number; nombre: string }
  fecha: string
  tipo: TipoExamen
  observaciones: string | null
  createdAt: string
  updatedAt: string
  createdBy: ExamenUsuarioAuditoria | null
  updatedBy: ExamenUsuarioAuditoria | null
}

/** Ítem de `GET /examenes`: sin `alumnoId` (ya se pidió por query) y con `diasRestantes`. */
export const examenItemSchema = z
  .object({
    id: z.number().int(),
    materia: materiaExamen,
    fecha: fechaISO,
    tipo: z.enum(TIPOS_EXAMEN),
    observaciones: z.string().nullable(),
    pasado: z.boolean().openapi({ description: 'La fecha ya pasó' }),
    diasRestantes: z.number().int().nullable().openapi({
      description: 'Días de calendario hasta el examen (0 = hoy). `null` en los pasados',
      example: 7,
    }),
    createdAt: instante,
    updatedAt: instante,
    createdBy: examenUsuarioAuditoriaSchema.nullable(),
    updatedBy: examenUsuarioAuditoriaSchema.nullable(),
  })
  .openapi('ExamenItem')

export type ExamenItem = z.infer<typeof examenItemSchema>

/** `GET /examenes?alumnoId`: próximos (orden por fecha) y pasados, aparte. */
export const examenesListadoSchema = z
  .object({
    proximos: z.array(examenItemSchema),
    pasados: z.array(examenItemSchema),
  })
  .openapi('ExamenesListado')

export type ExamenesListado = z.infer<typeof examenesListadoSchema>

/** Detalle que devuelven el alta, la edición y la baja: con `alumnoId` y `pasado`. */
export const examenDetalleSchema = z
  .object({
    id: z.number().int(),
    alumnoId: z.number().int(),
    materia: materiaExamen,
    fecha: fechaISO,
    tipo: z.enum(TIPOS_EXAMEN),
    observaciones: z.string().nullable(),
    pasado: z.boolean().openapi({
      description: 'La fecha ya pasó: una fecha pasada se acepta, pero se avisa en el front',
    }),
    createdAt: instante,
    updatedAt: instante,
    createdBy: examenUsuarioAuditoriaSchema.nullable(),
    updatedBy: examenUsuarioAuditoriaSchema.nullable(),
  })
  .openapi('ExamenDetalle')

export type ExamenDetalle = z.infer<typeof examenDetalleSchema>

/** Ítem de `GET /examenes/materias`: igual selector que el de materias (sin importarlo de esa
 * feature: de otra feature sólo se importan `*.repository` y `*.condiciones`, nunca `*.validation`). */
export const materiaExamenSelectorItemSchema = z
  .object({ id: z.number().int(), nombre: z.string() })
  .openapi('MateriaExamenSelectorItem')

export type MateriaExamenSelectorItem = z.infer<typeof materiaExamenSelectorItemSchema>

export const materiasExamenSelectorSchema = z.array(materiaExamenSelectorItemSchema)

export type MateriasExamenSelector = z.infer<typeof materiasExamenSelectorSchema>

/** El existente de un 409 `EXAMEN_PENDIENTE` (`details`), para ofrecer editarlo. */
export type ExamenPendiente = { id: number; tipo: TipoExamen; fecha: string }
