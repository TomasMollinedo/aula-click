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
} from './tablero.ejemplos'
import { tableroQuerySchema, tableroSchema } from './tablero.validation'

// Contrato HTTP del tablero del gerente (HU-21, T-61): el endpoint se declara con createRoute() y
// se registra acá. El router lo creó T-32 y ya está registrado en `app.ts`.

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
  summary: 'Indicadores del centro en un período',
  description:
    'Sólo lectura y sólo agregados: no devuelve datos de un alumno, un pago ni una agenda puntual, y se calcula al consultarlo. Turnos del período por estado (cancelados, sin registrar y, si el período incluye hoy o fechas futuras, agendados; si no, `agendados` es `null`), ocupación (turnos no cancelados sobre la capacidad efectiva de las clases con al menos un turno no cancelado, sin recortar a 100), alumnos nuevos, las 5 materias y los 5 profesores con más turnos no cancelados, total cobrado del período (por fecha de pago) y total adeudado **a la fecha** (`hoy`, sin período: el mismo de `GET /cuentas/adeudados` sin filtros). Los indicadores que dependen de la asistencia (`turnos.asistio`, `turnos.noAsistio` y `alumnos.atendidos`) son `{ "disponible": false }` hasta HU-22. Los porcentajes van de 0 a 100 con un decimal y no se ajustan para sumar 100.',
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

export const obtenerTableroPdfRoute = createRoute({
  method: 'get',
  path: '/pdf',
  tags: ['Tablero'],
  summary: 'Indicadores del centro en un período, en PDF',
  description:
    'El tablero como documento oficial en PDF (A4), con los mismos indicadores y el mismo período que `GET /tablero` (mismo query, mismas reglas y mismos errores 400). Se abre en el visor del navegador (`Content-Disposition: inline`, archivo `tablero-<desde>_<hasta>.pdf`) y no se guarda en caché (`Cache-Control: no-store`). "Emitido por" es el usuario de la sesión y la fecha de emisión, la del servidor en la hora del negocio. Los errores responden JSON, como el resto de la API.',
  middleware: [requireAuth(), requireRole('GERENTE')] as const,
  request: { query: tableroQuerySchema },
  responses: {
    200: {
      description: 'El PDF del tablero',
      content: { 'application/pdf': { schema: z.string().openapi({ format: 'binary' }) } },
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

export const tableroRoutes = createRouter()
  .openapi(obtenerTableroRoute, tableroController.obtenerTablero)
  .openapi(obtenerTableroPdfRoute, tableroController.obtenerTableroPdf)
