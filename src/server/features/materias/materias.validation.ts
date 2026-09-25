import { z } from '@hono/zod-openapi'
import { auditoriaSchema } from '@/server/shared/auditoria'
import { qBusqueda } from '@/server/shared/busqueda'
import { ESTADOS, type Estado } from '@/server/shared/estado'
import { paginacionQuerySchema, paginatedSchema } from '@/server/shared/paginacion'
import { textoOpcional, textoRequerido } from '@/server/shared/zod'

// Schemas Zod de entrada, salida y params. Son la fuente del OpenAPI. Sin reglas de negocio:
// la unicidad del nombre la hace cumplir la base y los profesores asignados los trae el service.

const NOMBRE_MAX = 100
const DESCRIPCION_MAX = 500

/** Valores del filtro `estado` del listado: los de `Estado` más `TODOS` (sin filtrar). */
export const ESTADOS_FILTRO = [...ESTADOS, 'TODOS'] as const

/**
 * Materia con su estado, tal como la leen otras features (asignación de materias al profesor).
 * No viaja por HTTP: es lo que devuelve `materiasRepository.buscarPorIds`.
 */
export type MateriaConEstado = { id: number; nombre: string; estado: Estado }

/** `id` del path. Uno no numérico, cero o negativo responde 400. */
export const materiaIdParamsSchema = z.object({
  id: z.coerce
    .number({ error: 'Debe ser un número' })
    .int({ error: 'Debe ser un número entero' })
    .positive({ error: 'Debe ser mayor a 0' })
    .openapi({ param: { name: 'id', in: 'path' }, description: 'Id de la materia', example: 3 }),
})

/** Query del listado: paginación + `q` (búsqueda por palabras sobre el nombre) + `estado`. */
export const listarMateriasQuerySchema = paginacionQuerySchema.extend({
  q: qBusqueda.openapi({
    description:
      'Búsqueda por nombre. Cada palabra coincide en forma parcial y todas deben coincidir; no distingue mayúsculas ni tildes y usa las primeras 5 palabras (hasta 100 caracteres)',
  }),
  estado: z
    .enum(ESTADOS_FILTRO, {
      error: `Estado inválido: debe ser ${ESTADOS_FILTRO.join(', ')}`,
    })
    .default('ACTIVO')
    .openapi({
      param: { name: 'estado', in: 'query' },
      description: 'Filtro por estado. `TODOS` trae activas e inactivas',
      example: 'ACTIVO',
    }),
})

export type ListarMateriasQuery = z.infer<typeof listarMateriasQuerySchema>

export const materiaListadoItemSchema = z
  .object({
    id: z.number().int(),
    nombre: z.string(),
    // Va en el ítem porque con `estado=TODOS` el listado mezcla activas e inactivas.
    estado: z.enum(ESTADOS),
  })
  .openapi('MateriaListadoItem')

export type MateriaListadoItem = z.infer<typeof materiaListadoItemSchema>

export const materiasListadoSchema = paginatedSchema(materiaListadoItemSchema)

export type MateriasListado = z.infer<typeof materiasListadoSchema>

/** Ítem del selector de materias activas (dropdowns de profesores, asignaciones y turnos). */
export const materiaSelectorItemSchema = z
  .object({ id: z.number().int(), nombre: z.string() })
  .openapi('MateriaSelectorItem')

export type MateriaSelectorItem = z.infer<typeof materiaSelectorItemSchema>

export const materiasSelectorSchema = z.array(materiaSelectorItemSchema)

// El body del alta. busqueda, estado y la auditoría no están: z.object descarta las claves
// desconocidas y esos datos los completan el service y el repository.
export const crearMateriaSchema = z
  .object({
    nombre: textoRequerido(NOMBRE_MAX).openapi({
      description: 'Nombre de la materia. Único: no distingue mayúsculas ni tildes',
      example: 'Matemática',
    }),
    descripcion: textoOpcional(
      DESCRIPCION_MAX,
      'Descripción de la materia',
      'Álgebra y análisis para el ciclo básico',
    ),
  })
  .openapi('MateriaCrear')

export type CrearMateria = z.infer<typeof crearMateriaSchema>

/**
 * Profesor que dicta la materia, para el detalle. Es la forma de salida del `ProfesorDeMateria`
 * que devuelve `profesores.repository`: los datos personales y el estado son los de su `Usuario`.
 */
export const materiaProfesorSchema = z
  .object({
    id: z.number().int(),
    apellido: z.string(),
    nombre: z.string(),
    estado: z.enum(ESTADOS),
  })
  .openapi('MateriaProfesor')

export type MateriaProfesor = z.infer<typeof materiaProfesorSchema>

/** Detalle de la materia: sus datos, los profesores que la dictan y la auditoría. */
export const materiaDetalleSchema = z
  .object({
    id: z.number().int(),
    nombre: z.string(),
    descripcion: z.string().nullable(),
    estado: z.enum(ESTADOS),
    profesores: z.array(materiaProfesorSchema).openapi({
      description:
        'Profesores con una asignación activa a esta materia, ordenados por apellido y nombre',
    }),
    ...auditoriaSchema.shape,
  })
  .openapi('MateriaDetalle')

export type MateriaDetalle = z.infer<typeof materiaDetalleSchema>

/** Lo que devuelve el repository: el detalle sin los profesores, que salen de otra feature. */
export type MateriaGuardada = Omit<MateriaDetalle, 'profesores'>
