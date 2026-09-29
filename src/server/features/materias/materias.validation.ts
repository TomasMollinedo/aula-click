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
// Tope de `Decimal(10,2)`: 8 dígitos enteros y 2 decimales. Uno mayor desbordaría la columna.
const PRECIO_MAX = 99_999_999.99
// Se valida sobre `String(valor)`, la representación más corta que vuelve al mismo número
// (`1.13` → `"1.13"`): multiplicar por 100 falla con floats (`1.13 * 100 = 112.99999999999999`).
// `1.005` o `1e-7` no pasan: tienen más de dos decimales.
const PRECIO_FORMATO = /^\d+(\.\d{1,2})?$/

/**
 * Precio por hora de clase (HU-12), en pesos: número JSON mayor a 0 con hasta dos decimales. No
 * acepta `null`: desde la API una materia nunca queda sin precio. Viaja a Prisma como texto
 * (`materias.repository`), así el `Decimal` no pasa por un float (decisión T-46).
 */
const precioHoraEntrada = z
  .number({ error: 'Debe ser un número' })
  .positive({ error: 'El precio debe ser mayor a 0' })
  .max(PRECIO_MAX, { error: `El precio no puede superar ${PRECIO_MAX}` })
  .refine((valor) => PRECIO_FORMATO.test(String(valor)), {
    error: 'El precio puede tener hasta dos decimales',
  })
  .openapi({
    description: 'Precio por hora de clase en pesos: mayor a 0, con hasta dos decimales',
    example: 8000.5,
  })

/** Precio en las respuestas: `null` solo en materias anteriores a HU-12 ("Sin precio"). */
const precioSalida = {
  precioHora: z.number().nullable().openapi({
    description: 'Precio por hora en pesos, con hasta dos decimales. `null`: sin precio',
    example: 8000.5,
  }),
  sinPrecio: z.boolean().openapi({
    description: 'No tiene precio cargado: queda inactiva hasta que el gerente se lo cargue',
    example: false,
  }),
}

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
    ...precioSalida,
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
    precioHora: precioHoraEntrada,
  })
  .openapi('MateriaCrear')

export type CrearMateria = z.infer<typeof crearMateriaSchema>

/**
 * Edición parcial: lo omitido no cambia. `nombre` y `precioHora` no aceptan `null`; `descripcion`
 * sí (la borra). Un body sin ningún campo conocido responde 400.
 */
export const editarMateriaSchema = crearMateriaSchema
  .partial()
  .refine((cambios) => Object.values(cambios).some((valor) => valor !== undefined), {
    error: 'Debe enviar al menos un campo',
  })
  .openapi('MateriaEditar')

export type EditarMateria = z.infer<typeof editarMateriaSchema>

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
    ...precioSalida,
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
