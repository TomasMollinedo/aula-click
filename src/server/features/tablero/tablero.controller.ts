import type { RouteHandler } from '@hono/zod-openapi'
import { encabezadoDeDocumento } from '@/server/features/centro/centro.condiciones'
import type { AppEnv } from '@/server/router'
import { respuestaPdf } from '@/server/shared/pdf/respuesta'
import { nombreArchivoTablero } from './tablero.formato'
import { renderizarTableroPdf } from './tablero.pdf'
import type { obtenerTableroPdfRoute, obtenerTableroRoute } from './tablero.routes'
import { tableroRepository } from './tablero.repository'
import { crearTableroService } from './tablero.service'

// Recibe el dato ya validado, llama al service y arma la respuesta (200).
// No accede a la base, no aplica reglas de negocio y no usa try/catch.
// Las rutas se importan solo como tipo: no hay ciclo en tiempo de ejecución.

// Única instancia del service, con el repository real (el service no lo importa como valor).
const tableroService = crearTableroService({ repository: tableroRepository })

export const obtenerTablero: RouteHandler<typeof obtenerTableroRoute, AppEnv> = async (c) =>
  c.json(await tableroService.obtener(c.req.valid('query')), 200)

/**
 * El tablero de un período en PDF: los mismos indicadores que el JSON (el mismo service, sin
 * recalcular nada). "Emitido por" es quien lo pide y la fecha de emisión, la del servidor.
 */
export const obtenerTableroPdf: RouteHandler<typeof obtenerTableroPdfRoute, AppEnv> = async (c) => {
  const tablero = await tableroService.obtener(c.req.valid('query'))
  const pdf = await renderizarTableroPdf({ tablero, ...encabezadoDeDocumento(c.get('user')) })
  const { cuerpo, headers } = respuestaPdf(pdf, nombreArchivoTablero(tablero.periodo))
  return c.body(cuerpo, 200, headers)
}
