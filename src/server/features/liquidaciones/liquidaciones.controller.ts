import type { RouteHandler } from '@hono/zod-openapi'
import { encabezadoDeDocumento } from '@/server/features/centro/centro.condiciones'
import type { AppEnv } from '@/server/router'
import { respuestaPdf } from '@/server/shared/pdf/respuesta'
import { nombreArchivoLiquidacion, type LiquidacionDocumento } from './liquidaciones.documentos'
import { renderizarLiquidacionPdf } from './liquidaciones.pdf'
import { liquidacionesRepository } from './liquidaciones.repository'
import type {
  detalleLiquidacionRoute,
  liquidacionPdfRoute,
  listarLiquidacionesRoute,
  miLiquidacionPdfRoute,
  miLiquidacionRoute,
  misIngresosRoute,
  misLiquidacionesRoute,
  pagarLiquidacionRoute,
} from './liquidaciones.routes'
import { crearLiquidacionesService } from './liquidaciones.service'

// Recibe el dato ya validado, llama al service y arma la respuesta (200 o 201; el PDF, con los
// headers comunes de los documentos).
// No accede a la base, no aplica reglas de negocio y no usa try/catch.
// Las rutas se importan solo como tipo: no hay ciclo en tiempo de ejecución.

// Única instancia del service, con el repository real (el service no lo importa como valor).
const liquidacionesService = crearLiquidacionesService({ repository: liquidacionesRepository })

export const listarLiquidaciones: RouteHandler<typeof listarLiquidacionesRoute, AppEnv> = async (
  c,
) => c.json(await liquidacionesService.listar(c.req.valid('query')), 200)

export const detalleLiquidacion: RouteHandler<typeof detalleLiquidacionRoute, AppEnv> = async (c) =>
  c.json(await liquidacionesService.detalle(c.req.valid('param')), 200)

export const pagarLiquidacion: RouteHandler<typeof pagarLiquidacionRoute, AppEnv> = async (c) =>
  c.json(
    await liquidacionesService.pagar(c.req.valid('param'), c.req.valid('json'), c.get('actor')),
    201,
  )

export const misIngresos: RouteHandler<typeof misIngresosRoute, AppEnv> = async (c) =>
  c.json(await liquidacionesService.misIngresos(c.get('actor')), 200)

export const misLiquidaciones: RouteHandler<typeof misLiquidacionesRoute, AppEnv> = async (c) =>
  c.json(await liquidacionesService.misLiquidaciones(c.req.valid('query'), c.get('actor')), 200)

export const miLiquidacion: RouteHandler<typeof miLiquidacionRoute, AppEnv> = async (c) =>
  c.json(await liquidacionesService.miLiquidacion(c.req.valid('param'), c.get('actor')), 200)

/** Los bytes del PDF con el encabezado oficial y los headers comunes de los documentos (T-123). */
async function responderPdf(
  documento: LiquidacionDocumento,
  user: Parameters<typeof encabezadoDeDocumento>[0],
) {
  const pdf = await renderizarLiquidacionPdf({ documento, ...encabezadoDeDocumento(user) })
  return respuestaPdf(pdf, nombreArchivoLiquidacion(documento))
}

/** El PDF de la liquidación (HU-44): el gerente, de cualquier profesor; el profesor, sólo la suya. */
export const liquidacionPdf: RouteHandler<typeof liquidacionPdfRoute, AppEnv> = async (c) => {
  const documento = await liquidacionesService.documento(c.req.valid('param'), c.get('actor'))
  const { cuerpo, headers } = await responderPdf(documento, c.get('user'))
  return c.body(cuerpo, 200, headers)
}

/** El PDF de la liquidación del profesor de la sesión (HU-45), sin el `profesorId`. */
export const miLiquidacionPdf: RouteHandler<typeof miLiquidacionPdfRoute, AppEnv> = async (c) => {
  const documento = await liquidacionesService.miDocumento(c.req.valid('param'), c.get('actor'))
  const { cuerpo, headers } = await responderPdf(documento, c.get('user'))
  return c.body(cuerpo, 200, headers)
}
