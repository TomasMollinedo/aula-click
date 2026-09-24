import type { RouteHandler } from '@hono/zod-openapi'
import { bloquesRepository } from '@/server/features/bloques/bloques.repository'
import type { AppEnv } from '@/server/router'
import { aulasRepository } from './aulas.repository'
import { crearAulasService } from './aulas.service'
import type { aulasDisponiblesRoute } from './aulas.routes'

// Recibe el dato ya validado, llama al service y arma la respuesta (201, 204...).
// No accede a la base, no aplica reglas de negocio y no usa try/catch.
// Las rutas se importan solo como tipo: no hay ciclo en tiempo de ejecución.

// Única instancia del service, con los repositories reales (el service no los importa como valor).
const aulasService = crearAulasService({ repository: aulasRepository, bloquesRepository })

export const disponibles: RouteHandler<typeof aulasDisponiblesRoute, AppEnv> = async (c) =>
  c.json(await aulasService.disponibles(c.req.valid('query')), 200)
