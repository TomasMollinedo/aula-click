import type { RouteHandler } from '@hono/zod-openapi'
import { alumnosRepository } from '@/server/features/alumnos/alumnos.repository'
import { encabezadoDeDocumento } from '@/server/features/centro/centro.condiciones'
import type { AppEnv } from '@/server/router'
import { respuestaPdf } from '@/server/shared/pdf/respuesta'
import { nombreArchivoComprobante } from './pagos.formato'
import { renderizarComprobantePdf } from './pagos.pdf'
import type {
  obtenerComprobantePdfRoute,
  obtenerComprobanteRoute,
  registrarPagoRoute,
} from './pagos.routes'
import { pagosRepository } from './pagos.repository'
import { crearPagosService } from './pagos.service'

// Recibe el dato ya validado, llama al service y arma la respuesta (201, 200).
// No accede a la base, no aplica reglas de negocio y no usa try/catch.
// Las rutas se importan solo como tipo: no hay ciclo en tiempo de ejecución.

// Única instancia del service, con los repositories reales (el service no los importa como valor).
const pagosService = crearPagosService({ repository: pagosRepository, alumnosRepository })

export const registrar: RouteHandler<typeof registrarPagoRoute, AppEnv> = async (c) =>
  c.json(await pagosService.registrar(c.req.valid('json'), c.get('actor')), 201)

export const obtenerComprobante: RouteHandler<typeof obtenerComprobanteRoute, AppEnv> = async (c) =>
  c.json(await pagosService.obtenerComprobante(c.req.valid('param').id), 200)

/**
 * El comprobante en PDF: los mismos datos que `obtenerComprobante`, sin consultas nuevas. "Emitido
 * por" es quien lo pide (decisión T-111) y la fecha de emisión, la del servidor.
 */
export const obtenerComprobantePdf: RouteHandler<
  typeof obtenerComprobantePdfRoute,
  AppEnv
> = async (c) => {
  const comprobante = await pagosService.obtenerComprobante(c.req.valid('param').id)
  const pdf = await renderizarComprobantePdf({
    comprobante,
    ...encabezadoDeDocumento(c.get('user')),
  })
  const { cuerpo, headers } = respuestaPdf(
    pdf,
    nombreArchivoComprobante(comprobante.numeroComprobante),
  )
  return c.body(cuerpo, 200, headers)
}
