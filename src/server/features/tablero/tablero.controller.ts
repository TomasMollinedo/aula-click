import type { RouteHandler } from '@hono/zod-openapi'
import { encabezadoDeDocumento } from '@/server/features/centro/centro.condiciones'
import type { AppEnv } from '@/server/router'
import { respuestaPdf } from '@/server/shared/pdf/respuesta'
import { nombreArchivoTablero } from './tablero.formato'
import { renderizarTableroAsistenciaPdf, renderizarTableroPdf } from './tablero.pdf'
import type {
  obtenerTableroAsistenciaRoute,
  obtenerTableroPdfRoute,
  obtenerTableroRoute,
} from './tablero.routes'
import { tableroRepository } from './tablero.repository'
import { crearTableroService } from './tablero.service'

// Recibe el dato ya validado, llama al service y arma la respuesta (200).
// No accede a la base, no aplica reglas de negocio y no usa try/catch.
// Las rutas se importan solo como tipo: no hay ciclo en tiempo de ejecución.

// Única instancia del service, con el repository real (el service no lo importa como valor).
const tableroService = crearTableroService({ repository: tableroRepository })

export const obtenerTablero: RouteHandler<typeof obtenerTableroRoute, AppEnv> = async (c) =>
  c.json(await tableroService.obtener(c.req.valid('query')), 200)

export const obtenerTableroAsistencia: RouteHandler<
  typeof obtenerTableroAsistenciaRoute,
  AppEnv
> = async (c) => c.json(await tableroService.obtenerAsistencia(c.req.valid('query')), 200)

/**
 * Una sección del tablero de un período en PDF: los mismos números que el JSON de esa sección (el
 * mismo service, sin recalcular nada). "Emitido por" es quien lo pide y la fecha de emisión, la del
 * servidor.
 */
export const obtenerTableroPdf: RouteHandler<typeof obtenerTableroPdfRoute, AppEnv> = async (c) => {
  const { seccion, ...periodo } = c.req.valid('query')
  const encabezado = encabezadoDeDocumento(c.get('user'))
  const pdf =
    seccion === 'asistencia'
      ? await renderizarTableroAsistenciaPdf({
          tablero: await tableroService.asistenciaCompleta(periodo),
          ...encabezado,
        })
      : await renderizarTableroPdf({
          tablero: await tableroService.obtener(periodo),
          ...encabezado,
        })
  const { cuerpo, headers } = respuestaPdf(pdf, nombreArchivoTablero(periodo, seccion))
  return c.body(cuerpo, 200, headers)
}
