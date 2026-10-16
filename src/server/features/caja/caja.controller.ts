import type { RouteHandler } from '@hono/zod-openapi'
import { encabezadoDeDocumento } from '@/server/features/centro/centro.condiciones'
import type { AppEnv } from '@/server/router'
import { respuestaPdf } from '@/server/shared/pdf/respuesta'
import { cajaRepository } from './caja.repository'
import { nombreArchivoCaja } from './caja.formato'
import { renderizarCajaPdf } from './caja.pdf'
import type { obtenerCajaPdfRoute, obtenerCajaRoute } from './caja.routes'
import { crearCajaService } from './caja.service'

// Recibe el dato ya validado, llama al service y arma la respuesta (200).
// No accede a la base, no aplica reglas de negocio y no usa try/catch.
// Las rutas se importan solo como tipo: no hay ciclo en tiempo de ejecución.

// Única instancia del service, con el repository real (el service no lo importa como valor).
const cajaService = crearCajaService({ repository: cajaRepository })

export const obtenerCaja: RouteHandler<typeof obtenerCajaRoute, AppEnv> = async (c) =>
  c.json(await cajaService.obtener(c.req.valid('query')), 200)

/**
 * La caja de un día en PDF: los mismos datos que el JSON, sin filtros (el mismo service, sin
 * recalcular nada). "Emitido por" es quien lo pide y la fecha de emisión, la del servidor.
 */
export const obtenerCajaPdf: RouteHandler<typeof obtenerCajaPdfRoute, AppEnv> = async (c) => {
  const caja = await cajaService.paraDocumento(c.req.valid('query'))
  const pdf = await renderizarCajaPdf({ caja, ...encabezadoDeDocumento(c.get('user')) })
  const { cuerpo, headers } = respuestaPdf(pdf, nombreArchivoCaja(caja.fecha))
  return c.body(cuerpo, 200, headers)
}
