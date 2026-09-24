import { z } from '@hono/zod-openapi'
import { LARGO_MAXIMO_PASSWORD, LARGO_MINIMO_PASSWORD } from '@/lib/auth-reglas'
import { auditoriaSchema } from '@/server/shared/auditoria'
import { qBusqueda } from '@/server/shared/busqueda'
import { ESTADOS, type Estado } from '@/server/shared/estado'
import { paginacionQuerySchema, paginatedSchema } from '@/server/shared/paginacion'
import { dni, email, nombrePersona, telefono, textoRequerido } from '@/server/shared/zod'

// Schemas Zod de entrada, salida y params. Son la fuente del OpenAPI. Sin reglas de negocio.

const NOMBRE_MAX = 100
const TITULO_MAX = 150
const MATRICULA_MAX = 50

/**
 * Cantidad máxima de alumnos que el profesor puede atender a la vez en una franja de una hora
 * (HU-02, decisión T-27 de `decisiones.md`). Entero obligatorio >= 1.
 */
const capacidad = z
  .number({ error: 'Debe ser un número' })
  .int({ error: 'Debe ser un número entero' })
  .min(1, { error: 'Debe ser mayor o igual a 1' })
  .openapi({
    description:
      'Cantidad máxima de alumnos que el profesor puede atender simultáneamente en una misma franja horaria de una hora',
    example: 5,
  })

/** `id` del path. Uno no numérico, cero o negativo responde 400. */
export const profesorIdParamsSchema = z.object({
  id: z.coerce
    .number({ error: 'Debe ser un número' })
    .int({ error: 'Debe ser un número entero' })
    .positive({ error: 'Debe ser mayor a 0' })
    .openapi({ param: { name: 'id', in: 'path' }, description: 'Id del profesor', example: 3 }),
})

/** Valores del filtro `estado` del listado: los de `Estado` más `TODOS` (sin filtrar). */
export const ESTADOS_FILTRO = [...ESTADOS, 'TODOS'] as const

/** Query del listado: paginación + `q` + `estado` (`ACTIVO` por defecto) + `materiaId`. */
export const listarProfesoresQuerySchema = paginacionQuerySchema.extend({
  q: qBusqueda.openapi({
    description:
      'Búsqueda por apellido, nombre o DNI. Cada palabra coincide en forma parcial y todas deben coincidir; no distingue mayúsculas ni tildes, ignora los puntos y usa las primeras 5 palabras (hasta 100 caracteres)',
  }),
  estado: z
    .enum(ESTADOS_FILTRO, { error: `Estado inválido: debe ser ${ESTADOS_FILTRO.join(', ')}` })
    .default('ACTIVO')
    .openapi({
      param: { name: 'estado', in: 'query' },
      description: 'Filtro por estado. `TODOS` trae activos e inactivos',
      example: 'ACTIVO',
    }),
  materiaId: z.coerce
    .number({ error: 'Debe ser un número' })
    .int({ error: 'Debe ser un número entero' })
    .positive({ error: 'Debe ser mayor a 0' })
    .optional()
    .openapi({
      param: { name: 'materiaId', in: 'query' },
      description: 'Filtra por materia con asignación activa',
      example: 2,
    }),
})

export type ListarProfesoresQuery = z.infer<typeof listarProfesoresQuerySchema>

/** Ítem del listado: datos mínimos, estado y la URL prefirmada de la foto (si tiene). */
export const profesorListadoItemSchema = z
  .object({
    id: z.number().int(),
    apellido: z.string(),
    nombre: z.string(),
    estado: z.enum(ESTADOS),
    fotoUrl: z.string().nullable().openapi({ description: 'URL prefirmada de la foto, o null' }),
  })
  .openapi('ProfesorListadoItem')

export type ProfesorListadoItem = z.infer<typeof profesorListadoItemSchema>

export const profesoresListadoSchema = paginatedSchema(profesorListadoItemSchema)

export type ProfesoresListado = z.infer<typeof profesoresListadoSchema>

/** Fila del listado tal como la arma el repository: `avatarKey`, no `fotoUrl` (la arma el service). */
export type ProfesorListadoFila = Omit<ProfesorListadoItem, 'fotoUrl'> & {
  avatarKey: string | null
}

