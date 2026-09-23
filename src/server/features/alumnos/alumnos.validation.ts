import { z } from '@hono/zod-openapi'
import { auditoriaSchema } from '@/server/shared/auditoria'
import { ESTADOS } from '@/server/shared/estado'
import { qBusqueda } from '@/server/shared/busqueda'
import { paginacionQuerySchema, paginatedSchema } from '@/server/shared/paginacion'
import { dni, email, fechaISO, telefono, textoRequerido } from '@/server/shared/zod'

// Schemas Zod de entrada, salida y params. Son la fuente del OpenAPI. Sin reglas de negocio:
// la edad y el tutor de los menores los decide el service.

/** Valores del enum `NivelEscolaridad` (el repository comprueba que coincidan con Prisma). */
export const NIVELES_ESCOLARIDAD = [
  'INICIAL',
  'PRIMARIO',
  'SECUNDARIO',
  'TERCIARIO',
  'UNIVERSITARIO',
] as const

export const nivelEscolaridadSchema = z
  .enum(NIVELES_ESCOLARIDAD, {
    error: `Nivel de escolaridad inválido: debe ser ${NIVELES_ESCOLARIDAD.join(', ')}`,
  })
  .openapi({ description: 'Nivel de escolaridad', example: 'SECUNDARIO' })

export type NivelEscolaridad = z.infer<typeof nivelEscolaridadSchema>

const VACIO = 'Opcional: acepta null, y "" o solo espacios se guarda como null'

/**
 * Campo opcional del body: acepta `null`, omitirse o un texto. Un texto vacío o solo con espacios
 * se guarda como `null` (el formulario manda `""`); con contenido, se valida con `primitiva`.
 * Candidato a `shared/` si profesores o materias lo repiten.
 *
 * Con `.pipe()` el OpenAPI solo ve un `string`: `openapi` agrega lo que se pierde (enum, largo).
 */
function opcional<T extends z.ZodType<unknown, string>>(
  primitiva: T,
  openapi: { description: string; example?: string; maxLength?: number; enum?: string[] },
) {
  return z
    .string({ error: 'Debe ser un texto' })
    .trim()
    .transform((valor) => (valor === '' ? null : valor))
    .pipe(primitiva.nullable())
    .openapi({ ...openapi, description: `${openapi.description}. ${VACIO}` })
    .nullable()
    .optional()
}

/** Texto opcional de hasta `max` caracteres (ver `opcional`). */
function textoOpcional(max: number, description: string, example?: string) {
  return opcional(z.string().max(max, { error: `No puede superar los ${max} caracteres` }), {
    description,
    example,
    maxLength: max,
  })
}

/** `id` del path. Uno no numérico, cero o negativo responde 400. */
export const alumnoIdParamsSchema = z.object({
  id: z.coerce
    .number({ error: 'Debe ser un número' })
    .int({ error: 'Debe ser un número entero' })
    .positive({ error: 'Debe ser mayor a 0' })
    .openapi({ param: { name: 'id', in: 'path' }, description: 'Id del alumno', example: 12 }),
})

/** Query del listado: paginación + `q` (búsqueda por palabras sobre apellido, nombre y DNI). */
export const listarAlumnosQuerySchema = paginacionQuerySchema.extend({
  q: qBusqueda.openapi({
    description:
      'Búsqueda por apellido, nombre o DNI. Cada palabra coincide en forma parcial y todas deben coincidir; no distingue mayúsculas ni tildes, ignora los puntos y usa las primeras 5 palabras (hasta 100 caracteres)',
  }),
})

export type ListarAlumnosQuery = z.infer<typeof listarAlumnosQuerySchema>

export const alumnoListadoItemSchema = z
  .object({ id: z.number().int(), apellido: z.string(), nombre: z.string() })
  .openapi('AlumnoListadoItem')

export type AlumnoListadoItem = z.infer<typeof alumnoListadoItemSchema>

