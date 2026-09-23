import type { RouteHandler } from '@hono/zod-openapi'
import { materiasRepository } from '@/server/features/materias/materias.repository'
import type { AppEnv } from '@/server/router'
import type { asignarMateriasRoute, listarMateriasAsignadasRoute } from './profesores.routes'
import { profesoresRepository } from './profesores.repository'
import { crearProfesoresService } from './profesores.service'

// Recibe el dato ya validado, llama al service y arma la respuesta (201, 204...).
// No accede a la base, no aplica reglas de negocio y no usa try/catch.
// Las rutas se importan solo como tipo: no hay ciclo en tiempo de ejecución.

// Única instancia del service, con los repositories reales (el service no los importa como valor).
const profesoresService = crearProfesoresService({
  repository: profesoresRepository,
  materiasRepository,
})

export const listarMateriasAsignadas: RouteHandler<
  typeof listarMateriasAsignadasRoute,
  AppEnv
> = async (c) =>
  c.json(await profesoresService.listarMateriasAsignadas(c.req.valid('param').id), 200)

export const asignarMaterias: RouteHandler<typeof asignarMateriasRoute, AppEnv> = async (c) =>
  c.json(
    await profesoresService.asignarMaterias(
      c.req.valid('param').id,
      c.req.valid('json'),
      c.get('actor'),
    ),
    201,
  )
