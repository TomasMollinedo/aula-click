import type { RouteHandler } from '@hono/zod-openapi'
import { getPresignedUrl } from '@/lib/storage'
import type { AppEnv } from '@/server/router'
import type {
  quitarAdjuntoRoute,
  reemplazarAdjuntoRoute,
  subirAdjuntoRoute,
  verAdjuntoDeLiquidacionRoute,
  verAdjuntoRoute,
} from './adjuntos.routes'
import { adjuntosRepository } from './adjuntos.repository'
import { crearAdjuntosService } from './adjuntos.service'

// Recibe el dato ya validado, llama al service y arma la respuesta (201, 204...).
// No accede a la base, no aplica reglas de negocio y no usa try/catch.
// Las rutas se importan solo como tipo: no hay ciclo en tiempo de ejecución.

// Única instancia del service, con el repository real y la URL prefirmada que abre el archivo en
// otra pestaña con su nombre (el service no importa `lib/storage`: no carga `@/config/env`).
const adjuntosService = crearAdjuntosService({
  repository: adjuntosRepository,
  firmarUrl: (archivoKey, nombreArchivo) =>
    getPresignedUrl(archivoKey, undefined, { inline: { nombreArchivo } }),
})

export const subir: RouteHandler<typeof subirAdjuntoRoute, AppEnv> = async (c) =>
  c.json(await adjuntosService.subir(c.req.valid('form').archivo, c.get('actor')), 201)

export const ver: RouteHandler<typeof verAdjuntoRoute, AppEnv> = async (c) =>
  c.json(await adjuntosService.verUltimo(c.req.valid('param').pagoId), 200)

export const verDeLiquidacion: RouteHandler<typeof verAdjuntoDeLiquidacionRoute, AppEnv> = async (
  c,
) => c.json(await adjuntosService.verDeLiquidacion(c.req.valid('param').liquidacionId), 200)

export const reemplazar: RouteHandler<typeof reemplazarAdjuntoRoute, AppEnv> = async (c) =>
  c.json(
    await adjuntosService.reemplazar(
      c.req.valid('param').pagoId,
      c.req.valid('form').archivo,
      c.get('actor'),
    ),
    200,
  )

export const quitar: RouteHandler<typeof quitarAdjuntoRoute, AppEnv> = async (c) => {
  await adjuntosService.quitar(c.req.valid('param').pagoId, c.get('actor'))
  return c.body(null, 204)
}
