import { createRoute, z } from '@hono/zod-openapi'
import { ErrorResponseSchema } from '@/server/errors'
import { requireAuth, requireRole } from '@/server/middlewares/auth'
import { createRouter } from '@/server/router'
import * as cajaController from './caja.controller'
import {
  ejemploCaja,
  ejemploCajaVacia,
  ejemploErrorFechaFutura,
  ejemploErrorSinPermiso,
  ejemploErrorSinSesion,
} from './caja.ejemplos'
import { cajaPdfQuerySchema, cajaQuerySchema, cajaSchema } from './caja.validation'

// Contrato HTTP de la caja diaria del gerente (HU-46, T-127): los endpoints se declaran con
// createRoute() y se registran acá. El router lo creó T-119 y ya está registrado en `app.ts`.

const tags = ['Caja']

function respuestaError(description: string, example: unknown) {
  return {
    description,
    content: { 'application/json': { schema: ErrorResponseSchema, example } },
  }
}

const errores = {
  401: respuestaError('Sin sesión (NO_AUTENTICADO)', ejemploErrorSinSesion),
  403: respuestaError(
    'El rol no es gerente o el usuario está inhabilitado',
    ejemploErrorSinPermiso,
  ),
}

export const obtenerCajaRoute = createRoute({
  method: 'get',
  path: '/',
  tags,
  summary: 'Caja de un día: movimientos y resumen',
  description:
    'Todo el dinero que entró y salió del centro en `fecha` (por defecto, hoy). `movimientos`, por hora de registro: `COBRO` (+), los pagos con **fecha de pago** igual a `fecha`, también los que después se anularon (ese día fueron un cobro; `estado` los marca); `ANULACION` (−), las anulaciones **registradas** ese día, aunque el pago sea de otro día; `PAGO_PROFESOR` (−), las liquidaciones `PAGADA` con **fecha de transferencia** igual a `fecha`. `tipo` y `formaPago` filtran sólo `movimientos` (un pago a un profesor es `TRANSFERENCIA`). `resumen` es siempre el del día completo: ingresos por forma de pago y total (cobros menos anulaciones, puede ser negativo), de ese total la parte del centro y la de los profesores con el porcentaje guardado en cada cobro, egresos (pagado a profesores) y saldo. Un día sin movimientos devuelve la lista vacía y el resumen en 0.',
  middleware: [requireAuth(), requireRole('GERENTE')] as const,
  request: { query: cajaQuerySchema },
  responses: {
    200: {
      description: 'Los movimientos del día y su resumen',
      content: {
        'application/json': {
          schema: cajaSchema,
          examples: {
            conMovimientos: { summary: 'Con movimientos', value: ejemploCaja },
            vacio: { summary: 'Un día sin movimientos', value: ejemploCajaVacia },
          },
        },
      },
    },
    400: respuestaError(
      'Query inválido (VALIDACION): `fecha` con formato inválido o posterior a hoy (`details` sobre `fecha`), o un `tipo` o una `formaPago` que no existen',
      ejemploErrorFechaFutura,
    ),
    ...errores,
  },
})

export const obtenerCajaPdfRoute = createRoute({
  method: 'get',
  path: '/pdf',
  tags,
  summary: 'La caja de un día, en PDF',
  description:
    'La caja de `fecha` (por defecto, hoy) como documento oficial en PDF (A4): el resumen y la lista **completa** de movimientos, sin filtros, con los mismos números que `GET /caja`. Se abre en el visor del navegador (`Content-Disposition: inline`, archivo `caja-<fecha>.pdf`) y no se guarda en caché (`Cache-Control: no-store`). "Emitido por" es el usuario de la sesión y la fecha de emisión, la del servidor en la hora del negocio. Los errores responden JSON, como el resto de la API.',
  middleware: [requireAuth(), requireRole('GERENTE')] as const,
  request: { query: cajaPdfQuerySchema },
  responses: {
    200: {
      description: 'El PDF de la caja',
      content: { 'application/pdf': { schema: z.string().openapi({ format: 'binary' }) } },
    },
    400: respuestaError(
      'Query inválido (VALIDACION): `fecha` con formato inválido o posterior a hoy (`details` sobre `fecha`)',
      ejemploErrorFechaFutura,
    ),
    ...errores,
  },
})

export const cajaRoutes = createRouter()
  .openapi(obtenerCajaRoute, cajaController.obtenerCaja)
  .openapi(obtenerCajaPdfRoute, cajaController.obtenerCajaPdf)
