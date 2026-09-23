import { z } from '@hono/zod-openapi'
import type { Estado } from '@/server/shared/estado'

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

/** Lista de materias del body (asignar y quitar): una o varias, sin repetir. */
function materiaIds(description: string) {
  return z
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
    .openapi({ description, example: [2, 7] })
}

/** Body de la asignación. */
export const asignarMateriasSchema = z
  .object({ materiaIds: materiaIds('Ids de las materias a asignar') })
  .openapi('AsignarMaterias')

export type AsignarMaterias = z.infer<typeof asignarMateriasSchema>

/** Body de la baja de asignaciones. */
export const quitarMateriasSchema = z
  .object({ materiaIds: materiaIds('Ids de las materias a quitar') })
  .openapi('QuitarMaterias')

export type QuitarMaterias = z.infer<typeof quitarMateriasSchema>

/**
 * Lo que el service necesita del profesor para asignar o quitar materias: su estado (el de su
 * `Usuario`) y las asignaciones que ya tiene, activas o no, de las materias pedidas, con el
 * nombre de la materia (para los mensajes). No viaja por HTTP.
 */
export type ProfesorConAsignaciones = {
  estado: Estado
  asignaciones: { materiaId: number; nombre: string; estado: Estado }[]
}

/**
 * Profesor que dicta una materia (asignación activa), tal como lo leen otras features: el detalle
 * y la baja de materias (T-09) y el registro de turnos (HU-07). `id` es el de `Profesor`; los
 * datos personales y el `estado` son los de su `Usuario`. No viaja por HTTP desde acá.
 */
export type ProfesorDeMateria = { id: number; apellido: string; nombre: string; estado: Estado }
