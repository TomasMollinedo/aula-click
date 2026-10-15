import { createRoute, z } from '@hono/zod-openapi'
import { ErrorResponseSchema } from '@/server/errors'
import { requireAuth, requireRole } from '@/server/middlewares/auth'
import { createRouter } from '@/server/router'
import * as tableroController from './tablero.controller'
import {
  ejemploErrorPeriodo,
  ejemploErrorSinPermiso,
  ejemploErrorSinSesion,
  ejemploTablero,
  ejemploTableroAsistencia,
} from './tablero.ejemplos'
import {
  tableroAsistenciaQuerySchema,
  tableroAsistenciaSchema,
  tableroPdfQuerySchema,
  tableroQuerySchema,
  tableroSchema,
} from './tablero.validation'

// Contrato HTTP del tablero del gerente (HU-21, T-61; secciones y PDF por sección: HU-39, T-112): los
// endpoints se declaran con createRoute() y se registran acá. El router lo creó T-32 y ya está
// registrado en `app.ts`.

function respuestaError(description: string, example: unknown) {
  return {
    description,
    content: { 'application/json': { schema: ErrorResponseSchema, example } },
  }
}

export const obtenerTableroRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Tablero'],
  summary: 'Indicadores del centro en un período (sección "General")',
  description:
    'Sólo lectura y sólo agregados: no devuelve datos de un alumno, un pago ni una agenda puntual, y se calcula al consultarlo. Turnos del período por estado (cancelados, sin registrar y, si el período incluye hoy o fechas futuras, agendados; si no, `agendados` es `null`), la asistencia (`turnos.asistio` y `turnos.noAsistio`, con cantidad y porcentaje **sobre los turnos con asistencia registrada**, y `alumnos.atendidos`, los alumnos distintos con al menos un turno realizado), ocupación (turnos no cancelados sobre la capacidad efectiva de las clases con al menos un turno no cancelado, sin recortar a 100), alumnos nuevos, las 5 materias y los 5 profesores con más turnos no cancelados, total cobrado del período (por fecha de pago, sin los pagos anulados) separado por forma de pago en `pagos.cobradoPorForma`, y total adeudado **a la fecha** (`hoy`, sin período: el mismo de `GET /cuentas/adeudados` sin filtros). Los porcentajes van de 0 a 100 con un decimal y no se ajustan para sumar 100.',
  middleware: [requireAuth(), requireRole('GERENTE')] as const,
  request: { query: tableroQuerySchema },
  responses: {
    200: {
      description: 'Indicadores del período',
      content: { 'application/json': { schema: tableroSchema, example: ejemploTablero } },
    },
    400: respuestaError(
      'Query inválido (VALIDACION): falta `desde` o `hasta`, una fecha inválida, `hasta` anterior a `desde` o un período de más de 366 días (`details` sobre `hasta`)',
      ejemploErrorPeriodo,
    ),
    401: respuestaError('Sin sesión (NO_AUTENTICADO)', ejemploErrorSinSesion),
    403: respuestaError(
      'El rol no es gerente o el usuario está inhabilitado',
      ejemploErrorSinPermiso,
    ),
  },
})

export const obtenerTableroAsistenciaRoute = createRoute({
  method: 'get',
  path: '/asistencia',
  tags: ['Tablero'],
  summary: 'Asistencia del centro en un período (sección "Asistencia")',
  description:
    'Sólo lectura y sólo agregados: nunca un alumno con nombre. `resumen`: porcentaje de asistencia del centro, turnos cerrados "Sin registrar" por el sistema (plazo de 7 días vencido), profesores con al menos un turno cerrado sin registrar y alumnos con menos de 75 % de asistencia (sólo la cantidad). `profesores` y `materias`: tablas de a 10 filas, cada una con su página (`paginaProfesores` y `paginaMaterias`), con clases realizadas, ausencias, porcentaje de asistencia, turnos cerrados sin registrar, turnos dentro del plazo y porcentaje de sin registrar; la de profesores trae además `noRegistraAsistencia`, se ordena con `orden` y `direccion` (por defecto, cerrados sin registrar de mayor a menor) y se filtra con `soloSinRegistrar`. Mismo período y mismas validaciones que `GET /tablero`.',
  middleware: [requireAuth(), requireRole('GERENTE')] as const,
  request: { query: tableroAsistenciaQuerySchema },
  responses: {
    200: {
      description: 'Asistencia del período',
      content: {
        'application/json': { schema: tableroAsistenciaSchema, example: ejemploTableroAsistencia },
      },
    },
    400: respuestaError(
      'Query inválido (VALIDACION): falta `desde` o `hasta`, una fecha inválida, `hasta` anterior a `desde`, un período de más de 366 días (`details` sobre `hasta`), una página que no es un entero >= 1, o un `orden` o una `direccion` que no existe',
      ejemploErrorPeriodo,
    ),
    401: respuestaError('Sin sesión (NO_AUTENTICADO)', ejemploErrorSinSesion),
    403: respuestaError(
      'El rol no es gerente o el usuario está inhabilitado',
      ejemploErrorSinPermiso,
    ),
  },
})

export const obtenerTableroPdfRoute = createRoute({
  method: 'get',
  path: '/pdf',
  tags: ['Tablero'],
  summary: 'Una sección del tablero en un período, en PDF',
  description:
    'Una sección del tablero como documento oficial en PDF (A4), con el mismo período y las mismas validaciones que `GET /tablero` (mismos errores 400). `seccion=general` (por defecto, así el enlace anterior a las secciones sigue funcionando) trae los indicadores de `GET /tablero`, con la asistencia y lo cobrado por forma de pago; `seccion=asistencia` trae el resumen y las tablas de profesores y materias **completas** (todas las filas, en el orden por defecto, sin filtro ni páginas). Se abre en el visor del navegador (`Content-Disposition: inline`, archivo `tablero-<desde>_<hasta>.pdf` o `tablero-asistencia-<desde>_<hasta>.pdf`) y no se guarda en caché (`Cache-Control: no-store`). "Emitido por" es el usuario de la sesión y la fecha de emisión, la del servidor en la hora del negocio. Los errores responden JSON, como el resto de la API.',
  middleware: [requireAuth(), requireRole('GERENTE')] as const,
  request: { query: tableroPdfQuerySchema },
  responses: {
    200: {
      description: 'El PDF de la sección',
      content: { 'application/pdf': { schema: z.string().openapi({ format: 'binary' }) } },
    },
    400: respuestaError(
      'Query inválido (VALIDACION): falta `desde` o `hasta`, una fecha inválida, `hasta` anterior a `desde`, un período de más de 366 días (`details` sobre `hasta`) o una `seccion` que no existe',
      ejemploErrorPeriodo,
    ),
    401: respuestaError('Sin sesión (NO_AUTENTICADO)', ejemploErrorSinSesion),
    403: respuestaError(
      'El rol no es gerente o el usuario está inhabilitado',
      ejemploErrorSinPermiso,
    ),
  },
})

export const tableroRoutes = createRouter()
  .openapi(obtenerTableroRoute, tableroController.obtenerTablero)
  .openapi(obtenerTableroAsistenciaRoute, tableroController.obtenerTableroAsistencia)
  .openapi(obtenerTableroPdfRoute, tableroController.obtenerTableroPdf)
