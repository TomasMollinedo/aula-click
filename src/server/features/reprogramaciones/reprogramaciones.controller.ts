import type { RouteHandler } from '@hono/zod-openapi'
import { bloquesRepository } from '@/server/features/bloques/bloques.repository'
import { turnosRepository } from '@/server/features/turnos/turnos.repository'
import type { AppEnv } from '@/server/router'
import { reprogramacionesRepository } from './reprogramaciones.repository'
import { crearReprogramacionesService } from './reprogramaciones.service'
import type { reprogramarRoute } from './reprogramaciones.routes'

// Recibe el dato ya validado, llama al service y arma la respuesta (200).
// No accede a la base, no aplica reglas de negocio y no usa try/catch.
// Las rutas se importan solo como tipo: no hay ciclo en tiempo de ejecución.

// Única instancia del service, con los repositories reales (el service no los importa como valor).
const reprogramacionesService = crearReprogramacionesService({
  repository: reprogramacionesRepository,
  turnosRepository,
  bloquesRepository,
})

export const reprogramar: RouteHandler<typeof reprogramarRoute, AppEnv> = async (c) =>
  c.json(await reprogramacionesService.reprogramar(c.req.valid('json'), c.get('actor')), 200)
