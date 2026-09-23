import { z } from '@hono/zod-openapi'

// Schemas Zod de entrada, salida y params. Son la fuente del OpenAPI. Sin reglas de negocio.

/** `id` del path. Uno no numérico, cero o negativo responde 400. */
export const profesorIdParamsSchema = z.object({
  id: z.coerce
    .number({ error: 'Debe ser un número' })
    .int({ error: 'Debe ser un número entero' })
    .positive({ error: 'Debe ser mayor a 0' })
    .openapi({ param: { name: 'id', in: 'path' }, description: 'Id del profesor', example: 3 }),
})

/** Materia con asignación activa del profesor. */
export const materiaAsignadaSchema = z
  .object({
    id: z.number().int().openapi({ description: 'Id de la materia', example: 7 }),
    nombre: z.string().openapi({ example: 'Matemática' }),
  })
  .openapi('MateriaAsignada')

export type MateriaAsignada = z.infer<typeof materiaAsignadaSchema>

/** Sin paginar (HU-04): un profesor tiene pocas materias. */
export const materiasAsignadasSchema = z.array(materiaAsignadaSchema).openapi('MateriasAsignadas')

export type MateriasAsignadas = z.infer<typeof materiasAsignadasSchema>

const MAX_MATERIAS = 10

/** Body de la asignación: una o varias materias, sin repetir. */
export const asignarMateriasSchema = z
  .object({
    materiaIds: z
      .array(
        z
          .number({ error: 'Debe ser un número' })
          .int({ error: 'Debe ser un número entero' })
          .positive({ error: 'Debe ser mayor a 0' }),
        { error: 'Debe ser una lista de ids de materias' },
      )
      .min(1, { error: 'Debe enviar al menos una materia' })
      .max(MAX_MATERIAS, { error: `No puede enviar más de ${MAX_MATERIAS} materias` })
      .refine((ids) => new Set(ids).size === ids.length, { error: 'No puede repetir materias' })
      .openapi({ description: 'Ids de las materias a asignar', example: [2, 7] }),
  })
  .openapi('AsignarMaterias')

export type AsignarMaterias = z.infer<typeof asignarMateriasSchema>

type Estado = 'ACTIVO' | 'INACTIVO'

/**
 * Lo que el service necesita del profesor para asignar: su estado (el de su `Usuario`) y las
 * asignaciones que ya tiene, activas o no, de las materias pedidas. No viaja por HTTP.
 */
export type ProfesorParaAsignar = {
  estado: Estado
  asignaciones: { materiaId: number; estado: Estado }[]
}
