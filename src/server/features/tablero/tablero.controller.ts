import type { RouteHandler } from '@hono/zod-openapi'
import { encabezadoDeDocumento } from '@/server/features/centro/centro.condiciones'
import type { AppEnv } from '@/server/router'
import { respuestaPdf } from '@/server/shared/pdf/respuesta'
import { nombreArchivoTablero } from './tablero.formato'
import {
  renderizarTableroAsistenciaPdf,
  renderizarTableroFinanzasPdf,
  renderizarTableroPdf,
} from './tablero.pdf'
import type {
  obtenerTableroAsistenciaRoute,
  obtenerTableroFinanzasRoute,
  obtenerTableroPdfRoute,
  obtenerTableroRoute,
} from './tablero.routes'
import { tableroRepository } from './tablero.repository'
import { crearTableroService } from './tablero.service'
import type { SeccionTablero, TableroQuery } from './tablero.validation'

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

export const obtenerTableroFinanzas: RouteHandler<
  typeof obtenerTableroFinanzasRoute,
  AppEnv
> = async (c) => c.json(await tableroService.obtenerFinanzas(c.req.valid('query')), 200)

/** La plantilla de cada sección, con los datos de su service. */
async function pdfDeSeccion(
  seccion: SeccionTablero,
  periodo: Pick<TableroQuery, 'desde' | 'hasta'>,
  encabezado: ReturnType<typeof encabezadoDeDocumento>,
): Promise<Buffer> {
  switch (seccion) {
    case 'asistencia':
      return renderizarTableroAsistenciaPdf({
        tablero: await tableroService.asistenciaCompleta(periodo),
        ...encabezado,
      })
    case 'finanzas':
      return renderizarTableroFinanzasPdf({
        tablero: await tableroService.finanzasCompleta(periodo),
        ...encabezado,
      })
    case 'general':
      return renderizarTableroPdf({ tablero: await tableroService.obtener(periodo), ...encabezado })
  }
}

/**
 * Una sección del tablero de un período en PDF: los mismos números que el JSON de esa sección (el
 * mismo service, sin recalcular nada). "Emitido por" es quien lo pide y la fecha de emisión, la del
 * servidor.
 */
export const obtenerTableroPdf: RouteHandler<typeof obtenerTableroPdfRoute, AppEnv> = async (c) => {
  const { seccion, ...periodo } = c.req.valid('query')
  const pdf = await pdfDeSeccion(seccion, periodo, encabezadoDeDocumento(c.get('user')))
  const { cuerpo, headers } = respuestaPdf(pdf, nombreArchivoTablero(periodo, seccion))
  return c.body(cuerpo, 200, headers)
}
