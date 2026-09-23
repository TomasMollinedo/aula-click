import type { RouteHandler } from '@hono/zod-openapi'
import type { AppEnv } from '@/server/router'
import type { listarMateriasAsignadasRoute } from './profesores.routes'
import { profesoresRepository } from './profesores.repository'
import { crearProfesoresService } from './profesores.service'

// Recibe el dato ya validado, llama al service y arma la respuesta (201, 204...).
// No accede a la base, no aplica reglas de negocio y no usa try/catch.
// Las rutas se importan solo como tipo: no hay ciclo en tiempo de ejecución.

// Única instancia del service, con el repository real (el service no lo importa como valor).
const profesoresService = crearProfesoresService({ repository: profesoresRepository })

export const listarMateriasAsignadas: RouteHandler<
  typeof listarMateriasAsignadasRoute,
  AppEnv
> = async (c) =>
  c.json(await profesoresService.listarMateriasAsignadas(c.req.valid('param').id), 200)
