import type { RouteHandler } from '@hono/zod-openapi'
import type { AppEnv } from '@/server/router'
import { crearCentroService } from './centro.service'
import type { obtenerCentroRoute, obtenerLogoRoute } from './centro.routes'

// Recibe el dato ya validado, llama al service y arma la respuesta.
// No accede a la base, no aplica reglas de negocio y no usa try/catch.
// Las rutas se importan solo como tipo: no hay ciclo en tiempo de ejecución.

const centroService = crearCentroService()

export const obtenerCentro: RouteHandler<typeof obtenerCentroRoute, AppEnv> = async (c) =>
  c.json(centroService.obtenerDatos(), 200)

export const obtenerLogo: RouteHandler<typeof obtenerLogoRoute, AppEnv> = async (c) => {
  const { bytes, contentType } = await centroService.obtenerLogo()
  // Cache-Control largo (definición del ticket): sin pantalla para editar el logo, no hace falta
  // revalidar seguido. Si algún día cambia el archivo, un query param de cache-busting lo resuelve.
  return c.body(bytes, 200, {
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=604800',
  })
}