// Campos del body, comunes al alta y a la edición (salvo la contraseña, que no se edita).
// busqueda, estado y la auditoría no están: z.object descarta las claves desconocidas y esos
// datos los completan el service y el repository. Ningún campo acepta `null`: todos son
// obligatorios en el profesor.
const camposProfesor = {
  nombre: nombrePersona(NOMBRE_MAX),
  apellido: nombrePersona(NOMBRE_MAX),
  dni,
  telefono,
  email,
  titulo: textoRequerido(TITULO_MAX).openapi({
    description: 'Título del profesor',
    example: 'Profesor en Matemática',
  }),
  matricula: textoRequerido(MATRICULA_MAX).openapi({
    description: 'Matrícula profesional. Única entre profesores',
    example: 'MP-1234',
  }),
  capacidad,
}

export const crearProfesorSchema = z
  .object({
    ...camposProfesor,
    password: z
      .string({ error: 'Debe ser un texto' })
      .min(LARGO_MINIMO_PASSWORD, {
        error: `Debe tener al menos ${LARGO_MINIMO_PASSWORD} caracteres`,
      })
      .max(LARGO_MAXIMO_PASSWORD, {
        error: `No puede superar los ${LARGO_MAXIMO_PASSWORD} caracteres`,
      })
      .openapi({
        description: 'Contraseña inicial de la cuenta del profesor',
        example: 'inicial-2026',
      }),
  })
  .openapi('ProfesorCrear')

export type CrearProfesor = z.infer<typeof crearProfesorSchema>

/** Edición parcial: lo omitido no cambia. La contraseña no se edita (fuera de alcance). */
export const editarProfesorSchema = z
  .object(camposProfesor)
  .partial()
  .refine((cambios) => Object.values(cambios).some((valor) => valor !== undefined), {
    error: 'Debe enviar al menos un campo',
  })
  .openapi('ProfesorEditar')

export type EditarProfesor = z.infer<typeof editarProfesorSchema>

/** Detalle del profesor: sus datos, estado, foto y la auditoría (la de su `Usuario`). */
export const profesorDetalleSchema = z
  .object({
    id: z.number().int(),
    nombre: z.string(),
    apellido: z.string(),
    dni: z.string(),
    telefono: z.string(),
    email: z.string(),
    titulo: z.string(),
    matricula: z.string(),
    capacidad: z.number().int(),
    estado: z.enum(ESTADOS),
    fotoUrl: z.string().nullable().openapi({
      description: 'URL prefirmada de lectura de la foto (900 s de TTL), o null si no tiene',
    }),
    ...auditoriaSchema.shape,
  })
  .openapi('ProfesorDetalle')

export type ProfesorDetalle = z.infer<typeof profesorDetalleSchema>

/** Lo que devuelve el repository: el detalle con `avatarKey` en lugar de `fotoUrl` (la arma el service). */
export type ProfesorGuardado = Omit<ProfesorDetalle, 'fotoUrl'> & { avatarKey: string | null }

const FOTO_MAX_BYTES = 5 * 1024 * 1024

/** Tipos MIME aceptados para la foto y su extensión de archivo. */
export const FOTO_EXTENSIONES = { 'image/jpeg': 'jpg', 'image/png': 'png' } as const

export type FotoMimeType = keyof typeof FOTO_EXTENSIONES

function esFotoMimeType(tipo: string): tipo is FotoMimeType {
  return tipo in FOTO_EXTENSIONES
}

/** Body multipart para subir o reemplazar la foto: un único campo `foto` (JPG o PNG, hasta 5 MB). */
export const subirFotoSchema = z.object({
  foto: z
    .instanceof(File, { error: 'Debe subir un archivo' })
    .refine((archivo) => esFotoMimeType(archivo.type), { error: 'La foto debe ser JPG o PNG' })
    .refine((archivo) => archivo.size <= FOTO_MAX_BYTES, {
      error: `La foto no puede superar los ${FOTO_MAX_BYTES / (1024 * 1024)} MB`,
    })
    .openapi({
      type: 'string',
      format: 'binary',
      description: 'Foto del profesor (JPG o PNG, hasta 5 MB)',
    }),
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

/**
 * Lo que la feature `bloques` necesita del profesor para cargarle un bloque: su estado (el de su
 * `Usuario`) y si tiene al menos una materia asignada activa. No viaja por HTTP.
 */
export type ProfesorParaBloque = { estado: Estado; tieneMateriaActiva: boolean }
