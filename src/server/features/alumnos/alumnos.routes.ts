import { createRoute } from '@hono/zod-openapi'
import { ErrorResponseSchema } from '@/server/errors'
import { requireAuth, requireRole } from '@/server/middlewares/auth'
import { createRouter } from '@/server/router'
import * as alumnosController from './alumnos.controller'
import {
  ejemploAltaAdulto,
  ejemploAltaMenor,
  ejemploDetalle,
  ejemploEdicion,
  ejemploErrorDni,
  ejemploErrorFoto,
  ejemploErrorTutor,
  ejemploListado,
  ejemploMiPerfil,
  ejemploMisAlumnos,
} from './alumnos.ejemplos'
import {
  alumnoDetalleSchema,
  alumnoIdParamsSchema,
  alumnosDeProfesorListadoSchema,
  alumnosListadoSchema,
  crearAlumnoSchema,
  editarAlumnoSchema,
  listarAlumnosQuerySchema,
  listarMisAlumnosQuerySchema,
  miPerfilSchema,
  subirFotoAlumnoSchema,
  usuarioSugeridoQuerySchema,
  usuarioSugeridoSchema,
} from './alumnos.validation'

// Contrato HTTP de alumnos: cada endpoint se declara con createRoute() y se registra acá.

const tags = ['Alumnos']

function respuestaError(description: string, example?: unknown) {
  return {
    description,
    content: {
      'application/json': { schema: ErrorResponseSchema, ...(example ? { example } : {}) },
    },
  }
}

const errores = {
  400: respuestaError('Datos de entrada inválidos (VALIDACION)'),
  401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
  403: respuestaError('El rol no es mesa de entradas o el usuario está inhabilitado'),
}
const noEncontrado = respuestaError('El alumno no existe (NO_ENCONTRADO)')
const dniDuplicado = respuestaError('Ya existe un alumno con ese DNI (CONFLICTO)', ejemploErrorDni)
const validacionConTutor = respuestaError(
  'Datos de entrada inválidos (VALIDACION): formato, fecha de nacimiento futura, datos del tutor faltantes en un menor, email/teléfono faltantes en un mayor, o un `dni` en la edición (no se puede modificar)',
  ejemploErrorTutor,
)

const detalle = (description: string) => ({
  description,
  content: { 'application/json': { schema: alumnoDetalleSchema, example: ejemploDetalle } },
})

export const listarAlumnosRoute = createRoute({
  method: 'get',
  path: '/',
  tags,
  summary: 'Listar alumnos',
  description:
    'Listado paginado ordenado por apellido y nombre. `q` busca por palabras sobre apellido, nombre y DNI.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: { query: listarAlumnosQuerySchema },
  responses: {
    200: {
      description: 'Página de alumnos',
      content: { 'application/json': { schema: alumnosListadoSchema, example: ejemploListado } },
    },
    ...errores,
  },
})

// Se registra antes de `/{id}`: si no, `/mis-alumnos` caería en ese path param (ver el mismo
// cuidado en `turnos.routes.ts` con `/agenda`, `/materias` y `/aulas` antes de `/{turnoId}`).
export const listarMisAlumnosRoute = createRoute({
  method: 'get',
  path: '/mis-alumnos',
  tags,
  summary: 'Alumnos del profesor de la sesión',
  description:
    'Listado paginado de los alumnos con al menos un turno vigente (activo y no vencido) con el profesor de la sesión (sale del `Actor`, nunca de un parámetro). Mismo orden y búsqueda que el listado general; `materiaId` acota a una sola materia. Cada alumno trae también `materias`: todas las que cursa vigente con este profesor (no solo la del filtro), para que se entienda por qué aparece.',
  middleware: [requireAuth(), requireRole('PROFESOR')] as const,
  request: { query: listarMisAlumnosQuerySchema },
  responses: {
    200: {
      description: 'Página de alumnos del profesor (arreglo vacío si no tiene ninguno)',
      content: {
        'application/json': { schema: alumnosDeProfesorListadoSchema, example: ejemploMisAlumnos },
      },
    },
    400: respuestaError('Datos de entrada inválidos (VALIDACION)'),
    401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
    403: respuestaError('El rol no es profesor o el usuario está inhabilitado'),
    404: respuestaError('El usuario de la sesión no tiene ficha de profesor (NO_ENCONTRADO)'),
  },
})

