import { createRoute, z } from '@hono/zod-openapi'
import { ErrorResponseSchema } from '@/server/errors'
import { requireAuth, requireRole } from '@/server/middlewares/auth'
import { createRouter } from '@/server/router'
import * as pagosController from './pagos.controller'
import {
  ejemploAlumnosDePagos,
  ejemploDetalle,
  ejemploErrorBuscador,
  ejemploErrorMonto,
  ejemploErrorNoCobrables,
  ejemploErrorRango,
  ejemploListado,
  ejemploMisPagos,
  ejemploProfesoresDePagos,
  ejemploRegistrado,
  ejemploRegistrar,
  ejemploRegistrarDebito,
  ejemploRegistrarTransferencia,
} from './pagos.ejemplos'
import {
  alumnosDePagosSchema,
  buscadorPagosQuerySchema,
  detallePagoSchema,
  listadoPagosSchema,
  listarPagosQuerySchema,
  misPagosQuerySchema,
  misPagosSchema,
  pagoIdParamsSchema,
  pagoRegistradoSchema,
  profesoresDePagosSchema,
  registrarPagoSchema,
} from './pagos.validation'

// Contrato HTTP de pagos (HU-15, T-51; pagos realizados y "Mis pagos", HU-36 y HU-37, T-98): cada
// endpoint se declara con createRoute() y se registra acá. El router lo creó T-32 y ya está
// registrado en `app.ts`.

const tags = ['Pagos']

function respuestaError(description: string, example?: unknown) {
  return {
    description,
    content: {
      'application/json': { schema: ErrorResponseSchema, ...(example ? { example } : {}) },
    },
  }
}

const errores = {
  401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
  403: respuestaError('El rol no es mesa de entradas o el usuario está inhabilitado'),
}

export const registrarPagoRoute = createRoute({
  method: 'post',
  path: '/',
  tags,
  summary: 'Registrar el pago de uno o varios turnos',
  description:
    'Cobra una o varias ocurrencias `(turnoId, fecha)` de un alumno, todo o nada, en efectivo, por transferencia o con débito (`formaPago`, obligatoria, cada una con sus datos y sólo los suyos). El importe de cada una es el precio por hora vigente de su materia y no depende del medio; el total y, en efectivo, el vuelto los calcula la API (el vuelto no se guarda). Con transferencia el comprobante adjunto (`comprobanteAdjuntoId`, de `POST /adjuntos`) es obligatorio; con débito, opcional. Cobrables: no canceladas (`AGENDADO`, `SIN_REGISTRAR`, `REALIZADO` o `AUSENTE`), sin un pago vigente (una de un pago anulado se vuelve a cobrar), fecha hasta hoy + 56 días y materia con precio.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS')] as const,
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: registrarPagoSchema,
          examples: {
            efectivo: { summary: 'En efectivo', value: ejemploRegistrar },
            transferencia: { summary: 'Por transferencia', value: ejemploRegistrarTransferencia },
            debito: { summary: 'Con débito', value: ejemploRegistrarDebito },
          },
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Pago registrado',
      content: { 'application/json': { schema: pagoRegistradoSchema, example: ejemploRegistrado } },
    },
    400: respuestaError(
      'Datos inválidos (VALIDACION): formato, ocurrencias repetidas, `formaPago` ausente, datos que faltan o sobran para la forma de pago (un pago, un medio), `fechaPago` posterior a hoy, ocurrencias de otro alumno, total mayor al máximo o, en efectivo, `montoRecibido` menor al total. `ADJUNTO_INVALIDO` en `comprobanteAdjuntoId` si el comprobante no existe, ya se usó o lo subió otro usuario',
      ejemploErrorMonto,
    ),
    ...errores,
    404: respuestaError('El alumno no existe (NO_ENCONTRADO)'),
    409: respuestaError(
      'Alguna ocurrencia no se puede cobrar (TURNOS_NO_COBRABLES): `details` con cada una y su motivo (`NO_EXISTE`, `CANCELADO`, `YA_PAGADO`, `FUERA_DE_RANGO`, `SIN_PRECIO`). Sin `details` si otro pago la registró al mismo tiempo',
      ejemploErrorNoCobrables,
    ),
  },
})

