import { createRoute, z } from '@hono/zod-openapi'
import { ErrorResponseSchema } from '@/server/errors'
import { requireAuth, requireRole } from '@/server/middlewares/auth'
import { createRouter } from '@/server/router'
import * as historialesController from './historiales.controller'
import {
  ejemploHistorialDelAlumno,
  ejemploMiMateria,
  ejemploMisMaterias,
} from './historiales.ejemplos'
import {
  alumnoIdParamsSchema,
  historialDelAlumnoSchema,
  historialPdfQuerySchema,
  historialQuerySchema,
  miMateriaParamsSchema,
  miMateriaQuerySchema,
  miMateriaSchema,
  misMateriasSchema,
} from './historiales.validation'

// Contrato HTTP de `historiales` (historial académico, T-108): el historial de un alumno para la
// ficha (HU-31) y "Mis materias" del portal (HU-33). Sólo lectura y sin tablas propias: la
// asistencia se registra y se corrige desde `asistencias` (HU-22).

const tags = ['Historiales']

function respuestaError(description: string) {
  return {
    description,
    content: { 'application/json': { schema: ErrorResponseSchema } },
  }
}

// El 200 de un documento: el cuerpo binario del PDF (docs/contrato-api.md → Documentos PDF).
function respuestaPdf(description: string) {
  return {
    description,
    content: { 'application/pdf': { schema: z.string().openapi({ format: 'binary' }) } },
  }
}

export const historialDelAlumnoRoute = createRoute({
  method: 'get',
  path: '/alumnos/{alumnoId}',
  tags,
  summary: 'Historial académico de un alumno',
  description:
    'Las clases del alumno en `[desde, hasta]` agrupadas por **materia y profesor**, cada grupo con su resumen (realizadas, ausencias y porcentaje: cada hora cuenta como un turno; los cancelados, los sin registrar y los agendados no cuentan) y sus **bloques de horas seguidas**, de la fecha más reciente a la más antigua. Cada bloque trae "Qué se trabajó" e indicaciones una sola vez, y cada clase (una hora) su estado, su plazo de asistencia, la observación de la ausencia o la del cierre del sistema, el motivo de un cancelado y sus textos propios si difieren. Sin `desde` ni `hasta`, el **mes en curso**; sólo llegan las clases de hoy o anteriores (los turnos futuros están en los turnos del alumno). `opciones` sale del historial completo del alumno, para los filtros. `PROFESOR` ve el historial completo de su alumno (también las clases de otras materias y profesores), y 403 con un alumno que no tiene o tuvo turnos con él.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS', 'PROFESOR')] as const,
  request: { params: alumnoIdParamsSchema, query: historialQuerySchema },
  responses: {
    200: {
      description: 'Historial del alumno (`grupos` vacío si no hay clases en el período)',
      content: {
        'application/json': {
          schema: historialDelAlumnoSchema,
          example: ejemploHistorialDelAlumno,
        },
      },
    },
    400: respuestaError(
      '`alumnoId` inválido, una fecha inválida, `hasta` anterior a `desde` o un período de más de 366 días (`details` sobre `hasta`) (VALIDACION)',
    ),
    401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
    403: respuestaError(
      'El rol no es mesa de entradas ni profesor, el alumno no tiene ni tuvo turnos con el profesor de la sesión, o el usuario está inhabilitado (SIN_PERMISO)',
    ),
    404: respuestaError('El alumno no existe (NO_ENCONTRADO)'),
  },
})

