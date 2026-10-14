import { z } from '@hono/zod-openapi'
import { archivoSchema } from '@/server/shared/archivos'
import { auditoriaSchema, usuarioAuditoriaSchema } from '@/server/shared/auditoria'
import { ESTADOS } from '@/server/shared/estado'
import { qBusqueda } from '@/server/shared/busqueda'
import { paginacionQuerySchema, paginatedSchema } from '@/server/shared/paginacion'
import {
  dni,
  email,
  fechaISO,
  nombrePersona,
  opcional,
  telefono,
  textoOpcional,
} from '@/server/shared/zod'

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

/**
 * Query de `GET /alumnos/mis-alumnos`: paginación + `q` (igual que el listado general) +
 * `materiaId` opcional, para acotar a una sola materia.
 */
export const listarMisAlumnosQuerySchema = paginacionQuerySchema.extend({
  q: qBusqueda.openapi({
    description:
      'Búsqueda por apellido, nombre o DNI, sobre los alumnos del profesor. Mismas reglas que en el listado general',
  }),
  materiaId: z.coerce
    .number({ error: 'Debe ser un número' })
    .int({ error: 'Debe ser un número entero' })
    .positive({ error: 'Debe ser mayor a 0' })
    .optional()
    .openapi({
      param: { name: 'materiaId', in: 'query' },
      description: 'Filtra por materia: solo alumnos con un turno vigente de esa materia',
      example: 3,
    }),
})

export type ListarMisAlumnosQuery = z.infer<typeof listarMisAlumnosQuerySchema>

export const alumnoListadoItemSchema = z
  .object({
    id: z.number().int(),
    apellido: z.string(),
    nombre: z.string(),
    dni: z.string(),
    fotoUrl: z
      .string()
      .nullable()
      .openapi({ description: 'URL prefirmada de la foto, o null si no tiene (HU-26)' }),
  })
  .openapi('AlumnoListadoItem')

export type AlumnoListadoItem = z.infer<typeof alumnoListadoItemSchema>

/** Fila del listado tal como la arma el repository: `avatarKey`, no `fotoUrl` (la arma el service). */
export type AlumnoListadoFila = Omit<AlumnoListadoItem, 'fotoUrl'> & { avatarKey: string | null }

export const alumnosListadoSchema = paginatedSchema(alumnoListadoItemSchema)

export type AlumnosListado = z.infer<typeof alumnosListadoSchema>

/** Materia de un turno vigente del alumno con el profesor. Resumen: solo id y nombre. */
const alumnoMateriaSchema = z
  .object({ id: z.number().int(), nombre: z.string() })
  .openapi('AlumnoMateria')

export type AlumnoMateria = z.infer<typeof alumnoMateriaSchema>

/**
 * Item de `GET /alumnos/mis-alumnos`: el mismo de `GET /alumnos` más `materias`, las materias
 * (todas, sin importar el filtro `materiaId`) que el alumno cursa vigente con ese profesor, para
 * que se entienda por qué aparece y para qué sirve filtrar por una.
 */
export const alumnoDeProfesorItemSchema = alumnoListadoItemSchema
  .extend({
    materias: z.array(alumnoMateriaSchema).openapi({
      description:
        'Materias que el alumno cursa vigente con este profesor (no se filtran por `materiaId`: son todas)',
    }),
  })
  .openapi('AlumnoDeProfesorListadoItem')

export type AlumnoDeProfesorItem = z.infer<typeof alumnoDeProfesorItemSchema>

/** Fila de `mis-alumnos` como la arma el repository: con `avatarKey` en lugar de `fotoUrl`. */
export type AlumnoDeProfesorFila = Omit<AlumnoDeProfesorItem, 'fotoUrl'> & {
  avatarKey: string | null
}

export const alumnosDeProfesorListadoSchema = paginatedSchema(alumnoDeProfesorItemSchema)

export type AlumnosDeProfesorListado = z.infer<typeof alumnosDeProfesorListadoSchema>