export const listarPagosRoute = createRoute({
  method: 'get',
  path: '/',
  tags,
  summary: 'Pagos realizados, con lo cobrado por forma de pago',
  description:
    'Pagos con **fecha de pago** en `[desde, hasta]` (obligatorios, sin tope de días), del más reciente al más antiguo (`fechaPago` y `id`, descendentes) y paginados. Vigentes y anulados: un anulado se lista con su `estado` y su motivo, pero no suma. Con `materiaId` y/o `profesorId`, los pagos con algún turno de esa materia y/o ese profesor (los dos sobre el mismo turno). `formaPago` filtra por código. Un alumno, una materia o un profesor que no existen dan una lista vacía y los totales en 0. `totales` es de **todo** el filtro, no de la página, sólo con pagos vigentes: `cobrado` es la suma de `porForma` (con materia o profesor, cada pago suma su total completo).',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS', 'GERENTE')] as const,
  request: { query: listarPagosQuerySchema },
  responses: {
    200: {
      description: 'Página de pagos realizados y totales del filtro',
      content: { 'application/json': { schema: listadoPagosSchema, example: ejemploListado } },
    },
    400: respuestaError(
      'Query inválido (VALIDACION): falta `desde` o `hasta`, fecha inválida, `hasta` anterior a `desde` (en `hasta`), id que no es un entero positivo, `formaPago` desconocida o paginación fuera de rango',
      ejemploErrorRango,
    ),
    401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
    403: respuestaError('El rol no es mesa de entradas ni gerente, o el usuario está inhabilitado'),
  },
})

// Endpoint del portal (`mis-…`): el alumno sale de la sesión. Se registra antes de `/{id}`: si no,
// `/mis-pagos` caería en ese path param (el mismo cuidado que `/mis-alumnos` en `alumnos.routes.ts`).
export const misPagosRoute = createRoute({
  method: 'get',
  path: '/mis-pagos',
  tags,
  summary: 'Mis pagos (portal del alumno)',
  description:
    'Los pagos del alumno de la sesión, vigentes y anulados, del más reciente al más antiguo y paginados: número, fecha, materias, cantidad de turnos, total, forma de pago y estado. Sin quién lo registró, el comprobante adjunto, las observaciones ni el motivo de la anulación. No recibe un `alumnoId`.',
  middleware: [requireAuth(), requireRole('ALUMNO')] as const,
  request: { query: misPagosQuerySchema },
  responses: {
    200: {
      description: 'Página de pagos del alumno',
      content: { 'application/json': { schema: misPagosSchema, example: ejemploMisPagos } },
    },
    400: respuestaError('Paginación inválida (VALIDACION)'),
    401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
    403: respuestaError('El rol no es alumno o la cuenta no tiene un alumno vinculado'),
  },
})

// Buscadores de los filtros de pagos realizados (HU-36, T-100): pagos publica los suyos, sin abrirle
// al gerente `GET /alumnos` ni `GET /profesores` (decisión T-169). Se registran antes de `/{id}`,
// como `/mis-pagos`: si no, `/alumnos` y `/profesores` caerían en ese path param.
const descripcionBuscador =
  'Sin paginar, por apellido y nombre, hasta 20. `q`: búsqueda por palabras, como `GET /alumnos` (sin mayúsculas, tildes ni puntos). `id`: sólo esa opción si corresponde, o `[]` (para mostrar el nombre del filtro que viene en la URL). Cada opción trae sólo `id`, `nombre` y `apellido`.'

export const buscarAlumnosRoute = createRoute({
  method: 'get',
  path: '/alumnos',
  tags,
  summary: 'Buscador de alumnos para el filtro de pagos realizados',
  description: `Alumnos con al menos un pago, vigente o anulado. La búsqueda también encuentra por DNI, que no se devuelve. ${descripcionBuscador}`,
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS', 'GERENTE')] as const,
  request: { query: buscadorPagosQuerySchema },
  responses: {
    200: {
      description: 'Alumnos con pagos (arreglo vacío si no hay ninguno)',
      content: {
        'application/json': { schema: alumnosDePagosSchema, example: ejemploAlumnosDePagos },
      },
    },
    400: respuestaError(
      'Query inválido (VALIDACION): `q` de más de 100 caracteres o `id` que no es un entero positivo',
      ejemploErrorBuscador,
    ),
    401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
    403: respuestaError('El rol no es mesa de entradas ni gerente, o el usuario está inhabilitado'),
  },
})