export const historialDelAlumnoPdfRoute = createRoute({
  method: 'get',
  path: '/alumnos/{alumnoId}/pdf',
  tags,
  summary: 'Historial académico de un alumno, en PDF',
  description:
    'El historial académico del alumno **de un mes** como documento oficial en PDF (A4, HU-32): el alumno con su nivel de escolaridad, el mes y los filtros aplicados; por cada materia y profesor, su resumen y sus clases en **bloques de horas seguidas** (el estado de cada hora, y "Qué se trabajó" e indicaciones una sola vez); los turnos cancelados del mes con su motivo; y los exámenes del mes con su nota. Sale del **mismo cálculo** que `GET /historiales/alumnos/{alumnoId}`, con `mes` en lugar de `desde`/`hasta` (por defecto, el mes en curso). No lleva las observaciones internas del alumno ni de los turnos. Archivo `historial-academico-<apellido>-<nombre>-<mes>.pdf`. Los errores responden JSON.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: { params: alumnoIdParamsSchema, query: historialPdfQuerySchema },
  responses: {
    200: respuestaPdf('El PDF del historial académico del mes'),
    400: respuestaError('`alumnoId`, `mes`, `materiaId` o `profesorId` inválidos (VALIDACION)'),
    401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
    403: respuestaError(
      'El rol no es mesa de entradas o el usuario está inhabilitado (SIN_PERMISO)',
    ),
    404: respuestaError('El alumno no existe (NO_ENCONTRADO)'),
  },
})

// Portal (HU-33): el alumno sale de la sesión, nunca de un parámetro.
export const misMateriasRoute = createRoute({
  method: 'get',
  path: '/mis-materias',
  tags,
  summary: 'Mis materias (portal del alumno)',
  description:
    'Cada materia y profesor en los que el alumno de la sesión tiene o tuvo turnos ("Inglés — Prof. Ruiz"), con su **próximo turno** (la primera clase no cancelada de hoy en adelante, hasta 366 días; `null` si no tiene) y su **porcentaje de asistencia** sobre todo su historial en esa materia con ese profesor. Sin paginar, por nombre de materia y apellido del profesor.',
  middleware: [requireAuth(), requireRole('ALUMNO')] as const,
  request: {},
  responses: {
    200: {
      description: 'Mis materias (arreglo vacío si todavía no tiene turnos)',
      content: {
        'application/json': { schema: misMateriasSchema, example: ejemploMisMaterias },
      },
    },
    401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
    403: respuestaError(
      'El rol no es alumno, el usuario está inhabilitado o la cuenta no tiene alumno (SIN_PERMISO)',
    ),
  },
})

export const miMateriaRoute = createRoute({
  method: 'get',
  path: '/mis-materias/{materiaId}/{profesorId}',
  tags,
  summary: 'Mi historial de una materia (portal del alumno)',
  description:
    'El historial del alumno de la sesión en una materia con un profesor: las "Indicaciones para la próxima clase" (las de la última clase realizada con indicaciones, de **cualquier** fecha, también anterior al mes), el resumen del mes y sus clases en **bloques de horas seguidas**, con la misma forma que el historial de la ficha. Por defecto, el mes en curso. El alumno no ve las observaciones internas, el motivo de la cancelación ni datos de otros alumnos, y las clases **"Sin registrar" y agendadas no se muestran** (HU-33 sólo nombra "Realizado", "Ausente" y "Cancelado").',
  middleware: [requireAuth(), requireRole('ALUMNO')] as const,
  request: { params: miMateriaParamsSchema, query: miMateriaQuerySchema },
  responses: {
    200: {
      description: 'Mi historial de esa materia (`bloques` vacío si no hay clases en el mes)',
      content: { 'application/json': { schema: miMateriaSchema, example: ejemploMiMateria } },
    },
    400: respuestaError('`materiaId`, `profesorId` o `mes` inválidos (VALIDACION)'),
    401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
    403: respuestaError(
      'El rol no es alumno, el usuario está inhabilitado o la cuenta no tiene alumno (SIN_PERMISO)',
    ),
    404: respuestaError('El alumno no cursa ni cursó esa materia con ese profesor (NO_ENCONTRADO)'),
  },
})

// Las de `mis-materias` van primero: `/mis-materias/{materiaId}/{profesorId}` no debe caer en
// `/alumnos/{alumnoId}` ni al revés (son prefijos distintos, pero el orden lo deja explícito, como
// en `ocurrencias`).
export const historialesRoutes = createRouter()
  .openapi(misMateriasRoute, historialesController.misMaterias)
  .openapi(miMateriaRoute, historialesController.miMateria)
  .openapi(historialDelAlumnoPdfRoute, historialesController.historialDelAlumnoPdf)
  .openapi(historialDelAlumnoRoute, historialesController.historialDelAlumno)