// También antes de `/{id}`, por lo mismo que `/mis-alumnos`.
export const usuarioSugeridoRoute = createRoute({
  method: 'get',
  path: '/usuario-sugerido',
  tags,
  summary: 'Usuario del portal que se le asignaría al alumno',
  description:
    'Arma el usuario con la regla de HU-27 (inicial del nombre + apellido + últimos 3 dígitos del DNI, en minúsculas, sin espacios ni tildes y con la "ñ" como "n"; con sufijo `-2`, `-3`… si ya está tomado) para mostrarlo en el formulario de alta. Es una **sugerencia**: el usuario definitivo se calcula al guardar, porque entre la consulta y el alta otro alumno puede quedarse con él.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: { query: usuarioSugeridoQuerySchema },
  responses: {
    200: {
      description: 'Usuario sugerido',
      content: {
        'application/json': { schema: usuarioSugeridoSchema, example: { usuario: 'jperez456' } },
      },
    },
    ...errores,
  },
})

// Endpoint del portal (`mi-…`): el alumno sale de la sesión. También antes de `/{id}`.
export const miPerfilRoute = createRoute({
  method: 'get',
  path: '/mi-perfil',
  tags,
  summary: 'Perfil del alumno de la sesión',
  description:
    'Nombre, apellido, usuario de ingreso y foto del alumno de la sesión (sale del `Actor`, nunca de un parámetro), para el menú del portal. No devuelve ningún otro dato de la ficha.',
  middleware: [requireAuth(), requireRole('ALUMNO')] as const,
  request: {},
  responses: {
    200: {
      description: 'Perfil del alumno',
      content: { 'application/json': { schema: miPerfilSchema, example: ejemploMiPerfil } },
    },
    401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
    403: respuestaError('El rol no es alumno, o la cuenta no tiene alumno vinculado (SIN_PERMISO)'),
    404: respuestaError('El alumno de la sesión no existe (NO_ENCONTRADO)'),
  },
})

export const obtenerAlumnoRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags,
  summary: 'Detalle de un alumno',
  description:
    'Todos los datos del alumno, si es menor de edad y quién lo creó y modificó. El único endpoint de alumnos que también admite el rol PROFESOR (sin poder editar: PATCH sigue siendo solo de MESA_ENTRADAS).',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS', 'PROFESOR')] as const,
  request: { params: alumnoIdParamsSchema },
  responses: {
    200: detalle('Detalle del alumno'),
    ...errores,
    403: respuestaError(
      'El rol no es mesa de entradas ni profesor, o el usuario está inhabilitado',
    ),
    404: noEncontrado,
  },
})

export const crearAlumnoRoute = createRoute({
  method: 'post',
  path: '/',
  tags,
  summary: 'Dar de alta un alumno',
  description:
    'Obligatorios: nombre, apellido, DNI y fecha de nacimiento. Si es mayor de edad, también su email y su teléfono. Si es menor, en cambio, nombre, apellido, teléfono y email del tutor (el email y el teléfono propios del alumno son opcionales).',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: crearAlumnoSchema,
          examples: {
            adulto: { summary: 'Adulto con los datos mínimos', value: ejemploAltaAdulto },
            menor: { summary: 'Menor con los datos del tutor', value: ejemploAltaMenor },
          },
        },
      },
    },
  },
  responses: {
    201: detalle('Alumno creado'),
    ...errores,
    400: validacionConTutor,
    409: dniDuplicado,
  },
})

