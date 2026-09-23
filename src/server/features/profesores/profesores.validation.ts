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