export const buscarProfesoresRoute = createRoute({
  method: 'get',
  path: '/profesores',
  tags,
  summary: 'Buscador de profesores para el filtro de pagos realizados',
  description: `Profesores que dictan algún turno incluido en un pago (el profesor actual del turno, como el filtro \`profesorId\`), incluidos los dados de baja. ${descripcionBuscador}`,
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS', 'GERENTE')] as const,
  request: { query: buscadorPagosQuerySchema },
  responses: {
    200: {
      description: 'Profesores con turnos pagados (arreglo vacío si no hay ninguno)',
      content: {
        'application/json': { schema: profesoresDePagosSchema, example: ejemploProfesoresDePagos },
      },
    },
    400: respuestaError(
      'Query inválido (VALIDACION): `q` de más de 100 caracteres o `id` que no es un entero positivo',
      ejemploErrorBuscador,
    ),
    401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
    403: respuestaError('El rol no es mesa de entradas ni gerente, o el usuario está inhabilitado'),
  },
})

export const obtenerComprobanteRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags,
  summary: 'Detalle de un pago',
  description:
    'Datos del comprobante: número, fecha, alumno, cada turno con los datos actuales de su turno y el importe cobrado, total, monto recibido y vuelto (recalculado), forma de pago, observaciones y quién lo registró. Además, `cantidad` de turnos, el último comprobante adjunto activo (`adjunto`, sin URL: la da `GET /adjuntos/pagos/{pagoId}`; `null` si no tiene) y `acciones` según el rol, el estado y la forma de pago. El gerente lo ve en sólo lectura: todas sus acciones en `false`.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS', 'GERENTE')] as const,
  request: { params: pagoIdParamsSchema },
  responses: {
    200: {
      description: 'Detalle del pago',
      content: { 'application/json': { schema: detallePagoSchema, example: ejemploDetalle } },
    },
    400: respuestaError('Id inválido (VALIDACION)'),
    401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
    403: respuestaError('El rol no es mesa de entradas ni gerente, o el usuario está inhabilitado'),
    404: respuestaError('El pago no existe (NO_ENCONTRADO)'),
  },
})

export const obtenerComprobantePdfRoute = createRoute({
  method: 'get',
  path: '/{id}/pdf',
  tags,
  summary: 'Comprobante de un pago, en PDF',
  description:
    'El comprobante como documento oficial en PDF (A4), con los mismos datos que `GET /pagos/{id}` (sin el adjunto ni las acciones): el mismo documento para todos los roles. El alumno sólo pide los suyos. Se abre en el visor del navegador (`Content-Disposition: inline`, archivo `comprobante-<número>.pdf`) y no se guarda en caché (`Cache-Control: no-store`). "Emitido por" es el usuario de la sesión y la fecha de emisión, la del servidor en la hora del negocio. Los errores responden JSON, como el resto de la API.',
  middleware: [requireAuth(), requireRole('MESA_ENTRADAS', 'GERENTE', 'ALUMNO')] as const,
  request: { params: pagoIdParamsSchema },
  responses: {
    200: {
      description: 'El PDF del comprobante',
      content: { 'application/pdf': { schema: z.string().openapi({ format: 'binary' }) } },
    },
    400: respuestaError('Id inválido (VALIDACION)'),
    401: respuestaError('Sin sesión (NO_AUTENTICADO)'),
    403: respuestaError(
      'El rol no es mesa de entradas, gerente ni alumno, el usuario está inhabilitado o, para el alumno, la cuenta no tiene alumno o el pago es de otro alumno (SIN_PERMISO)',
    ),
    404: respuestaError('El pago no existe (NO_ENCONTRADO)'),
  },
})

export const pagosRoutes = createRouter()
  .openapi(registrarPagoRoute, pagosController.registrar)
  .openapi(listarPagosRoute, pagosController.listar)
  .openapi(misPagosRoute, pagosController.misPagos)
  .openapi(buscarAlumnosRoute, pagosController.buscarAlumnos)
  .openapi(buscarProfesoresRoute, pagosController.buscarProfesores)
  .openapi(obtenerComprobanteRoute, pagosController.obtenerComprobante)
  .openapi(obtenerComprobantePdfRoute, pagosController.obtenerComprobantePdf)
