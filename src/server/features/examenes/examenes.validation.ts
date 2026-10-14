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

/** Mismos valores que el enum `ResultadoExamen` de Prisma (T-72). */
export const RESULTADOS_EXAMEN = ['CON_NOTA', 'AUSENTE'] as const

export type ResultadoExamen = (typeof RESULTADOS_EXAMEN)[number]

/** Rango de la nota (HU-34): de 1 a 10, con hasta dos decimales. */
export const NOTA_MINIMA = 1
export const NOTA_MAXIMA = 10

/** Tiene a lo sumo dos decimales (tolerando el error de punto flotante de 7.15 * 100). */
function conHastaDosDecimales(nota: number): boolean {
  return Math.abs(nota * 100 - Math.round(nota * 100)) < 1e-9
}

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
 * Body de `PATCH /examenes/{id}/nota` (HU-34): `CON_NOTA` con una nota de 1 a 10 y hasta dos
 * decimales, o `AUSENTE` sin nota. Cargar y corregir usan el mismo body.
 */
export const cargarNotaSchema = z
  .object({
    resultado: z
      .enum(RESULTADOS_EXAMEN, { error: 'Resultado inválido: debe ser CON_NOTA o AUSENTE' })
      .openapi({ example: 'CON_NOTA' }),
    nota: z.number({ error: 'Debe ser un número' }).nullable().optional().openapi({
      description: 'De 1 a 10, con hasta dos decimales. Solo con CON_NOTA',
      example: 7.5,
    }),
  })
  .superRefine((datos, ctx) => {
    const nota = datos.nota ?? null
    if (datos.resultado === 'AUSENTE') {
      if (nota !== null) {
        ctx.addIssue({ code: 'custom', path: ['nota'], message: 'Un ausente no lleva nota' })
      }
      return
    }
    if (nota === null) {
      ctx.addIssue({ code: 'custom', path: ['nota'], message: 'La nota es obligatoria' })
    } else if (nota < NOTA_MINIMA || nota > NOTA_MAXIMA || !conHastaDosDecimales(nota)) {
      ctx.addIssue({
        code: 'custom',
        path: ['nota'],
        message: 'La nota tiene que ser de 1 a 10, con hasta dos decimales',
      })
    }
  })
  .openapi('ExamenNotaCargar')

export type CargarNota = z.infer<typeof cargarNotaSchema>

/** Query de `GET /examenes/mis-examenes` (portal): siempre de una materia. */
export const misExamenesQuerySchema = z.object({
  materiaId: z.coerce
    .number({ error: 'Debe ser un número' })
    .int({ error: 'Debe ser un número entero' })
    .positive({ error: 'Debe ser mayor a 0' })
    .openapi({
      param: { name: 'materiaId', in: 'query' },
      description: 'Id de la materia',
      example: 3,
    }),
})

export type MisExamenesQuery = z.infer<typeof misExamenesQuerySchema>

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
} & NotaDeExamen

/** La nota de un examen (HU-34) con su trazabilidad propia; todo `null` si no se cargó. */
export type NotaDeExamen = {
  resultado: ResultadoExamen | null
  nota: number | null
  notaCreatedAt: string | null
  notaUpdatedAt: string | null
  notaCreatedBy: ExamenUsuarioAuditoria | null
  notaUpdatedBy: ExamenUsuarioAuditoria | null
}

/** Campos de la nota en el ítem y el detalle (HU-34). */
const camposNota = {
  resultado: z.enum(RESULTADOS_EXAMEN).nullable().openapi({
    description: 'CON_NOTA o AUSENTE; `null` si no se cargó',
  }),
  nota: z
    .number()
    .nullable()
    .openapi({ description: 'De 1 a 10; `null` si es ausente o no se cargó' }),
  notaCreatedAt: z.iso.datetime().nullable().openapi({ description: 'Cuándo se cargó la nota' }),
  notaUpdatedAt: z.iso.datetime().nullable().openapi({
    description: 'Cuándo se modificó la nota por última vez',
  }),
  notaCreatedBy: examenUsuarioAuditoriaSchema
    .nullable()
    .openapi({ description: 'Quién cargó la nota' }),
  notaUpdatedBy: examenUsuarioAuditoriaSchema.nullable().openapi({
    description: 'Quién modificó la nota por última vez',
  }),
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
    administrable: z.boolean().openapi({
      description:
        'Quien consulta puede editarlo y darlo de baja: mesa de entradas, siempre; el profesor, si le dicta esa materia al alumno',
    }),
    ...camposNota,
    cargarNota: z.boolean().openapi({
      description:
        'Quien consulta puede cargar o corregir la nota: el examen ya se rindió (fecha hoy o anterior) y es administrable',
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
    rendidosSinNota: z.number().int().openapi({
      description: 'Exámenes ya rendidos (fecha hoy o anterior) sin nota cargada',
      example: 2,
    }),
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
    ...camposNota,
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

/** Un examen rendido en el portal: sin observaciones ni auditoría (HU-35). */
export const miExamenRendidoSchema = z
  .object({
    fecha: fechaISO,
    tipo: z.enum(TIPOS_EXAMEN),
    resultado: z.enum(RESULTADOS_EXAMEN).nullable().openapi({
      description: 'CON_NOTA (con `nota`), AUSENTE, o `null` si todavía no tiene nota ("Sin nota")',
    }),
    nota: z.number().nullable(),
  })
  .openapi('MiExamenRendido')

/** `GET /examenes/mis-examenes?materiaId` (HU-35): el próximo, los rendidos y el promedio. */
export const misExamenesSchema = z
  .object({
    proximo: z
      .object({
        fecha: fechaISO,
        tipo: z.enum(TIPOS_EXAMEN),
        diasRestantes: z.number().int().openapi({ description: 'Días que faltan (0 = hoy)' }),
      })
      .nullable()
      .openapi({ description: 'El próximo examen de la materia (a lo sumo uno), o null' }),
    rendidos: z.array(miExamenRendidoSchema).openapi({
      description: 'Del más reciente al más antiguo',
    }),
    promedio: z.number().nullable().openapi({
      description:
        'Promedio de las notas, sin los ausentes ni los sin nota (dos decimales), o null',
      example: 7.25,
    }),
  })
  .openapi('MisExamenes')

export type MisExamenes = z.infer<typeof misExamenesSchema>