// Campos del body. Obligatorios siempre: nombre, apellido, DNI y fecha de nacimiento. Email y
// teléfono del alumno pasan a ser opcionales acá (T-45, corrige T-25): el service los exige solo
// si el alumno es mayor de edad (si es menor, exige en cambio los del tutor).
// busqueda, estado y la auditoría no están: z.object descarta las claves desconocidas.
const camposObligatorios = {
  nombre: nombrePersona(100),
  apellido: nombrePersona(100),
  dni,
  fechaNacimiento: fechaISO,
}

const camposOpcionales = {
  email: opcional(email, {
    description: 'Email del alumno. Obligatorio si es mayor de edad',
    example: 'juan.gonzalez@mail.com',
  }),
  telefono: opcional(telefono, {
    description: 'Teléfono del alumno. Obligatorio si es mayor de edad',
    example: '387154123456',
  }),
  nivelEscolaridad: opcional(nivelEscolaridadSchema, {
    description: 'Nivel de escolaridad',
    enum: [...NIVELES_ESCOLARIDAD],
    example: 'SECUNDARIO',
  }),
  grado: textoOpcional(50, 'Grado o año', '5° año'),
  institucionEducativa: textoOpcional(150, 'Institución educativa (colegio)'),
  observaciones: textoOpcional(2000, 'Observaciones'),
  tutorNombre: opcional(nombrePersona(100), {
    description: 'Nombre del tutor. Obligatorio si el alumno es menor',
    example: 'Marta',
    maxLength: 100,
  }),
  tutorApellido: opcional(nombrePersona(100), {
    description: 'Apellido del tutor. Obligatorio si el alumno es menor',
    example: 'Álvarez',
    maxLength: 100,
  }),
  tutorDni: opcional(dni, { description: 'DNI del tutor (7 u 8 dígitos)', example: '20111222' }),
  tutorTelefono: opcional(telefono, {
    description: 'Teléfono del tutor. Obligatorio si el alumno es menor',
    example: '387154339876',
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

/**
 * Acceso al portal del alumno. La contraseña nunca se devuelve: sólo con qué usuario ingresa,
 * quién creó el acceso y quién restableció la contraseña por última vez (T-135).
 */
export const accesoAlumnoSchema = z
  .object({
    usuario: z.string().openapi({ description: 'Usuario de ingreso', example: 'jperez456' }),
    creadoPor: usuarioAuditoriaSchema.nullable().openapi({
      description: 'Quién creó el acceso (null si lo creó el seed)',
    }),
    creadoEl: z.iso.datetime().openapi({ description: 'Cuándo se creó el acceso' }),
    restablecidaPor: usuarioAuditoriaSchema.nullable().openapi({
      description: 'Quién restableció la contraseña por última vez, o null',
    }),
    restablecidaEl: z.iso
      .datetime()
      .nullable()
      .openapi({ description: 'Cuándo se restableció por última vez, o null' }),
  })
  .openapi('AccesoAlumno')

export type AccesoAlumno = z.infer<typeof accesoAlumnoSchema>

const textoNullable = z.string().nullable()

/** Detalle del alumno: todos sus datos, `menorDeEdad` (lo calcula la API) y la auditoría. */
export const alumnoDetalleSchema = z
  .object({
    id: z.number().int(),
    nombre: z.string(),
    apellido: z.string(),
    dni: z.string(),
    fechaNacimiento: fechaISO,
    // Nullable (T-29): son opcionales para un alumno menor con tutor. La obligatoriedad según la
    // edad la valida el alta/edición (T-37); acá solo se refleja lo que puede venir de la base.
    email: z.string().nullable(),
    telefono: z.string().nullable(),
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
    fotoUrl: z.string().nullable().openapi({
      description: 'URL prefirmada de la foto (HU-26), o null si no tiene',
    }),
    acceso: accesoAlumnoSchema.nullable().openapi({
      description: 'Acceso al portal (HU-27), o null si el alumno todavía no lo tiene',
    }),
    ...auditoriaSchema.shape,
  })
  .openapi('AlumnoDetalle')

export type AlumnoDetalle = z.infer<typeof alumnoDetalleSchema>

/**
 * Lo que devuelve el repository: el detalle sin lo que calcula el service (`menorDeEdad`) y con
 * `avatarKey` en lugar de `fotoUrl` (la URL prefirmada la arma el service).
 */
export type AlumnoGuardado = Omit<AlumnoDetalle, 'menorDeEdad' | 'fotoUrl'> & {
  avatarKey: string | null
}

// ---------------------------------------------------------------------------------------------
// Foto (HU-26)
// ---------------------------------------------------------------------------------------------

/** Tipos aceptados de la foto: MIME → extensión con la que se guarda. Como la del profesor. */
export const FOTO_EXTENSIONES = { 'image/jpeg': 'jpg', 'image/png': 'png' } as const

export type FotoMimeType = keyof typeof FOTO_EXTENSIONES

export const FOTO_MAX_BYTES = 5 * 1024 * 1024

/** Multipart con un único campo `foto`. Mismos mensajes que la del profesor (HU-26 amplía HU-03). */
export const subirFotoAlumnoSchema = z.object({
  foto: archivoSchema({
    tipos: FOTO_EXTENSIONES,
    maxBytes: FOTO_MAX_BYTES,
    mensajes: {
      tipo: 'La foto debe ser JPG o PNG',
      tamano: `La foto no puede superar los ${FOTO_MAX_BYTES / (1024 * 1024)} MB`,
    },
  }).openapi({ description: 'Foto del alumno (JPG o PNG, hasta 5 MB)' }),
})

// ---------------------------------------------------------------------------------------------
// Acceso al portal (HU-27) y perfil del alumno (HU-28)
// ---------------------------------------------------------------------------------------------

/** Query de `GET /alumnos/usuario-sugerido`: los tres datos con los que se arma el usuario. */
export const usuarioSugeridoQuerySchema = z.object({
  nombre: nombrePersona(100).openapi({
    param: { name: 'nombre', in: 'query' },
    description: 'Nombre del alumno',
    example: 'Juan',
  }),
  apellido: nombrePersona(100).openapi({
    param: { name: 'apellido', in: 'query' },
    description: 'Apellido del alumno',
    example: 'Pérez',
  }),
  dni: dni.openapi({
    param: { name: 'dni', in: 'query' },
    description: 'DNI del alumno (7 u 8 dígitos; se aceptan puntos)',
    example: '45123456',
  }),
})

export type UsuarioSugeridoQuery = z.infer<typeof usuarioSugeridoQuerySchema>

export const usuarioSugeridoSchema = z
  .object({
    usuario: z.string().openapi({
      description:
        'Usuario que se le asignaría al alumno. Es una sugerencia: el definitivo se calcula al guardar',
      example: 'jperez456',
    }),
  })
  .openapi('UsuarioSugerido')

export type UsuarioSugerido = z.infer<typeof usuarioSugeridoSchema>

/** `GET /alumnos/mi-perfil` (rol ALUMNO): lo que el portal muestra en su menú (HU-28). */
export const miPerfilSchema = z
  .object({
    nombre: z.string(),
    apellido: z.string(),
    usuario: z.string().nullable().openapi({ description: 'Usuario de ingreso, o null' }),
    fotoUrl: z.string().nullable().openapi({ description: 'URL prefirmada de la foto, o null' }),
  })
  .openapi('MiPerfilAlumno')

export type MiPerfil = z.infer<typeof miPerfilSchema>

/** Lo que devuelve el repository para el perfil: con `avatarKey` en lugar de `fotoUrl`. */
export type MiPerfilGuardado = Omit<MiPerfil, 'fotoUrl'> & { avatarKey: string | null }