export const editarAlumnoRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  tags,
  summary: 'Editar un alumno',
  description:
    'Edición parcial: lo omitido no cambia y `null` borra un dato opcional. Las reglas de contacto (tutor si es menor, email y teléfono propios si es mayor) se evalúan sobre el alumno resultante. El DNI no se puede modificar: un `dni` en el body responde 400.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: {
    params: alumnoIdParamsSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: editarAlumnoSchema, example: ejemploEdicion } },
    },
  },
  responses: {
    200: detalle('Alumno actualizado'),
    ...errores,
    400: validacionConTutor,
    404: noEncontrado,
  },
})

export const subirFotoRoute = createRoute({
  method: 'post',
  path: '/{id}/foto',
  tags,
  summary: 'Subir o reemplazar la foto del alumno',
  description:
    'Multipart con un único campo `foto` (JPG o PNG, hasta 5 MB). Si ya tenía una, la reemplaza y borra la anterior. Actualiza la auditoría del alumno.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: {
    params: alumnoIdParamsSchema,
    body: { required: true, content: { 'multipart/form-data': { schema: subirFotoAlumnoSchema } } },
  },
  responses: {
    200: detalle('Alumno con la foto actualizada'),
    ...errores,
    400: respuestaError(
      'La foto no es JPG ni PNG, o supera el tamaño máximo (VALIDACION)',
      ejemploErrorFoto,
    ),
    404: noEncontrado,
  },
})

export const quitarFotoRoute = createRoute({
  method: 'delete',
  path: '/{id}/foto',
  tags,
  summary: 'Quitar la foto del alumno',
  description: 'Borra el objeto y limpia la clave. Sin foto no es un error: no cambia nada.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: { params: alumnoIdParamsSchema },
  responses: {
    200: detalle('Alumno sin foto'),
    ...errores,
    404: noEncontrado,
  },
})

export const crearAccesoRoute = createRoute({
  method: 'post',
  path: '/{id}/acceso',
  tags,
  summary: 'Crear el acceso al portal de un alumno',
  description:
    'Para los alumnos anteriores a este incremento (HU-27): genera el usuario con la misma regla del alta y deja el DNI (sin puntos) como contraseña inicial. La contraseña no se devuelve. Si el alumno ya tiene acceso, 409.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: { params: alumnoIdParamsSchema },
  responses: {
    201: detalle('Alumno con su acceso al portal'),
    ...errores,
    404: noEncontrado,
    409: respuestaError('El alumno ya tiene acceso al portal (CONFLICTO)'),
  },
})

export const restablecerContrasenaRoute = createRoute({
  method: 'post',
  path: '/{id}/acceso/restablecimiento',
  tags,
  summary: 'Restablecer la contraseña del alumno',
  description:
    'La contraseña vuelve a ser el DNI del alumno (sin puntos) y queda marcada como inicial, para que el portal recomiende cambiarla (HU-28). Registra quién la restableció y cuándo. Si el alumno no tiene acceso, 409.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: { params: alumnoIdParamsSchema },
  responses: {
    200: detalle('Alumno con la contraseña restablecida'),
    ...errores,
    404: noEncontrado,
    409: respuestaError('El alumno no tiene acceso al portal (CONFLICTO)'),
  },
})

export const alumnosRoutes = createRouter()
  .openapi(listarAlumnosRoute, alumnosController.listar)
  .openapi(listarMisAlumnosRoute, alumnosController.listarMisAlumnos)
  .openapi(usuarioSugeridoRoute, alumnosController.usuarioSugerido)
  .openapi(miPerfilRoute, alumnosController.miPerfil)
  .openapi(obtenerAlumnoRoute, alumnosController.obtener)
  .openapi(crearAlumnoRoute, alumnosController.crear)
  .openapi(editarAlumnoRoute, alumnosController.editar)
  .openapi(subirFotoRoute, alumnosController.subirFoto)
  .openapi(quitarFotoRoute, alumnosController.quitarFoto)
  .openapi(crearAccesoRoute, alumnosController.crearAcceso)
  .openapi(restablecerContrasenaRoute, alumnosController.restablecerContrasena)
