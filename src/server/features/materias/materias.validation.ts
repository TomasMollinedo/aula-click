import { z } from '@hono/zod-openapi'
import { auditoriaSchema } from '@/server/shared/auditoria'
import { paginacionQuerySchema, paginatedSchema } from '@/server/shared/paginacion'
import { textoRequerido } from '@/server/shared/zod'

// Schemas Zod de entrada, salida y params. Son la fuente del OpenAPI. Sin reglas de negocio:
// la unicidad del nombre la hace cumplir la base y los profesores asignados los trae el service.

const Q_MAX = 100
const NOMBRE_MAX = 100
const DESCRIPCION_MAX = 500

/** Valores del enum `Estado` (el repository comprueba que coincidan con Prisma). */
export const ESTADOS = ['ACTIVO', 'INACTIVO'] as const

/** `ACTIVO` o `INACTIVO`: el estado con el que se guarda una materia. */
export type EstadoMateria = (typeof ESTADOS)[number]

/** Valores del filtro `estado` del listado: los de `Estado` más `TODOS` (sin filtrar). */
export const ESTADOS_FILTRO = [...ESTADOS, 'TODOS'] as const

const VACIO = 'Opcional: acepta null, y "" o solo espacios se guarda como null'

/**
 * Texto opcional del body: acepta `null`, omitirse o un texto; `""` o solo espacios se guarda como
 * `null` (el formulario manda `""`). Es el mismo que el `textoOpcional` de `alumnos.validation`:
 * se extrae a `shared/` en la tercera repetición (`convenciones-backend.md` → `src/server/shared/`).
 *
 * Con `.pipe()` el OpenAPI solo ve un `string`: `openapi` agrega lo que se pierde (largo).
 */
function textoOpcional(max: number, description: string, example?: string) {
  return z
    .string({ error: 'Debe ser un texto' })
    .trim()
    .transform((valor) => (valor === '' ? null : valor))
    .pipe(
      z
        .string()
        .max(max, { error: `No puede superar los ${max} caracteres` })
        .nullable(),
    )
    .openapi({ description: `${description}. ${VACIO}`, example, maxLength: max })
    .nullable()
    .optional()
}

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
  q: z
    .string({ error: 'Debe ser un texto' })
    .trim()
    .max(Q_MAX, { error: `No puede superar los ${Q_MAX} caracteres` })
    .optional()
    .openapi({
      param: { name: 'q', in: 'query' },
      description:
        'Búsqueda por nombre. Cada palabra coincide en forma parcial y todas deben coincidir; no distingue mayúsculas ni tildes',
      example: 'mate',
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

/** Profesor que dicta la materia. Los datos personales y el estado son los de su `Usuario`. */
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