export const alumnosListadoSchema = paginatedSchema(alumnoListadoItemSchema)

export type AlumnosListado = z.infer<typeof alumnosListadoSchema>

// Campos del body. Obligatorios: nombre, apellido, DNI, fecha de nacimiento, email y teléfono (T-25).
// busqueda, estado y la auditoría no están: z.object descarta las claves desconocidas.
const camposObligatorios = {
  nombre: textoRequerido(100),
  apellido: textoRequerido(100),
  dni,
  fechaNacimiento: fechaISO,
  email,
  telefono,
}

const camposOpcionales = {
  nivelEscolaridad: opcional(nivelEscolaridadSchema, {
    description: 'Nivel de escolaridad',
    enum: [...NIVELES_ESCOLARIDAD],
    example: 'SECUNDARIO',
  }),
  grado: textoOpcional(50, 'Grado o año', '5° año'),
  institucionEducativa: textoOpcional(150, 'Institución educativa (colegio)'),
  observaciones: textoOpcional(2000, 'Observaciones'),
  tutorNombre: textoOpcional(100, 'Nombre del tutor. Obligatorio si el alumno es menor'),
  tutorApellido: textoOpcional(100, 'Apellido del tutor. Obligatorio si el alumno es menor'),
  tutorDni: opcional(dni, { description: 'DNI del tutor (7 u 8 dígitos)', example: '20111222' }),
  tutorTelefono: opcional(telefono, {
    description: 'Teléfono del tutor. Obligatorio si el alumno es menor',
    example: '(387) 15-433-9876',
  }),
  tutorEmail: opcional(email, {
    description: 'Email del tutor. Obligatorio si el alumno es menor',
    example: 'marta.alvarez@mail.com',
  }),
}

export const crearAlumnoSchema = z
  .object({ ...camposObligatorios, ...camposOpcionales })
  .openapi('AlumnoCrear')

export type CrearAlumno = z.infer<typeof crearAlumnoSchema>

/**
 * Edición parcial: lo omitido no cambia. Los obligatorios no aceptan `null`; los opcionales sí
 * (borra el dato). Un body sin ningún campo conocido responde 400.
 */
export const editarAlumnoSchema = z
  .object({ ...camposObligatorios, ...camposOpcionales })
  .partial()
  .refine((cambios) => Object.values(cambios).some((valor) => valor !== undefined), {
    error: 'Debe enviar al menos un campo',
  })
  .openapi('AlumnoEditar')

export type EditarAlumno = z.infer<typeof editarAlumnoSchema>

const textoNullable = z.string().nullable()

/** Detalle del alumno: todos sus datos, `menorDeEdad` (lo calcula la API) y la auditoría. */
export const alumnoDetalleSchema = z
  .object({
    id: z.number().int(),
    nombre: z.string(),
    apellido: z.string(),
    dni: z.string(),
    fechaNacimiento: fechaISO,
    email: z.string(),
    telefono: z.string(),
    nivelEscolaridad: nivelEscolaridadSchema.nullable(),
    grado: textoNullable,
    institucionEducativa: textoNullable,
    observaciones: textoNullable,
    tutorNombre: textoNullable,
    tutorApellido: textoNullable,
    tutorDni: textoNullable,
    tutorTelefono: textoNullable,
    tutorEmail: textoNullable,
    estado: z.enum(ESTADOS),
    menorDeEdad: z.boolean().openapi({
      description: 'Si hoy (hora de Salta) el alumno tiene menos de 18 años. Lo calcula la API',
    }),
    ...auditoriaSchema.shape,
  })
  .openapi('AlumnoDetalle')

export type AlumnoDetalle = z.infer<typeof alumnoDetalleSchema>

/** Lo que devuelve el repository: el detalle sin lo que calcula el service. */
export type AlumnoGuardado = Omit<AlumnoDetalle, 'menorDeEdad'>
